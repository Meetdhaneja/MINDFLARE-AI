import { NextRequest } from "next/server";

// -----------------------------
// HELPER: SEMANTIC SIMILARITY (Jaccard)
// -----------------------------
function getSimilarity(text1: string, text2: string) {
  const s1 = new Set(text1.toLowerCase().split(/\W+/));
  const s2 = new Set(text2.toLowerCase().split(/\W+/));
  const intersect = new Set([...s1].filter(x => s2.has(x)));
  return intersect.size / Math.max(s1.size, s2.size);
}

// -----------------------------
// HELPER: DECIDE ACTION
// -----------------------------
function decideAction(stage: string, turnCount: number, emotion: string) {
  if (stage === "listening") {
    return turnCount === 0 ? "EMPATHIZE" : "REFLECT";
  }
  if (stage === "exploring") {
    return "EXPLORE";
  }
  if (stage === "guiding") {
    return turnCount % 2 === 0 ? "GUIDE" : "SUGGEST";
  }
  return "EMPATHIZE";
}

// -----------------------------
// HELPER: BANNED CLICHÉS
// -----------------------------
const BANNED_CLICHES = [
  "i'm here with you",
  "tell me what's on your mind",
  "that sounds painful",
  "you're not alone",
  "i understand how you feel"
];

function containsBannedRepeatedly(text: string, history: any[]) {
  const lower = text.toLowerCase();
  const hits = BANNED_CLICHES.filter(c => lower.includes(c));
  if (hits.length === 0) return false;
  const lastBotMsgs = history.filter(m => m.role === "assistant").slice(-2).map(m => m.content.toLowerCase());
  return hits.some(h => lastBotMsgs.some(prev => prev.includes(h)));
}

export async function POST(req: NextRequest) {
  try {
    const { messages, user_input } = await req.json();

    // 1. STATE DETECTION
    const history = messages.slice(-10);
    const text = user_input.toLowerCase();
    
    let emotion = "neutral";
    if (text.includes("sad") || text.includes("lonely")) emotion = "sad";
    if (text.includes("anxious") || text.includes("panic")) emotion = "anxiety";

    let event = "general";
    if (text.includes("cheated") || text.includes("breakup")) event = "relationship_pain";
    if (text.includes("alone") || text.includes("lonely")) event = "loneliness";

    const turnCount = history.length;
    const stage = turnCount <= 2 ? "listening" : turnCount <= 5 ? "exploring" : "guiding";
    
    const action = decideAction(stage, turnCount, emotion);
    
    const lastBot = history[history.length - 1]?.content || "";
    const lastWasQuestion = lastBot.includes("?");
    const lastUserMsg = history.filter(m => m.role === "user").slice(-1)[0]?.content || "";
    const isUserRepeating = user_input.toLowerCase() === lastUserMsg.toLowerCase();

    // 2. ORCHESTRATOR PROMPT
    let baseSystemPrompt = `
You are an advanced conversational orchestrator for a human-like therapist AI.
Your job is NOT just to reply. Your job is to DECIDE how to reply based on the conversation state.

---
CURRENT CONTEXT:
Action: ${action}
Emotion: ${emotion}
Event: ${event}
Stage: ${stage}
---

PRIMARY OBJECTIVE: Generate a response that feels human, progresses the conversation, avoids repetition, and matches the selected ACTION strictly.

STRICT GLOBAL RULES:
1. NEVER REPEAT: Do not reuse phrases, structures, or emotional statements.
2. ALWAYS PROGRESS: Add new depth or direction. Build on what the user already said.
3. HUMAN TONE: Natural, slightly warm, reflective. 2 to 4 lines only.
4. QUESTION CONTROL: Max ONE question. If previous message had a question -> DO NOT ask again.

ACTION-SPECIFIC BEHAVIOR:
- EMPATHIZE: Validate emotion deeply. No advice. No question. Focus on safety.
- REFLECT: Rephrase emotional state. Add deeper understanding. Optional: one soft question.
- EXPLORE: Ask ONE meaningful, non-generic question relating directly to user situation.
- GUIDE: Provide perspective. Help user think clearly. No direct instructions.
- SUGGEST: Give 1 small, realistic, easy action. No overwhelming advice.

EVENT HANDLING:
- relationship_pain: Acknowledge betrayal and emotional impact specifically.
- loneliness: Emphasize presence and connection.
- anxiety: Use calm tone, reduce intensity.
    `;

    if (isUserRepeating) {
      baseSystemPrompt += `\nUSER LOOP: User is repeating. Go deeper, shift angle, do NOT repeat same response.`;
    }

    // 3. GENERATION LOOP
    let reply = "";
    let attempts = 0;
    const MAX_ATTEMPTS = 2;

    while (attempts <= MAX_ATTEMPTS) {
      let currentSystemPrompt = baseSystemPrompt;
      if (attempts > 0) {
        currentSystemPrompt += `\nREWRITE: Your last attempt was too similar. Change structure, tone, and approach COMPLETELY. Move the conversation forward.`;
      }

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: currentSystemPrompt },
            ...history,
            { role: "user", content: user_input }
          ],
          temperature: 0.8
        })
      });

      const data = await response.json();
      if (!response.ok) {
        reply = "I'm right here with you. I'm having a little trouble responding right now, but I'm still listening.";
        break;
      }

      reply = data.choices?.[0]?.message?.content || "";

      // Semantic & Loop check
      const isTooSimilar = history
        .filter((m: any) => m.role === "assistant")
        .slice(-3)
        .some((prev: any) => getSimilarity(reply, prev.content) > 0.75);

      if (!isTooSimilar && !containsBannedRepeatedly(reply, history)) {
        break;
      }
      attempts++;
    }

    return new Response(JSON.stringify({ reply }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ reply: "I'm here. Tell me more about what's on your mind." }), { status: 200 });
  }
}
