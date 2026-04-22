from typing import Dict, List, Optional
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.exc import OperationalError
from app.models.models import UserProfile, Message

TOPICS = {
    "work stress":       ["job","boss","career","coworker","fired","promotion","workplace","deadline","office"],
    "relationship":      ["partner","boyfriend","girlfriend","spouse","breakup","dating","ex","marriage"],
    "family conflict":   ["mom","dad","parent","sibling","brother","sister","family","toxic home"],
    "academic pressure": ["exam","study","university","college","grade","assignment","professor"],
    "sleep issues":      ["sleep","insomnia","tired","exhausted","can't sleep","waking up","nightmares"],
    "social anxiety":    ["friends","social","party","judgment","awkward","rejected","embarrassed"],
    "financial stress":  ["money","debt","bills","afford","broke","rent","loan"],
    "loneliness":        ["alone","lonely","no one","isolated","no friends","nobody understands"],
    "overthinking":      ["overthink","spiral","can't stop thinking","going in circles","mind racing"],
    "grief":             ["loss","died","passed away","grieving","miss them","death"],
    "health anxiety":    ["sick","symptom","doctor","illness","pain","hospital","disease"],
    "identity crisis":   ["who am i","purpose","meaning","lost","direction","identity"],
}

class MemoryLayer:
    def __init__(self):
        self.short_term_window = 5
        self.long_term_window = 50
        self.emotion_trend_window = 10

    async def get_short_term_memory(self, user_id: int, session_id: str, db: AsyncSession) -> List[Dict]:
        """Last 5 messages for immediate context"""
        r = await db.execute(
            select(Message)
            .where(Message.user_id == user_id, Message.session_id == session_id)
            .order_by(desc(Message.timestamp))
            .limit(self.short_term_window)
        )
        msgs = list(reversed(r.scalars().all()))
        return [{"role": m.role if m.role == "user" else "assistant", "content": m.content, "emotion": m.emotion} for m in msgs]

    async def get_long_term_memory(self, user_id: int, db: AsyncSession) -> Dict:
        """User profile and patterns"""
        r = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
        p = r.scalar_one_or_none()
        if not p:
            return {}

        return {
            "username": p.username or "",
            "common_issues": p.common_issues or [],
            "mentioned_topics": p.mentioned_topics or [],
            "liked_suggestions": p.liked_suggestions or [],
            "rejected_suggestions": p.rejected_suggestions or [],
            "recent_suggestions": p.recent_suggestions or [],
            "recent_response_hashes": p.recent_response_hashes or [],
            "dominant_emotion": p.dominant_emotion or "neutral",
            "session_count": p.session_count or 0,
            "total_messages": p.total_messages or 0,
        }

    async def get_emotional_trend(self, user_id: int, db: AsyncSession) -> List[str]:
        """Last 10 emotions for trend analysis"""
        r = await db.execute(
            select(Message.emotion)
            .where(Message.user_id == user_id, Message.emotion.isnot(None))
            .order_by(desc(Message.timestamp))
            .limit(self.emotion_trend_window)
        )
        return [e for e in r.scalars().all() if e]

    async def get_memory_context(self, user_id: int, session_id: str, db: AsyncSession) -> Dict:
        """Get all memory layers in structured format"""
        short_term = await self.get_short_term_memory(user_id, session_id, db)
        long_term = await self.get_long_term_memory(user_id, db)
        emotional_trend = await self.get_emotional_trend(user_id, db)

        return {
            "short_term": short_term,
            "long_term": long_term,
            "emotional_trend": emotional_trend,
            "context_summary": self._summarize_context(short_term, long_term, emotional_trend),
            "current_emotional_state": emotional_trend[0] if emotional_trend else "neutral",
            "emotional_stability": self._assess_emotional_stability(emotional_trend),
        }
    
    def _assess_emotional_stability(self, emotional_trend: List[str]) -> str:
        """Assess if emotions are stable or fluctuating"""
        if not emotional_trend or len(emotional_trend) < 3:
            return "neutral"
        
        recent = emotional_trend[:5]
        unique_emotions = len(set(recent))
        
        if unique_emotions == 1:
            return "stable"
        elif unique_emotions >= 4:
            return "fluctuating"
        else:
            return "variable"

    def _summarize_context(self, short_term: List[Dict], long_term: Dict, emotional_trend: List[str]) -> str:
        """Create a human-readable context summary"""
        summary_parts = []

        if long_term.get("username"):
            summary_parts.append(f"User: {long_term['username']}")

        if long_term.get("dominant_emotion"):
            summary_parts.append(f"Dominant emotion: {long_term['dominant_emotion']}")

        if emotional_trend:
            recent_emotions = emotional_trend[:3]
            summary_parts.append(f"Recent emotions: {', '.join(recent_emotions)}")

        if long_term.get("mentioned_topics"):
            topics = long_term["mentioned_topics"][-3:]
            summary_parts.append(f"Recent topics: {', '.join(topics)}")

        return " | ".join(summary_parts) if summary_parts else ""

def extract_topics(text: str) -> List[str]:
    tl = text.lower()
    return [t for t, kws in TOPICS.items() if any(k in tl for k in kws)]

async def get_profile(user_id: int, db: AsyncSession) -> Dict:
    """Legacy function - use MemoryLayer instead"""
    memory = MemoryLayer()
    return await memory.get_long_term_memory(user_id, db)

async def load_history(user_id: int, session_id: str, db: AsyncSession, window: int = 10) -> List[Dict]:
    """Legacy function - use MemoryLayer instead"""
    memory = MemoryLayer()
    return await memory.get_short_term_memory(user_id, session_id, db)

async def update_profile(user_id: int, db: AsyncSession, user_message: str,
                         emotion: str = None, flow_type: str = None,
                         new_suggestion: str = None, response_hash: str = None):
    r = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    p = r.scalar_one_or_none()
    if not p:
        p = UserProfile(user_id=user_id)
        db.add(p)

    topics = extract_topics(user_message)
    if topics:
        ex = p.mentioned_topics or []
        for t in topics:
            if t not in ex: ex.append(t)
        p.mentioned_topics = ex[-15:]

    if emotion:
        p.dominant_emotion = emotion
        issues = p.common_issues or []
        if emotion not in issues and emotion != "neutral":
            issues.append(emotion)
        p.common_issues = issues[-10:]

    if flow_type:
        p.preferred_flow = flow_type
    if new_suggestion:
        rec = p.recent_suggestions or []
        rec.append(new_suggestion)
        p.recent_suggestions = rec[-10:]
    if response_hash:
        hashes = p.recent_response_hashes or []
        hashes.append(response_hash)
        p.recent_response_hashes = hashes[-5:]

    p.total_messages = (p.total_messages or 0) + 1
    for attempt in range(3):
        try:
            await db.flush()
            break
        except OperationalError as e:
            if "database is locked" in str(e).lower() and attempt < 2:
                await db.rollback()
                await asyncio.sleep(0.2 * (attempt + 1))
                r = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
                p = r.scalar_one_or_none()
                if not p:
                    p = UserProfile(user_id=user_id)
                    db.add(p)

                topics = extract_topics(user_message)
                if topics:
                    ex = p.mentioned_topics or []
                    for t in topics:
                        if t not in ex:
                            ex.append(t)
                    p.mentioned_topics = ex[-15:]

                if emotion:
                    p.dominant_emotion = emotion
                    issues = p.common_issues or []
                    if emotion not in issues and emotion != "neutral":
                        issues.append(emotion)
                    p.common_issues = issues[-10:]

                if flow_type:
                    p.preferred_flow = flow_type
                if new_suggestion:
                    rec = p.recent_suggestions or []
                    rec.append(new_suggestion)
                    p.recent_suggestions = rec[-10:]
                if response_hash:
                    hashes = p.recent_response_hashes or []
                    hashes.append(response_hash)
                    p.recent_response_hashes = hashes[-5:]

                p.total_messages = (p.total_messages or 0) + 1
                continue
            raise

async def update_suggestion_pref(user_id: int, db: AsyncSession, title: str, liked: bool):
    r = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    p = r.scalar_one_or_none()
    if not p: return
    if liked:
        ll = p.liked_suggestions or []
        if title not in ll: ll.append(title)
        p.liked_suggestions = ll[-20:]
        p.rejected_suggestions = [x for x in (p.rejected_suggestions or []) if x != title]
    else:
        rl = p.rejected_suggestions or []
        if title not in rl: rl.append(title)
        p.rejected_suggestions = rl[-20:]
    await db.flush()

async def increment_session(user_id: int, db: AsyncSession):
    r = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    p = r.scalar_one_or_none()
    if p:
        p.session_count = (p.session_count or 0) + 1
        await db.flush()
