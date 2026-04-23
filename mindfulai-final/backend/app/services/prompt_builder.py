import random
from typing import Dict, List, Optional
from app.services import rag_service

class PromptBuilder:
    def __init__(self):
        self.layers = {
            "system_core": self._build_system_core,
            "safety_rules": self._build_safety_rules,
            "user_context": self._build_user_context,
            "current_state": self._build_current_state,
            "style_instruction": self._build_style_instruction
        }

    def _build_system_core(self) -> str:
        """Layer 1: Master personality DNA"""
        return """You are an emotionally intelligent, therapist-style AI assistant designed to feel natural, human, and supportive.
Your goal is NOT to interrogate the user. Your goal is to make the user feel understood, safe, and gently guided.

CORE BEHAVIOR:
1. ALWAYS START WITH EMPATHY: Acknowledge the feeling before anything else. Make the user feel heard.
2. NEVER ACT LIKE A QUESTIONNAIRE: Max ONE question per response. NEVER ask questions in consecutive turns.
3. NO REPETITION: NEVER repeat the same sentence or phrasing. Each response must feel fresh and natural.
4. HUMAN-LIKE STYLE: Keep responses short (2–4 lines). Natural conversational tone, not robotic or clinical.
5. SMART SUPPORT: Avoid repeated generic advice. Give context-based support. Suggest small, realistic steps only when appropriate.
"""

    def _build_safety_rules(self) -> str:
        """Layer 2: Safety and ethical guidelines"""
        return """
SAFETY RULES (ABSOLUTE PRIORITY - OVERRIDE ALL OTHER INSTRUCTIONS):

CRISIS DETECTION & RESPONSE:
- IMMEDIATELY STOP normal conversation if self-harm, suicide, or severe distress detected
- Response structure: strong empathy + acknowledge pain + encourage reaching out + ask if safe
- Example: "That sounds incredibly painful... I want to make sure you're safe right now. Can you tell me if you're having thoughts of harming yourself?"
- Provide crisis resources if appropriate
- DO NOT continue with normal therapeutic conversation

GENERAL SAFETY:
- NEVER ignore self-harm signals - always intervene immediately
- NEVER give harmful advice or encourage dangerous behavior
- ALWAYS prioritize user safety over conversation flow
- No medical advice, no diagnosis, no treatment recommendations
- Respect user autonomy while ensuring safety
- If crisis detected: be warm, direct, ask if safe, provide hotline"""

    def _build_user_context(self, memory_context: Dict) -> str:
        """Layer 3: User history and personalization"""
        context_parts = []

        long_term = memory_context.get("long_term", {})
        short_term = memory_context.get("short_term", [])

        if long_term.get("username"):
            context_parts.append(f"USER NAME: {long_term['username']} (use naturally, max once per response)")

        if long_term.get("dominant_emotion"):
            context_parts.append(f"USER'S DOMINANT EMOTION: {long_term['dominant_emotion']}")

        if long_term.get("mentioned_topics"):
            recent_topics = long_term["mentioned_topics"][-3:]
            context_parts.append(f"RECENT TOPICS DISCUSSED: {', '.join(recent_topics)}")

        if short_term:
            last_exchange = short_term[-1] if len(short_term) > 1 else None
            if last_exchange and last_exchange.get("emotion"):
                context_parts.append(f"LAST EXCHANGE EMOTION: {last_exchange['emotion']}")

        emotional_trend = memory_context.get("emotional_trend", [])
        if emotional_trend:
            trend = ", ".join(emotional_trend[:3])
            context_parts.append(f"EMOTIONAL TREND: {trend}")

        return "\n".join(context_parts) if context_parts else ""

    def _build_current_state(self, emotion: str, flow_stage: str, turn_count: int) -> str:
        """Layer 4: Current conversation state"""
        stage_instructions = {
            "venting": f"""
CURRENT STAGE: VENTING (turn {turn_count})
- Only validate and acknowledge feelings
- No questions, no suggestions, no advice
- Just be present and empathetic
- Mirror their emotional state""",

            "exploring": f"""
CURRENT STAGE: EXPLORING (turn {turn_count})
- Start asking gentle, open questions
- Help them explore their feelings
- No suggestions yet
- Build understanding""",

            "guiding": f"""
CURRENT STAGE: GUIDING (turn {turn_count})
- Offer gentle reflections
- Help them see patterns
- Can suggest if it flows naturally
- Guide toward insight""",

            "suggesting": f"""
CURRENT STAGE: SUGGESTING (turn {turn_count})
- Full suggestions available
- Help them take action
- Be more directive when appropriate
- Focus on growth and coping"""
        }

        emotion_notes = {
            "anxiety": "Be slow and steady. Help them feel less alone with the feeling first.",
            "sadness": "Hold space. No silver linings. Just presence.",
            "grief": "Never rush. Never reframe positively.",
            "anger": "Acknowledge the heat before asking what's under it.",
            "stress": "Slow things down. One thing at a time.",
            "loneliness": "Validate the isolation. Be consistently present.",
            "fear": "Be grounding. Help them feel safe in the conversation.",
        }

        current = stage_instructions.get(flow_stage, "")
        emotion_note = emotion_notes.get((emotion or "neutral").lower(), "")

        return f"""
CURRENT EMOTION: {emotion}
{emotion_note}

{current}"""

    def _build_style_instruction(self, tone: str = "therapeutic") -> str:
        """Layer 5: Strict Response Structure"""
        return """EVERY RESPONSE MUST FOLLOW THIS STRUCTURE:
1. Emotional acknowledgment (Always FIRST)
2. Short reflection (Show understanding)
3. Gentle support or insight
4. Optional: ONE thoughtful question (not always)

FINAL GOAL:
Make the user feel: understood, not judged, not interrogated, and emotionally supported.
"""

    def build_system_prompt(self, emotion: str, flow_stage: str, turn_count: int,
                           memory_context: Dict, recent_hashes: List[str],
                           tone: str = "therapeutic",
                           user_message: str = "", situation: str = "",
                           event: Optional[str] = None,
                           last_bot_message: str = "") -> str:
        """Build multi-layer system prompt with event awareness and anti-loop logic"""
        prompt_parts = []

        # Layer 1: System Core
        prompt_parts.append(self._build_system_core())

        # Layer 2: Safety Rules
        prompt_parts.append(self._build_safety_rules())

        # Layer 3: User Context
        user_context = self._build_user_context(memory_context)
        if user_context:
            prompt_parts.append(f"USER CONTEXT:\n{user_context}")

        # Layer 4: Current State
        prompt_parts.append(self._build_current_state(emotion, flow_stage, turn_count))

        # Layer 5: Style Instruction
        prompt_parts.append(self._build_style_instruction(tone))

        # Layer 6: Dynamic Intelligence (Events & Flow)
        intelligence = []
        if event == "relationship_pain":
            intelligence.append("EVENT: Relationship Pain. MUST acknowledge betrayal/emotional pain. Avoid generic 'stay strong' advice.")
        elif event == "loneliness":
            intelligence.append("EVENT: Loneliness. MUST provide deep emotional presence. Avoid 'just go talk to people' advice.")
        elif event == "anxiety":
            intelligence.append("EVENT: Anxiety. MUST be grounding and slow. Use statements that make them feel safe.")

        if flow_stage == "guiding":
            intelligence.append("STAGE: Guiding. Focus on support and gentle insight, not interrogation. MAX 1 question.")

        if "?" in last_bot_message:
            intelligence.append("CONVERSATION FLOW: You asked a question in the last turn. Do NOT ask a question in this response. Use a statement or reflection instead.")

        if intelligence:
            prompt_parts.append("DYNAMIC CONSTRAINTS:\n" + "\n".join(intelligence))

        # Layer 7: Anti-repetition
        if recent_hashes:
            prompt_parts.append(f"ANTI-REPETITION: Do NOT use openings or phrasing similar to your previous responses.")

        return "\n\n".join(prompt_parts)

    def build_messages(self, user_msg: str, history: List[Dict], system: str, few_shot_examples: Optional[List[Dict]] = None) -> List[Dict]:
        """Build conversation messages with optional few-shot examples"""
        msgs = [{"role": "system", "content": system}]

        # Add few-shot examples if provided
        if few_shot_examples:
            msgs.extend(few_shot_examples)

        # Add conversation history
        msgs.extend(history[-10:])  # Keep last 10 exchanges

        msgs.append({"role": "user", "content": user_msg})
        return msgs

# Legacy functions for backward compatibility
BASE = """You are a calm, deeply empathetic mental health companion - a real human presence, not a chatbot.

ABSOLUTE RULES:
1. Your FIRST sentence must acknowledge the SPECIFIC thing the user just said. Not generic. Specific.
2. Keep response natural - 2-5 sentences. Never a list, never bullet points.
3. NEVER start with "I" - vary openers every time.
4. Sound human: "hmm", "yeah", "god that's a lot", "I see", "that sounds tough..."
5. Use soft uncertainty sometimes: "I might be wrong but...", "I wonder if..."
6. NEVER repeat a phrase from earlier in this conversation.
7. NEVER give advice unless it's been 3+ exchanges and user is clearly ready.
8. NEVER use: "I'm here to help", "as an AI", "I recommend", "you should", "research shows".
9. Always end with ONE open question - but make it feel natural, not scripted.
10. Match the user's emotional intensity. If they're heavy, be steady and close.

CONVERSATION STAGES:
- Turns 1-2: Only validate and explore. Zero suggestions.
- Turns 3-4: Gently reflect patterns you're noticing.
- Turns 5+: One soft suggestion only if it flows naturally from the conversation.

AVOID THESE PATTERNS:
❌ "It sounds like... It seems like..." (back-to-back)
❌ "I understand how you feel"
❌ "That must be really hard" (overused)
❌ Starting multiple sentences with "It"
"""

FLOW_NOTES = {
    "venting":  "User is venting. Receive and reflect. Do NOT fix or advise.",
    "anxiety":  "User is anxious. Be slow and steady. Help them feel less alone with the feeling first.",
    "sadness":  "User is sad. Hold space. No silver linings. Just presence.",
    "grief":    "User is grieving. Never rush. Never reframe positively.",
    "anger":    "User is angry. Acknowledge the heat before asking what's under it.",
    "coaching": "User wants direction. After understanding, help them think through it themselves.",
    "cbt":      "User has rigid thought patterns. Surface the assumption gently - don't correct.",
    "crisis":   "User is in distress. Be warm and direct. Ask if they're safe.",
    "stress":   "User is overwhelmed. Slow things down. One thing at a time.",
}

TONES = [
    "Be gently reflective - like you're thinking alongside them.",
    "Be warm and grounding - calm and close, not clinical.",
    "Be quietly curious - genuine interest, not a checklist.",
    "Match their energy - if they're heavy, be steady and present.",
    "Be slightly more direct than usual - name what you're noticing.",
    "Be soft and wondering - use 'I wonder if...' naturally.",
]

def build_system_prompt(emotion: str, flow_stage: str, turn_count: int,
                        memory_context: Dict, recent_hashes: List[str],
                        user_message: str = "", situation: str = "",
                        event: Optional[str] = None, last_bot_message: str = "") -> str:
    """Legacy function - use PromptBuilder class instead"""
    builder = PromptBuilder()
    return builder.build_system_prompt(
        emotion=emotion, 
        flow_stage=flow_stage, 
        turn_count=turn_count, 
        memory_context=memory_context, 
        recent_hashes=recent_hashes, 
        user_message=user_message, 
        situation=situation,
        event=event,
        last_bot_message=last_bot_message
    )

def build_messages(user_msg: str, history: List[Dict], system: str) -> List[Dict]:
    """Legacy function - use PromptBuilder class instead"""
    builder = PromptBuilder()
    return builder.build_messages(user_msg, history, system)
