import { NextRequest } from "next/server";

interface ChatMessage {
  role: string;
  content: string;
  emotion?: string;
}

// ─────────────────────────────────────────────
// SEMANTIC SIMILARITY
// ─────────────────────────────────────────────
function getSimilarity(a: string, b: string): number {
  const s1 = new Set(a.toLowerCase().split(/\W+/));
  const s2 = new Set(b.toLowerCase().split(/\W+/));
  const intersect = new Set([...s1].filter(x => s2.has(x)));
  return intersect.size / Math.max(s1.size, s2.size);
}

// ─────────────────────────────────────────────
// STATE DETECTORS
// ─────────────────────────────────────────────
function detectEmotion(text: string): string {
  const t = text.toLowerCase();
  if (/anxious|panic|worry|nervous|overthink|scared/.test(t)) return "anxiety";
  if (/sad|depress|cry|hopeless|empty|numb|worthless|hurt/.test(t)) return "sadness";
  if (/angry|furious|hate|mad|frustrated|rage/.test(t)) return "anger";
  if (/alone|lonely|isolat|no one/.test(t)) return "loneliness";
  if (/stress|overwhelm|too much|exhaust|burnout/.test(t)) return "stress";
  if (/confused|lost|unsure|idk|don't know/.test(t)) return "confused";
  return "neutral";
}

function detectUserType(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("how do i") || t.includes("advice") || t.includes("help me decide")) return "Solution-seeker";
  if (t.includes("don't know") || t.includes("unsure") || t.includes("confused")) return "Confused";
  return "Venting";
}

function detectMomentum(text: string): string {
  const len = text.trim().split(/\s+/).length;
  if (len < 5) return "Low";
  if (len < 20) return "Medium";
  return "High";
}

function detectTrend(history: ChatMessage[], currentEmotion: string): string {
  const last = history.filter(m => m.emotion).slice(-3).map(m => m.emotion);
  if (last.length < 2) return "Stable";
  return last.every(e => e === currentEmotion) ? "Stable" : "Shifting";
}

function detectProfile(history: ChatMessage[]) {
  const t = history.map((m: ChatMessage) => m.content.toLowerCase()).join(" ");
  return {
    personality: t.includes("alone") || t.includes("quiet") || t.includes("introvert") ? "Introvert" : "Extrovert",
    coping_style: t.includes("fix") || t.includes("solve") || t.includes("do") ? "Problem-solver" : "Avoidant/Emotional",
    energy: t.includes("tired") || t.includes("exhausted") || t.includes("drained") ? "Low" : "Normal",
    social: t.includes("people") || t.includes("friends") || t.includes("social") ? "High" : "Low",
  };
}

// ─────────────────────────────────────────────
// TRUST ENGINE
// ─────────────────────────────────────────────
function computeTrustScores(history: ChatMessage[], currentInput: string) {
  const RESISTANCE_TRIGGERS = ["idk", "don't know", "go away", "stop", "no", "don't want to talk", "leave me", "whatever"];
  const ENGAGEMENT_SIGNALS = ["i feel", "i think", "i've been", "actually", "really", "honestly"];
  const OPENNESS_SIGNALS = ["maybe", "i guess", "probably", "i think i", "i wonder"];

  const allUserMsgs = [
    ...history.filter(m => m.role === "user").map(m => m.content.toLowerCase()),
    currentInput.toLowerCase()
  ];

  let resistance = 0;
  let engagement = 0;
  let openness = 0;

  for (const msg of allUserMsgs) {
    if (RESISTANCE_TRIGGERS.some(t => msg.includes(t))) resistance++;
    if (ENGAGEMENT_SIGNALS.some(t => msg.includes(t))) engagement++;
    if (OPENNESS_SIGNALS.some(t => msg.includes(t))) openness++;
  }

  let trustMode = "MEDIUM";
  if (resistance >= 3) trustMode = "WITHDRAW";
  else if (engagement < 2) trustMode = "LOW";
  else if (openness > 3) trustMode = "HIGH";

  return { resistance, engagement, openness, trustMode };
}

// ─────────────────────────────────────────────
// COGNITIVE LOAD DETECTION
// ─────────────────────────────────────────────
function isOverwhelmed(text: string): boolean {
  return /overwhelm|can't think|too much|my head|spinning|breaking down|falling apart/.test(text.toLowerCase());
}

// ─────────────────────────────────────────────
// SUGGESTION ENGINE v5.0
// ─────────────────────────────────────────────
function getSuggestion(
  emotion: string,
  profile: ReturnType<typeof detectProfile>,
  turn: number,
  trustMode: string,
  overwhelmed: boolean,
  pastSuggestions: string[]
): string | null {
  if (turn < 3 || trustMode === "WITHDRAW" || overwhelmed) return null;

  const candidates: string[] = [];

  if (emotion === "anxiety") {
    candidates.push("maybe try focusing on your breath for just 30 seconds... it can help anchor you.");
    candidates.push("you could try naming 5 things you can see around you right now — just a small grounding trick.");
  } else if (emotion === "sadness" && profile.energy === "Low") {
    candidates.push("even just resting without your phone for a moment might give you a little space.");
    candidates.push("sometimes making yourself one small comfort, like a warm drink, can be enough for now.");
  } else if (emotion === "anger") {
    candidates.push("maybe step away for a few minutes — not to avoid it, just to let the intensity settle.");
    candidates.push("writing down what made you angry, without filtering it, can sometimes release some of the pressure.");
  } else if (emotion === "loneliness") {
    if (profile.personality === "Introvert") candidates.push("perhaps some quiet time with something you love — a show, music, a book — could feel comforting.");
    else candidates.push("even a short message to someone you trust, just checking in, can make things feel less isolated.");
  } else if (emotion === "confused") {
    candidates.push("just a thought — sometimes writing your thoughts down, even messily, helps untangle them.");
    candidates.push("maybe focusing on just one small next step, rather than the whole picture, could help.");
  } else {
    if (profile.personality === "Introvert") candidates.push("perhaps some quiet time with your thoughts could feel grounding.");
    else candidates.push("sometimes a small change of scenery, even just a different room, can shift things slightly.");
  }

  // Anti-repetition: filter out already-used suggestions
  const fresh = candidates.filter(c => !pastSuggestions.some(p => getSimilarity(p, c) > 0.4));
  return fresh.length > 0 ? fresh[0] : null;
}

// ─────────────────────────────────────────────
// RESPONSE VALIDATION
// ─────────────────────────────────────────────
function validateResponse(response: string, history: ChatMessage[]): boolean {
  const resLower = response.toLowerCase();
  const bannedPatterns = ["i am sorry", "as an ai", "my apologies", "i understand that", "i want to assure"];
  if (bannedPatterns.some(p => resLower.includes(p))) return false;
  return true;
}

function containsBannedRepeatedly(response: string, history: ChatMessage[]): boolean {
  const words = ["always", "never", "definitely", "everyone", "i recommend", "you should"];
  const resLower = response.toLowerCase();
  const hasBanned = words.some(w => resLower.includes(w));
  if (!hasBanned) return false;
  const prevTurns = history.filter(m => m.role === "assistant").slice(-3).map(m => m.content.toLowerCase());
  return prevTurns.some((prev: string) => words.some(w => prev.includes(w) && resLower.includes(w)));
}

// ─────────────────────────────────────────────
// MAIN ORCHESTRATOR — ELITE BRAIN v5.0
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { messages, user_input } = await req.json();

    const history: ChatMessage[] = messages.slice(-12);
    const turnCount = history.length;
    const profile = detectProfile(history);

    const emotion = detectEmotion(user_input);
    const trend = detectTrend(history, emotion);
    const userType = detectUserType(user_input);
    const momentum = detectMomentum(user_input);
    const depth = Math.min(Math.floor(turnCount / 2) + 1, 3);
    const overwhelmed = isOverwhelmed(user_input);
    const lastBotWasQ = (history[history.length - 1]?.content || "").includes("?");
    const silence = momentum === "Low" && lastBotWasQ;

    // Trust Engine
    const { resistance, engagement, openness, trustMode } = computeTrustScores(history, user_input);

    // Action Selection (gated by Trust Mode)
    const stage = turnCount <= 3 ? "listening" : turnCount <= 6 ? "exploring" : "guiding";
    let action = "EMPATHIZE";
    if (trustMode === "WITHDRAW") action = "EMPATHIZE"; // minimal, no questions
    else if (silence || overwhelmed) action = "REFLECT";
    else if (stage === "listening") action = turnCount % 2 === 0 ? "EMPATHIZE" : "REFLECT";
    else if (stage === "exploring") action = "EXPLORE";
    else action = turnCount % 2 === 0 ? "GUIDE" : "SUGGEST";

    // Past suggestions from history
    const pastSuggestions = history
      .filter((m: ChatMessage) => m.role === "assistant")
      .map((m: ChatMessage) => m.content.toLowerCase());

    const suggestion = getSuggestion(emotion, profile, turnCount, trustMode, overwhelmed, pastSuggestions);

    // Build the v5.0 System Prompt
    const systemPrompt = `
You are the CONVERSATION BRAIN of a human-like AI assistant.
You do NOT generate random responses.
You follow structured reasoning, behavioral control, and strict rules.

---
INPUT STATE:
Action: ${action}
Emotion: ${emotion}
Emotion Trend: ${trend}
User Type: ${userType}
Depth Level: ${depth}
Momentum: ${momentum}
Silence Mode: ${silence}
Turn Count: ${turnCount}
Overwhelmed: ${overwhelmed}

USER PROFILE:
- Personality: ${profile.personality}
- Coping Style: ${profile.coping_style}
- Energy Level: ${profile.energy}
- Social Preference: ${profile.social}

TRUST STATE:
- Trust Mode: ${trustMode}
- Engagement Score: ${engagement}
- Resistance Score: ${resistance}
- Openness Score: ${openness}
---

TRUST BEHAVIOR:
${trustMode === "WITHDRAW" ? "WITHDRAW MODE: 1-2 lines max. NO questions. NO suggestions. NO guidance. Just acknowledge and respect their space." : ""}
${trustMode === "LOW" ? "LOW TRUST: Simple, gentle responses. No deep probing. No heavy advice." : ""}
${trustMode === "MEDIUM" ? "MEDIUM TRUST: Balanced reflection. Light suggestions if turn >= 3." : ""}
${trustMode === "HIGH" ? "HIGH TRUST: Deeper understanding. Meaningful guidance. Emotionally rich responses." : ""}

ACTION RULES:
- EMPATHIZE: Validate the feeling. No question. No advice.
- REFLECT: Rephrase what they said. Optional ONE soft question.
- EXPLORE: Ask exactly ONE meaningful question.
- GUIDE: Offer perspective. No instructions.
- SUGGEST: Give ONE small actionable step wrapped naturally.

DEPTH RULES:
- Depth 1: Emotional validation only.
- Depth 2: Reflection + interpretation.
- Depth 3: Insight + gentle guidance.

${overwhelmed ? "COGNITIVE LOAD: User seems overwhelmed. Use short sentences. Avoid metaphors. Remove all questions." : ""}
${silence ? "SILENCE MODE: No questions. No suggestions. Keep it minimal." : ""}

RESPONSE STRUCTURE (strictly 2-4 lines):
1. Emotional acknowledgment (warm, human)
2. Deeper insight based on Depth Level ${depth}
3. Action-aligned response following Action: ${action}
4. ${suggestion ? `Personalized suggestion (wrap naturally): "${suggestion}"` : "No suggestion this turn."}
5. ${(trustMode !== "WITHDRAW" && !silence && !overwhelmed) ? "ONE soft question (optional)" : "NO question this turn."}

ANTI-HALLUCINATION RULES:
- Only use information explicitly stated by the user.
- Use soft language: "it seems like..." / "it might be..."
- NEVER assume unknown facts.

ANTI-REPETITION RULES:
- DO NOT repeat phrases from previous messages: ${history.slice(-3).map((m: ChatMessage) => m.content).join(" | ")}
- If a phrase feels familiar, rewrite from a new angle.

BANNED OUTPUT:
- "As an AI..."
- "I'm sorry you feel that way"
- "I understand that must be hard"
- Bullet points or numbered lists
- Generic advice like "stay positive"

OUTPUT: 2-4 natural lines. Human tone. No robotic phrasing.
`.trim();

    // Generation Loop
    let reply = "";
    let attempts = 0;
    const MAX_ATTEMPTS = 3;

    while (attempts <= MAX_ATTEMPTS) {
      let currentPrompt = systemPrompt;
      if (attempts > 0) {
        currentPrompt += "\n\nCRITICAL: Your last attempt was too similar or used banned patterns. Completely reframe your angle. Do NOT start the same way.";
      }

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: currentPrompt },
            ...history,
            { role: "user", content: user_input },
          ],
          temperature: attempts === 0 ? 0.85 : 0.95,
          max_tokens: 300,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        reply = "It sounds like something heavy is sitting with you right now. I'm here — take your time.";
        break;
      }

      reply = data.choices?.[0]?.message?.content?.trim() || "";

      const isTooSimilar = history
        .filter((m: ChatMessage) => m.role === "assistant")
        .slice(-5)
        .some((prev: ChatMessage) => getSimilarity(reply, prev.content) > 0.45);

      if (!isTooSimilar && !containsBannedRepeatedly(reply, history) && validateResponse(reply, history)) {
        break;
      }

      attempts++;
    }

    if (!reply || attempts > MAX_ATTEMPTS) {
      reply = "I'm with you — sometimes just sitting with what's here is enough. No need to rush anything.";
    }

    return new Response(JSON.stringify({
      reply,
      emotion,
      flow: stage,
      flow_step: turnCount,
      trust_mode: trustMode,
      safe: true,
    }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({
      reply: "I'm still here. Take your time — there's no rush.",
    }), { status: 200 });
  }
}
