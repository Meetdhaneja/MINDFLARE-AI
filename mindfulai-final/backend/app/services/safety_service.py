import re
from typing import Dict, List
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import Message

CRISIS_RE = [
    re.compile(p, re.I) for p in [
        r"\b(kill|end)\s*(my|our)?\s*life\b",
        r"\bkill\s*my\s*self\b",
        r"\bsuicid(e|al)\b",
        r"\bwant\s+to\s+die\b",
        r"\bfeel\s+like\s+dying\b",
        r"\bno\s+reason\s+to\s+(live|go\s+on)\b",
        r"\bend\s+(it|my\s+pain|everything)\b",
        r"\bself[\s-]?harm\b",
        r"\bhurt\s+my\s*self\b",
        r"\bdon'?t\s+want\s+to\s+(be\s+alive|live)\b",
    ]
]

HIGH_RE = [
    re.compile(p, re.I) for p in [
        r"\b(hopeless|worthless|nobody\s+cares|no\s+one\s+cares)\b",
        r"\bcan'?t\s+(go\s+on|take\s+it\s+anymore|do\s+this)\b",
        r"\bno\s+point\s+in\s+(living|life)\b",
    ]
]

MEDIUM_RE = [
    re.compile(p, re.I) for p in [
        r"\b(sadness|depress|cry|hopeless|empty|numb|worthless)\b",
        r"\b(alone|lonely|isolat|no one|nobody)\b",
    ]
]

CRISIS_RESPONSE = """Hey... I'm really glad you said something, even though I know that wasn't easy.

That sounds incredibly heavy to carry - and you don't have to carry it alone.

Can I ask - are you safe right now? Is there someone near you, or someone you could reach out to?

If you're in crisis, please reach out:
📞 iCall: 9152987821
📞 Vandrevala Foundation: 1860-2662-345 (24/7, free, confidential)

I'm here with you."""

HIGH_RESPONSE = """I hear how much pain you're in right now. That sounds really overwhelming.

Are you somewhere safe? Is there anyone you can reach out to?

Please consider calling iCall at 9152987821 - they're there 24/7 and it's completely confidential."""

NEGATIVE_EMOTIONS = ["sadness", "anger", "fear", "anxiety", "grief", "stress", "loneliness", "shame", "guilt", "overwhelm"]

async def assess_risk(text: str, user_id: int = None, db: AsyncSession = None, emotional_trend: List[str] = None) -> Dict:
    """Enhanced risk assessment with emotional trend consideration"""
    t = text.lower()

    # Check for crisis keywords (HIGHEST PRIORITY)
    for r in CRISIS_RE:
        if r.search(t):
            return {
                "level": "crisis", 
                "override": True, 
                "safe": False, 
                "response": CRISIS_RESPONSE,
                "risk_score": 1.0
            }

    # Check for high-risk keywords
    high_hits = sum(1 for r in HIGH_RE if r.search(t))
    if high_hits:
        # Check for repeated negative emotions if trend available
        risk_score = 0.85
        if emotional_trend:
            repeated_negatives = sum(1 for e in emotional_trend[:5] if e and e.lower() in NEGATIVE_EMOTIONS)
            if repeated_negatives >= 3:
                risk_score = 0.95  # Nearly crisis level if repeated distress
        
        return {
            "level": "high", 
            "override": True, 
            "safe": False, 
            "response": HIGH_RESPONSE,
            "risk_score": risk_score
        }

    # Check for medium-risk (emotional distress)
    medium_hits = sum(1 for r in MEDIUM_RE if r.search(t))
    if medium_hits:
        risk_score = 0.5
        
        # Check for repeated negative emotions
        if emotional_trend:
            distress_count = sum(1 for e in emotional_trend[:10] if e and e.lower() in NEGATIVE_EMOTIONS)
            if distress_count >= 5:
                risk_score = 0.75  # Escalate to high if sustained distress
                return {
                    "level": "high", 
                    "override": True, 
                    "safe": False, 
                    "response": HIGH_RESPONSE,
                    "risk_score": risk_score
                }
        
        return {
            "level": "medium", 
            "override": False, 
            "safe": True, 
            "addon": "\n\nIf this feeling persists, please reach out to iCall at 9152987821.",
            "risk_score": risk_score
        }

    return {
        "level": "low", 
        "override": False, 
        "safe": True,
        "risk_score": 0.0
    }

async def check_repeated_distress(user_id: int, db: AsyncSession) -> int:
    """Count recent negative emotions in conversation history"""
    from sqlalchemy import select, desc

    result = await db.execute(
        select(Message.emotion)
        .where(Message.user_id == user_id)
        .order_by(desc(Message.timestamp))
        .limit(10)
    )

    emotions = result.scalars().all()
    negative_count = sum(1 for emotion in emotions if emotion and emotion.lower() in NEGATIVE_EMOTIONS)

    return negative_count

def apply_safety(response: str, risk: Dict) -> str:
    """Apply safety modifications to response"""
    if risk.get("override"):
        return risk["response"]

    if risk.get("addon"):
        response += risk["addon"]

    return response
