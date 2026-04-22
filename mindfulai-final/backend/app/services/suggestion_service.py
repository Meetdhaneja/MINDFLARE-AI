import random
from typing import Optional, List, Dict
from app.schemas.schemas import SuggestionOut

POOL: Dict[str, List[Dict]] = {
    "anxiety": [
        {"title":"5-4-3-2-1 Grounding","description":"Name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste. Anchors you instantly.","category":"grounding","emotion":"anxiety"},
        {"title":"Box Breathing","description":"Inhale 4 counts, hold 4, exhale 4, hold 4. Repeat 4 times. Directly calms the nervous system.","category":"breathing","emotion":"anxiety"},
        {"title":"Write the Worry Out","description":"Dump every anxious thought onto paper unfiltered. Once outside your head, it loses grip.","category":"journaling","emotion":"anxiety"},
        {"title":"Worry Window","description":"Schedule 15 minutes to worry intentionally. Outside it, postpone every anxious thought.","category":"cbt","emotion":"anxiety"},
        {"title":"10-Minute Walk","description":"Outside, no destination. Not for fitness - just to shift your nervous system state.","category":"physical","emotion":"anxiety"},
        {"title":"Cold Water Reset","description":"Splash cold water on your face. Triggers the dive reflex and slows heart rate fast.","category":"somatic","emotion":"anxiety"},
        {"title":"Absorbing Distraction","description":"Puzzle, game, cooking something complex. Give your mind a different job for 20 minutes.","category":"distraction","emotion":"anxiety"},
    ],
    "sadness": [
        {"title":"Compassion Letter","description":"Write to yourself exactly as you'd write to a close friend going through the same thing.","category":"journaling","emotion":"sadness"},
        {"title":"Get Morning Light","description":"Within 30 minutes of waking, get natural light. Even sitting by a window shifts mood chemistry.","category":"physical","emotion":"sadness"},
        {"title":"One Tiny Completion","description":"Pick the smallest possible task and finish it. Not for productivity - just to feel something move.","category":"behavioral","emotion":"sadness"},
        {"title":"Reach Out Briefly","description":"Text one person - just hi. You don't need to explain everything. Brief connection is still real.","category":"social","emotion":"sadness"},
        {"title":"Feel It for 10 Minutes","description":"Set a timer. Let yourself feel sad without distraction. Suppressing it usually makes it last longer.","category":"emotional","emotion":"sadness"},
        {"title":"Rest Without Guilt","description":"Sometimes rest is the most productive thing. Give yourself full permission - not reluctant permission.","category":"self-care","emotion":"sadness"},
    ],
    "anger": [
        {"title":"Physical Discharge","description":"Fast walk, push-ups, punch a pillow. Anger is energy - it needs somewhere to go before you can think clearly.","category":"physical","emotion":"anger"},
        {"title":"Unsent Letter","description":"Write everything you want to say with zero filter. Then decide what - if anything - to actually send.","category":"journaling","emotion":"anger"},
        {"title":"Name What's Underneath","description":"Anger often protects a softer feeling - hurt, betrayal, fear. What's actually underneath yours?","category":"reflection","emotion":"anger"},
        {"title":"24-Hour Rule","description":"Wait one full day before responding to what triggered you. The initial charge always softens.","category":"cbt","emotion":"anger"},
    ],
    "loneliness": [
        {"title":"Micro-Connection","description":"A smile, a reply in a thread, a text to someone old. Small contacts are still real contacts.","category":"social","emotion":"loneliness"},
        {"title":"Ambient Presence","description":"Go to a cafe or library - no pressure to talk. Just being around people shifts the feeling.","category":"social","emotion":"loneliness"},
        {"title":"Write to Future You","description":"Tell future-you about today. Creates a sense of connection across time.","category":"journaling","emotion":"loneliness"},
        {"title":"Find One Community","description":"One subreddit, Discord, or local group around something you care about. Even lurking helps.","category":"social","emotion":"loneliness"},
    ],
    "stress": [
        {"title":"Priority Triage","description":"Write everything stressing you. Mark each: urgent+important / urgent / can wait. Handle in strict order.","category":"productivity","emotion":"stress"},
        {"title":"One Completion First","description":"Finish the smallest open task fully before anything else. Momentum from one completion beats motivation.","category":"behavioral","emotion":"stress"},
        {"title":"Protected Nothing Time","description":"Block 30 min today - no task, no screen. Real recovery, not guilty rest.","category":"recovery","emotion":"stress"},
        {"title":"Progressive Muscle Relaxation","description":"Tense each muscle group 5 seconds then release, feet upward. Takes 10 minutes total.","category":"somatic","emotion":"stress"},
    ],
    "grief": [
        {"title":"Let Yourself Cry","description":"No timeline. No 'should be over it'. Grief is nonlinear. Give it space without judging the timing.","category":"emotional","emotion":"grief"},
        {"title":"Memory Ritual","description":"Light a candle, look at photos, or do something they loved. Rituals create space to remember safely.","category":"reflection","emotion":"grief"},
        {"title":"Talk to Someone Who Knew Them","description":"Shared memory is different from individual memory. It can feel less alone.","category":"social","emotion":"grief"},
    ],
    "overthinking": [
        {"title":"Thought Dump","description":"Write every spinning thought - unfiltered, unedited. Externalizing usually quiets the loop.","category":"journaling","emotion":"overthinking"},
        {"title":"5-Minute Limit","description":"Set a timer. Think about it for exactly 5 minutes. When it ends, do something physical.","category":"cbt","emotion":"overthinking"},
        {"title":"Two-Minute Decision Rule","description":"If a decision won't matter in 5 years and takes over 2 minutes - just decide. Any option. Move.","category":"cbt","emotion":"overthinking"},
    ],
    "neutral": [
        {"title":"Gratitude Note","description":"Write 3 specific things from today - genuinely specific, not generic. Forces real attention.","category":"reflection","emotion":"neutral"},
        {"title":"Mindful Observation","description":"Pick one object near you. Observe it for 2 full minutes - color, texture, shadow, weight.","category":"mindfulness","emotion":"neutral"},
    ],
}

EMAP = {"fear":"anxiety","disgust":"anger","surprise":"neutral","burnout":"stress","guilt":"sadness","shame":"sadness","frustration":"anger","numbness":"sadness","emptiness":"sadness","isolation":"loneliness","regret":"sadness","dread":"anxiety","panic":"anxiety","resentment":"anger","overwhelm":"stress","worthlessness":"sadness"}

class SuggestionScorer:
    def __init__(self):
        self.weights = {
            "emotion_match": 0.4,
            "user_preference": 0.3,
            "novelty": 0.2,
            "repetition_penalty": 0.1
        }

    def score_suggestion(self, suggestion: Dict, emotion: str, flow_stage: str,
                        user_liked: List[str], user_rejected: List[str],
                        recent_suggestions: List[str]) -> float:
        """Calculate comprehensive score for a suggestion"""

        score = 0.0

        # Emotion match score
        emotion_score = self._emotion_match_score(suggestion, emotion)
        score += emotion_score * self.weights["emotion_match"]

        # User preference score
        preference_score = self._user_preference_score(suggestion, user_liked, user_rejected)
        score += preference_score * self.weights["user_preference"]

        # Novelty score
        novelty_score = self._novelty_score(suggestion, recent_suggestions)
        score += novelty_score * self.weights["novelty"]

        # Repetition penalty
        repetition_penalty = self._repetition_penalty(suggestion, recent_suggestions)
        score -= repetition_penalty * self.weights["repetition_penalty"]

        return max(0.0, score)  # Ensure non-negative

    def _emotion_match_score(self, suggestion: Dict, emotion: str) -> float:
        """Score based on how well suggestion matches current emotion"""
        emotion = (emotion or "neutral")
        suggestion_emotion = suggestion.get("emotion", "neutral")
        if suggestion_emotion == emotion.lower():
            return 1.0
        elif suggestion_emotion in EMAP and EMAP[suggestion_emotion] == emotion.lower():
            return 0.8
        else:
            return 0.3

    def _user_preference_score(self, suggestion: Dict, liked: List[str], rejected: List[str]) -> float:
        """Score based on user's past feedback"""
        title = suggestion["title"]

        if title in liked:
            return 1.0
        elif title in rejected:
            return 0.0
        else:
            return 0.5

    def _novelty_score(self, suggestion: Dict, recent: List[str]) -> float:
        """Score based on how novel this suggestion is"""
        title = suggestion["title"]
        if title not in recent:
            return 1.0
        else:
            # Reduce score based on recency
            recency_penalty = recent[::-1].index(title) / len(recent) if title in recent else 0
            return max(0.2, 1.0 - recency_penalty)

    def _repetition_penalty(self, suggestion: Dict, recent: List[str]) -> float:
        """Penalty for recently suggested items"""
        title = suggestion["title"]
        if title in recent[-5:]:  # Last 5 suggestions
            return 0.8
        elif title in recent[-10:]:  # Last 10 suggestions
            return 0.5
        else:
            return 0.0

def get_suggestion(emotion: str, flow_stage: str, turn_count: int, recent: List[str] = None,
                  liked: List[str] = None, rejected: List[str] = None, min_step: int = 2) -> Optional[SuggestionOut]:
    """Enhanced suggestion selection with scoring"""

    # Only suggest if in appropriate flow stage
    if flow_stage not in ["guiding", "suggesting"]:
        return None

    # Only suggest after minimum turns
    if turn_count < min_step:
        return None

    key = (emotion or "neutral").lower()
    if key not in POOL:
        key = EMAP.get(key, "neutral")

    pool = POOL.get(key, POOL["neutral"])
    recent = recent or []
    rejected = rejected or []
    liked = liked or []

    # Filter out rejected suggestions
    available = [s for s in pool if s["title"] not in rejected]

    if not available:
        available = pool  # Fallback if all rejected

    # Score all available suggestions
    scorer = SuggestionScorer()
    scored_suggestions = []

    for suggestion in available:
        score = scorer.score_suggestion(suggestion, emotion, flow_stage, liked, rejected, recent)
        scored_suggestions.append((suggestion, score))

    # Sort by score and pick top one
    scored_suggestions.sort(key=lambda x: x[1], reverse=True)
    best_suggestion = scored_suggestions[0][0] if scored_suggestions else random.choice(available)

    return SuggestionOut(
        title=best_suggestion["title"],
        description=best_suggestion["description"],
        category=best_suggestion["category"]
    )
