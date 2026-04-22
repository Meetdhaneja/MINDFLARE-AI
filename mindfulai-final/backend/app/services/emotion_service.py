from typing import Dict
import logging
log = logging.getLogger(__name__)

_pipe = None

EMOJI = {"joy":"😊","sadness":"😔","anger":"😠","fear":"😰","anxiety":"😟","neutral":"😐","grief":"💔","stress":"😓","loneliness":"🌫️","disgust":"😞","surprise":"😲","overwhelm":"😰","shame":"😶","guilt":"😞"}
COLOR = {"joy":"#F59E0B","sadness":"#3B82F6","anger":"#EF4444","fear":"#8B5CF6","anxiety":"#F97316","neutral":"#6B7280","grief":"#3B82F6","stress":"#F97316","loneliness":"#3B82F6","overwhelm":"#8B5CF6","shame":"#9CA3AF","guilt":"#6B7280"}
KEYWORDS = {
    "anxiety":    ["anxious","panic","worry","nervous","overthink","scared","what if","overwhelming"],
    "sadness":    ["sad","depressed","cry","hopeless","empty","numb","down","worthless","miserable"],
    "anger":      ["angry","furious","hate","rage","frustrated","mad","annoyed","resentment"],
    "loneliness": ["alone","lonely","isolated","no one","no friends","nobody"],
    "stress":     ["stress","overwhelm","too much","exhausted","burnout","deadline","pressure"],
    "grief":      ["lost","miss","grief","death","gone","passed away","mourning"],
    "fear":       ["scared","afraid","terrified","dread","frightened"],
    "shame":      ["ashamed","shame","embarrassed","humiliated","worthless"],
}

def _get_pipe():
    global _pipe
    if _pipe is None:
        try:
            from transformers import pipeline
            _pipe = pipeline("text-classification", model="j-hartmann/emotion-english-distilroberta-base", top_k=None, device=-1)
            log.info("HuggingFace emotion model loaded")
        except:
            _pipe = "fallback"
    return _pipe

def detect_emotion(text: str) -> Dict:
    pipe = _get_pipe()
    if pipe != "fallback":
        try:
            res = sorted(pipe(text[:512])[0], key=lambda x: x["score"], reverse=True)
            top = res[0]
            label = top["label"].lower()
            return {"label": label, "score": round(top["score"], 4), "emoji": EMOJI.get(label,"💭"), "color": COLOR.get(label,"#6B7280")}
        except:
            pass
    # Keyword fallback
    t = text.lower()
    scores = {k: sum(1 for w in v if w in t) for k, v in KEYWORDS.items()}
    top = max(scores, key=scores.get) if max(scores.values()) > 0 else "neutral"
    score = min(0.35 + scores.get(top, 0) * 0.15, 0.95)
    return {"label": top, "score": round(score, 4), "emoji": EMOJI.get(top, "💭"), "color": COLOR.get(top, "#6B7280")}
