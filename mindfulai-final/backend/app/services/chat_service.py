import re, logging
from typing import Dict, Tuple, List, AsyncGenerator
from app.core.config import settings
from app.services import safety_service, emotion_service, memory_service
from app.services import prompt_builder, variation_engine, suggestion_service, llm_service

log = logging.getLogger(__name__)

FLOW_PATTERNS = {
    "anxiety":  re.compile(r"\b(anxious|panic|worry|overwhelmed|nervous|what if)\b", re.I),
    "sadness":  re.compile(r"\b(sad|depress|cry|hopeless|empty|numb|worthless)\b", re.I),
    "grief":    re.compile(r"\b(lost|miss|grief|gone|passed away|death|mourning)\b", re.I),
    "anger":    re.compile(r"\b(angry|furious|hate|rage|frustrated|mad|resentment)\b", re.I),
    "stress":   re.compile(r"\b(stress|overwhelm|too much|exhausted|burnout|deadline)\b", re.I),
    "coaching": re.compile(r"\b(what should i|help me decide|how do i|need advice)\b", re.I),
    "cbt":      re.compile(r"\b(i always|i never|i'm a failure|nothing works|everyone hates)\b", re.I),
}

def detect_flow(text: str, current: str = "venting") -> str:
    for flow, pat in FLOW_PATTERNS.items():
        if pat.search(text):
            return flow
    return current

def get_stage(turn_count: int) -> str:
    """Determine conversation stage based on turn count"""
    if turn_count <= 2:
        return "venting"
    elif turn_count <= 5:
        return "exploring"
    elif turn_count <= 8:
        return "guiding"
    else:
        return "suggesting"

def next_step(step: int, text: str) -> int:
    openers = ["i think", "i feel", "i've been", "the reason", "because", "ever since", "what really"]
    if any(o in text.lower() for o in openers):
        return min(step + 1, 5)
    return step

def quality_ok(response: str, recent_hashes: List[str]) -> bool:
    if len(response.split()) < 10: return False
    if "?" not in response: return False
    if variation_engine.is_repetitive(response, recent_hashes): return False
    return True

async def run_pipeline(user_id: int, session_id: str, user_message: str, db,
                       flow_step: int = 0, flow_type: str = "venting") -> Tuple[str, Dict]:
    """
    Enhanced chat pipeline with memory layers, flow stages, and risk assessment.
    
    Flow: User Input → Load Memory → Detect Risk → If safe → Detect Emotion → 
          Determine Stage → Build Prompt → Generate Response → Apply Variation → 
          Apply Suggestions → Save
    """
    
    # 1. LOAD MEMORY LAYERS
    memory_layer = memory_service.MemoryLayer()
    memory_context = await memory_layer.get_memory_context(user_id, session_id, db)
    short_term = memory_context["short_term"]
    long_term = memory_context["long_term"]
    emotional_trend = memory_context["emotional_trend"]
    
    # 2. DETECT RISK (with emotional trend)
    risk = await safety_service.assess_risk(
        user_message, 
        user_id, 
        db, 
        emotional_trend=emotional_trend
    )
    
    # OVERRIDE: If crisis, return immediately
    if risk["override"]:
        return risk["response"], {
            "emotion": "fear", 
            "safe": False, 
            "flow": "crisis", 
            "flow_step": flow_step, 
            "suggestion": None,
            "risk_score": risk.get("risk_score", 1.0)
        }
    
    # 3. DETECT EMOTION
    em = emotion_service.detect_emotion(user_message)
    detected_emotion = em["label"]
    
    # 4. DETERMINE FLOW STAGE (using new get_stage function)
    conversation_stage = get_stage(flow_step)
    
    # 5. SELECT TONE based on emotion and stage
    tone = variation_engine.select_tone(detected_emotion, conversation_stage)
    
    # 6. BUILD PROMPT WITH ALL LAYERS
    system = prompt_builder.build_system_prompt(
        emotion=detected_emotion,
        flow_stage=conversation_stage,
        turn_count=flow_step,
        memory_context=memory_context,
        recent_hashes=long_term.get("recent_response_hashes", []),
        tone=tone,
        user_message=user_message
    )
    
    # Build conversation messages
    messages = prompt_builder.build_messages(user_message, short_term, system)
    
    # 7. GENERATE RESPONSE with regen loop
    raw, attempts = "", 0
    while attempts < settings.MAX_REGEN_ATTEMPTS:
        raw = await llm_service.generate(messages)
        
        # Check quality: minimum length, has question, not repetitive, no banned phrases
        if (len(raw.split()) >= 10 and 
            "?" in raw and 
            not variation_engine.is_repetitive(raw, long_term.get("recent_response_hashes", [])) and
            not variation_engine.check_banned_phrases(raw)):
            break
        
        # Add anti-repetition instruction
        messages[0]["content"] += "\n\nIMPORTANT: Completely different wording and structure this time."
        attempts += 1
    
    # 8. APPLY VARIATION ENGINE (humanization + tone)
    humanized = variation_engine.humanize(
        raw, 
        recent_responses=None,
        recent_hashes=long_term.get("recent_response_hashes", []),
        emotion=detected_emotion,
        flow_stage=conversation_stage,
        add_opener=True
    )
    
    # If humanize returns None (deemed too repetitive), use raw with safety wrap
    if humanized is None:
        humanized = raw
    
    # 9. APPLY SAFETY OVERLAY
    final = safety_service.apply_safety(humanized, risk)
    
    # 10. APPLY SUGGESTION ENGINE (only if allowed by stage)
    suggestion = None
    if conversation_stage in ["guiding", "suggesting"]:
        suggestion = suggestion_service.get_suggestion(
            emotion=detected_emotion,
            flow_stage=conversation_stage,
            turn_count=flow_step,
            recent=long_term.get("recent_suggestions", []),
            liked=long_term.get("liked_suggestions", []),
            rejected=long_term.get("rejected_suggestions", []),
            min_step=settings.MIN_TURNS_BEFORE_SUGGESTION
        )
    
    # 11. UPDATE MEMORY
    await memory_service.update_profile(
        user_id=user_id,
        db=db,
        user_message=user_message,
        emotion=detected_emotion,
        flow_type=conversation_stage,
        new_suggestion=suggestion.title if suggestion else None,
        response_hash=variation_engine.fingerprint(final)
    )
    
    return final, {
        "emotion": detected_emotion,
        "emotion_emoji": em.get("emoji", "💭"),
        "emotion_color": em.get("color", "#6B7280"),
        "safe": risk.get("safe", True),
        "risk_score": risk.get("risk_score", 0.0),
        "flow": conversation_stage,
        "flow_step": flow_step,
        "suggestion": suggestion,
        "tone": tone,
        "emotional_stability": memory_context.get("emotional_stability", "neutral")
    }

async def run_pipeline_stream(user_id: int, session_id: str, user_message: str, db,
                             flow_step: int = 0, flow_type: str = "venting") -> AsyncGenerator:
    """Streaming version of the chat pipeline"""

    # 1. Crisis gate
    risk = await safety_service.assess_risk(user_message, user_id=user_id, db=db)
    if risk["override"]:
        yield {"emotion": "fear", "safe": False, "flow": "crisis", "flow_step": flow_step, "suggestion": None}
        yield risk["response"]
        return

    # 2. Load context
    history = await memory_service.load_history(user_id, session_id, db, settings.HISTORY_WINDOW)
    profile = await memory_service.get_profile(user_id, db)
    recent_hashes = profile.get("recent_response_hashes", [])

    # 3. Emotion + flow
    em = emotion_service.detect_emotion(user_message)
    new_flow = detect_flow(user_message, flow_type)
    new_step = next_step(flow_step, user_message)

    # 4. Prompt
    system = prompt_builder.build_system_prompt(
        emotion=em["label"], flow_type=new_flow, flow_step=new_step,
        profile=profile, recent_hashes=recent_hashes,
        min_suggest_step=settings.MIN_TURNS_BEFORE_SUGGESTION,
        user_message=user_message, situation=new_flow
    )
    messages = prompt_builder.build_messages(user_message, history, system)

    # 5. LLM streaming + regen loop
    raw_chunks = []
    attempts = 0
    full_response = ""

    while attempts < settings.MAX_REGEN_ATTEMPTS:
        raw_chunks = []
        async for chunk in llm_service.generate_stream(messages):
            raw_chunks.append(chunk)
            full_response += chunk
            yield chunk  # Stream the chunk immediately

        # Check quality after streaming
        if quality_ok(full_response, recent_hashes):
            break

        # If not good, regenerate with different prompt
        messages[0]["content"] += "\n\nIMPORTANT: Use completely different wording and structure than before."
        attempts += 1
        full_response = ""  # Reset for next attempt

    # 6. Humanize + safety overlay (applied after streaming)
    humanized = variation_engine.humanize(full_response, recent_hashes=recent_hashes, add_opener=(attempts == 0))
    final = safety_service.apply_safety(humanized, risk)

    # 7. Suggestion (delayed)
    suggestion = suggestion_service.get_suggestion(
        emotion=em["label"], flow_stage=new_flow, turn_count=new_step,
        recent=profile.get("recent_suggestions", []),
        liked=profile.get("liked_suggestions", []),
        rejected=profile.get("rejected_suggestions", []),
        min_step=settings.MIN_TURNS_BEFORE_SUGGESTION,
    )

    # 8. Yield metadata after streaming is complete
    yield {
        "emotion": em["label"],
        "emotion_emoji": em["emoji"],
        "emotion_color": em["color"],
        "safe": risk.get("safe", True),
        "flow": new_flow,
        "flow_step": new_step,
        "suggestion": suggestion,
        "final_response": final  # Include the processed final response
    }

    # 9. Update memory (background task)
    await memory_service.update_profile(
        user_id=user_id, db=db, user_message=user_message,
        emotion=em["label"], flow_type=new_flow,
        new_suggestion=suggestion.title if suggestion else None,
        response_hash=variation_engine.fingerprint(final),
    )
