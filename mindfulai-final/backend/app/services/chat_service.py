import re, logging, asyncio
from typing import Dict, Tuple, List, AsyncGenerator, Optional
from app.core.config import settings
from app.services import safety_service, emotion_service, memory_service
from app.services import prompt_builder, variation_engine, suggestion_service, llm_service

log = logging.getLogger(__name__)

EVENT_PATTERNS = {
    "relationship_pain": re.compile(r"\b(breakup|break up|divorce|ex|cheated|betrayal|left me)\b", re.I),
    "loneliness": re.compile(r"\b(alone|lonely|loneliness|no friends|nobody to talk to)\b", re.I),
    "anxiety": re.compile(r"\b(panic|anxious|anxiety|overthinking|stress|tense)\b", re.I),
}

def detect_event(text: str) -> Optional[str]:
    """Detect specific life events in user input"""
    for event, pat in EVENT_PATTERNS.items():
        if pat.search(text):
            return event
    return None

def get_stage(turn_count: int) -> str:
    """Deterministic conversation stages: 0-2 (listening), 3-5 (exploring), 6+ (guiding)"""
    if turn_count <= 2:
        return "listening"
    elif turn_count <= 5:
        return "exploring"
    else:
        return "guiding"

def quality_ok(response: str, recent_hashes: List[str], history: List[Dict]) -> bool:
    """Enforce elite quality rules: length, single question, anti-repetition"""
    if len(response.split()) < 5: return False
    
    # Rule: Max 1 question
    if response.count("?") > 1: return False
    
    # Rule: If last bot message was a question, this one shouldn't be
    if history:
        last_bot = next((m for m in reversed(history) if m["role"] == "assistant"), None)
        if last_bot and "?" in last_bot["content"] and "?" in response:
            return False
            
    if variation_engine.is_repetitive(response, recent_hashes): return False
    return True

async def run_pipeline(user_id: int, session_id: str, user_message: str, db,
                       flow_step: int = 0, flow_type: str = "venting") -> Tuple[str, Dict]:
    """Elite Chat Pipeline: Context -> Emotion -> Event -> Prompt -> Generation -> Validate"""
    
    # 1. LOAD CONTEXT
    memory_layer = memory_service.MemoryLayer()
    memory_context = await memory_layer.get_memory_context(user_id, session_id, db)
    short_term = memory_context["short_term"]
    long_term = memory_context["long_term"]
    
    # 2. DETECT STATE
    risk = await safety_service.assess_risk(user_message, user_id, db)
    if risk["override"]:
        return risk["response"], {"emotion": "fear", "safe": False, "flow": "crisis"}
    
    emotion = emotion_service.detect_emotion(user_message)["label"]
    event = detect_event(user_message)
    stage = get_stage(flow_step)
    
    # TRACK CONVERSATION FLOW (Anti-interrogation)
    last_bot = next((m for m in reversed(short_term) if m["role"] == "assistant"), None)
    last_bot_text = last_bot["content"] if last_bot else ""
    
    # 3. BUILD ELITE PROMPT
    system = prompt_builder.build_system_prompt(
        emotion=emotion,
        flow_stage=stage,
        turn_count=flow_step,
        memory_context=memory_context,
        recent_hashes=long_term.get("recent_response_hashes", []),
        user_message=user_message,
        event=event,
        last_bot_message=last_bot_text
    )
    
    messages = prompt_builder.build_messages(user_message, short_term, system)
    
    # 4. GENERATE WITH REGEN + VALIDATION
    final_response, attempts = "", 0
    while attempts < settings.MAX_REGEN_ATTEMPTS:
        raw = await llm_service.generate(messages)
        
        # ELITE VALIDATION LAYER
        if quality_ok(raw, long_term.get("recent_response_hashes", []), short_term):
            final_response = raw
            break
            
        messages[0]["content"] += "\n\nCRITICAL: Do not repeat phrasing. Do not ask a question if the last response was a question."
        attempts += 1
    
    if not final_response:
        final_response = raw # Fallback to last raw if all attempts fail validation
    
    # 5. HUMANIZATION + VARIATION
    final = variation_engine.humanize(
        final_response, 
        recent_hashes=long_term.get("recent_response_hashes", []),
        emotion=emotion,
        flow_stage=stage
    )
    
    return final or final_response, {
        "emotion": emotion,
        "safe": risk.get("safe", True),
        "flow": stage,
        "flow_step": flow_step,
        "event": event
    }

async def run_pipeline_stream(user_id: int, session_id: str, user_message: str, db,
                             flow_step: int = 0, flow_type: str = "venting") -> AsyncGenerator:
    """Elite Streaming Pipeline"""
    
    # 1. LOAD CONTEXT
    memory_layer = memory_service.MemoryLayer()
    memory_context = await memory_layer.get_memory_context(user_id, session_id, db)
    short_term = memory_context["short_term"]
    long_term = memory_context["long_term"]
    
    # 2. DETECT STATE
    risk = await safety_service.assess_risk(user_message, user_id, db)
    if risk["override"]:
        yield {"emotion": "fear", "safe": False, "flow": "crisis", "flow_step": flow_step}
        yield risk["response"]
        return
    
    emotion = emotion_service.detect_emotion(user_message)["label"]
    event = detect_event(user_message)
    stage = get_stage(flow_step)
    
    last_bot = next((m for m in reversed(short_term) if m["role"] == "assistant"), None)
    last_bot_text = last_bot["content"] if last_bot else ""
    
    # 3. PROMPT
    system = prompt_builder.build_system_prompt(
        emotion=emotion,
        flow_stage=stage,
        turn_count=flow_step,
        memory_context=memory_context,
        recent_hashes=long_term.get("recent_response_hashes", []),
        user_message=user_message,
        event=event,
        last_bot_message=last_bot_text
    )
    messages = prompt_builder.build_messages(user_message, short_term, system)
    
    # 4. STREAM
    full_response = ""
    async for chunk in llm_service.generate_stream(messages):
        full_response += chunk
        yield chunk
        
    # 5. METADATA (Yielded at the end)
    yield {
        "emotion": emotion,
        "safe": risk.get("safe", True),
        "flow": stage,
        "flow_step": flow_step,
        "event": event,
        "final_response": full_response
    }
