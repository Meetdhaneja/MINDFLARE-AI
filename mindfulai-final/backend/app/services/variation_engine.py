import re, random
from typing import List, Optional, Dict
from difflib import SequenceMatcher

# Banned phrases that make responses robotic or clichéd
BANNED_PHRASES = [
    "what's on your mind",
    "tell me more",
    "how are you feeling",
    "i'm here for you",
    "you seem",
    "it seems like",
    "you might be",
    "perhaps you",
    "maybe you should",
    "have you tried",
    "why don't you",
    "you need to",
    "you should consider",
    "i think you",
    "in my experience",
    "generally speaking",
    "people often",
    "it's common to",
    "many people",
    "research shows",
    "studies suggest",
    "experts say",
    "it's important to",
    "you deserve",
    "give yourself credit",
    "be kind to yourself",
    "take care of yourself",
    "self-care",
    "self compassion",
    # Therapy clichés to avoid
    "stay positive",
    "everything will be okay",
    "just relax",
    "think positive",
    "look on the bright side",
    "silver lining",
    "it could be worse",
    "count your blessings",
    "be grateful",
    "chin up",
    "keep your head up",
    "hang in there",
    "this too shall pass",
    "time heals all wounds",
    "you're stronger than you think",
    "you've got this",
    "power through it",
    "push through",
    "tough it out",
    "ride it out",
    "weather the storm",
    "get over it",
    "move on",
    "let it go",
    "forgive and forget",
    "turn the page",
    "fresh start",
    "new beginning",
    "better days ahead",
    "rainbow after the storm",
]

STRIP = [re.compile(p, re.I) for p in [
    r"^(certainly|absolutely|of course|definitely|sure)[!,.]?\s*",
    r"^(great|fantastic|wonderful|excellent)[!,.]?\s*",
    r"\bas an ai\b", r"\bi('m| am) (here to help|designed to)\b",
    r"\b(i strongly )?(recommend|suggest|advise)\b",
    r"\byou should (try|consider)\b",
    r"\btake a deep breath\b",
    r"\bi understand how you feel\b",
    r"\bthat must be (really |very )?(hard|difficult|tough)\b",
    r"\baccording to (research|studies)\b",
    # Therapist-specific robotic language
    r"\bi('m| am) (here to|happy to) (help|listen|support)\b",
    r"\blet('s| us) (talk about|explore|discuss)\b",
    r"\bhow does that make you feel\b",
    r"\bcan you tell me more about\b",
    r"\bi('m| am) wondering if\b",
    r"\bit sounds like you('re| are)\b",
    r"\bhave you considered\b",
    r"\bwhat if you tried\b",
    r"\bperhaps it would help\b",
]]

OPENERS = [
    "Hmm…", "Yeah,", "That sounds", "Okay so…", "I'm noticing —",
    "God, that's a lot.", "I hear you.", "There's something in that —",
    "Yeah… honestly,", "I see.", "Something about what you said —",
    "That makes sense.", "I wonder if…", "It seems like…",
    "What I hear is…", "That sounds really…", "I'm curious about…",
    "There's something here —", "Yeah… I get that.", "That resonates.",
    "I can see how…", "That must feel…", "What stands out to me is…",
]

FALLBACK_QS = [
    "What do you think made it feel this intense?",
    "What's been feeling the heaviest about it?",
    "When did this start feeling this heavy?",
    "What does it feel like in your body when it spikes?",
    "What would even a little relief look like right now?",
    "Is there a specific moment that keeps coming back to you?",
    "Who in your life actually knows what's going on?",
    "What happens when you try to step back from it?",
    "I wonder what it would be like if that pressure eased a bit…",
    "What do you think might help right now, even if it's small?",
    "How does this connect to what you mentioned before?",
    "What feels most stuck about this situation?",
]

TONE_MODES = {
    "calm": {
        "openers": ["Hmm…", "Yeah,", "That sounds", "Okay so…", "I see."],
        "style": "Be calm and steady. Use gentle, measured language. Match low emotional intensity with slow, grounding presence.",
        "avoid": ["excited", "urgent", "intense", "rushed"]
    },
    "reflective": {
        "openers": ["I'm noticing —", "There's something in that —", "Something about what you said —", "What I hear is…", "I wonder if…"],
        "style": "Be deeply reflective. Identify emotion + situation first, then reflect clearly. Use soft language like 'it seems like', 'I might be wrong, but'.",
        "avoid": ["rushed", "superficial", "generic", "robotic"]
    },
    "supportive": {
        "openers": ["I hear you.", "That makes sense.", "Yeah… honestly,", "That resonates.", "I can see how…"],
        "style": "Be warmly supportive. Validate without agreeing with negative beliefs. Show consistent presence and gentle curiosity.",
        "avoid": ["clinical", "distant", "judgmental", "advice-giving"]
    },
    "curious": {
        "openers": ["I'm curious about…", "What stands out to me is…", "That sounds really…", "I wonder if…", "What do you think…"],
        "style": "Use gentle curiosity. Ask open-ended, meaningful questions. Guide don't instruct. One insight at a time.",
        "avoid": ["why questions", "probing too hard", "interrogating"]
    },
    "therapeutic": {
        "openers": ["Hmm…", "Yeah,", "That sounds", "I hear you.", "There's something in that —"],
        "style": "Therapist-style: reflect first, name feelings specifically, validate gently, end with meaningful question. Human tone with slight pauses.",
        "avoid": ["clichés", "advice dumping", "robotic language", "generic responses"]
    }
}

def fingerprint(text: str) -> str:
    words = text.lower().split()[:6]
    q = "Q" if "?" in text else "N"
    return "-".join(words) + f"-{q}"

def strip_robotic(text: str) -> str:
    for r in STRIP: text = r.sub("", text)
    return text.strip()

def check_banned_phrases(text: str) -> bool:
    """Check if response contains banned robotic phrases"""
    text_lower = text.lower()
    return any(phrase in text_lower for phrase in BANNED_PHRASES)

def semantic_similarity(text1: str, text2: str) -> float:
    """Calculate semantic similarity between two texts"""
    return SequenceMatcher(None, text1.lower(), text2.lower()).ratio()

def is_semantically_repetitive(text: str, history: List[Dict], threshold: float = 0.80) -> bool:
    """Check if text is semantically similar to last 3 bot messages"""
    bot_msgs = [m["content"] for m in reversed(history) if m["role"] == "assistant"][:3]
    for recent in bot_msgs:
        if semantic_similarity(text, recent) > threshold:
            return True
    return False

def enforce_response_rules(response: str, history: List[Dict]) -> str:
    """Production rules: Remove repeats, enforce 1 question max, ensure empathy."""
    # 1. Remove repeated sentences within the same response
    sentences = re.split(r"(?<=[.!?…])\s+", response.strip())
    unique_sentences = []
    seen = set()
    for s in sentences:
        s_clean = s.strip().lower()
        if s_clean not in seen:
            unique_sentences.append(s)
            seen.add(s_clean)
    response = " ".join(unique_sentences)

    # 2. Enforce Max 1 Question
    if response.count("?") > 1:
        parts = response.split("?")
        # Keep the first question, convert others to periods
        response = parts[0] + "?" + ".".join(parts[1:]).replace("..", ".")

    # 3. Ensure Empathy Prepend (If none detected in first 10 words)
    empathy_words = ["sounds", "understand", "feel", "pained", "heavy", "notice", "hear"]
    first_few = response.lower().split()[:10]
    if not any(w in first_few for w in empathy_words):
        openers = ["I hear you.", "That sounds really heavy.", "I can see how much that hurts.", "I'm here with you."]
        response = random.choice(openers) + " " + response

    return response.strip()

def dedup_starters(text: str) -> str:
    overused = ["it sounds like","it seems like","it looks like","it appears"]
    ALTS = ["Something in that suggests","I'm noticing","What I hear is","There's something here —","I wonder if"]
    sentences = re.split(r"(?<=[.!?…])\s+", text.strip())
    seen, result = set(), []
    for s in sentences:
        sl = s.lower()
        used = next((o for o in overused if sl.startswith(o)), None)
        if used and used in seen:
            s = random.choice(ALTS) + s[len(used):]
        if used: seen.add(used)
        result.append(s)
    return " ".join(result)

def ensure_question(text: str) -> str:
    if "?" in text: return text
    return text.rstrip(".") + " " + random.choice(FALLBACK_QS)

def starts_humanly(text: str) -> bool:
    human = ["yeah","hmm","mm","god,","okay so","that sounds","that's","there's","i see","i hear","i'm noticing","something","honestly","what"]
    return any(text.lower().strip().startswith(h) for h in human)

def inject_opener(text: str, tone: str = "supportive") -> str:
    """Inject human-like opener based on tone"""
    if starts_humanly(text): return text

    tone_config = TONE_MODES.get(tone, TONE_MODES["supportive"])
    opener = random.choice(tone_config["openers"])

    if text: text = text[0].lower() + text[1:]
    return f"{opener} {text}"

def is_repetitive(text: str, recent_hashes: List[str]) -> bool:
    return fingerprint(text) in recent_hashes

def select_tone(emotion: str, flow_stage: str) -> str:
    """Select appropriate therapist-style tone based on emotion and flow stage"""
    tone_map = {
        "anxiety": "calm",
        "fear": "calm",
        "stress": "calm",
        "overwhelm": "calm",
        "panic": "calm",
        "sadness": "supportive",
        "grief": "supportive",
        "loneliness": "supportive",
        "emptiness": "supportive",
        "shame": "supportive",
        "guilt": "supportive",
        "anger": "reflective",
        "frustration": "reflective",
        "irritation": "reflective",
        "stuck": "curious",
        "confused": "curious",
        "unsure": "curious",
        "neutral": "therapeutic",
        "happy": "therapeutic",
        "excited": "therapeutic",
    }

    emotion_key = (emotion or "neutral").lower()
    base_tone = tone_map.get(emotion_key, "therapeutic")

    if flow_stage in ["venting", "exploring"]:
        return base_tone if base_tone in ["calm", "supportive"] else "reflective"
    elif flow_stage in ["guiding", "suggesting"]:
        return "curious" if base_tone == "therapeutic" else base_tone

    return base_tone

def humanize(raw: str, recent_responses: Optional[List[str]] = None,
             recent_hashes: Optional[List[str]] = None,
             emotion: str = "neutral", flow_stage: str = "venting",
             add_opener: bool = True) -> str:
    """Advanced humanization with tone awareness and repetition checking"""

    if check_banned_phrases(raw):
        return None  # Signal to regenerate

    if recent_responses and is_semantically_repetitive(raw, recent_responses):
        return None  # Signal to regenerate

    tone = select_tone(emotion, flow_stage)
    text = strip_robotic(raw)
    text = dedup_starters(text)

    if add_opener:
        text = inject_opener(text, tone)

    text = ensure_question(text)

    if recent_hashes and is_repetitive(text, recent_hashes):
        return None  # Signal to regenerate

    return text.strip()
