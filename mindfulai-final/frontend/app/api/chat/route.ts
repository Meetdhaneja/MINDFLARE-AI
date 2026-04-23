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

  // Check if any of these hits were in the last 2 bot messages
  const lastBotMsgs = history.filter(m => m.role === "assistant").slice(-2).map(m => m.content.toLowerCase());
  return hits.some(h => lastBotMsgs.some(prev => prev.includes(h)));
}

export async function POST(req: NextRequest) {
  try {
    const { messages, user_input } = await req.json();

    // 1. LIGHT MEMORY
    const history = messages.slice(-10);

    // 2. DETECT STATE
    const text = user_input.toLowerCase();
    let emotion = "neutral";
    if (text.includes("sad") || text.includes("lonely")) emotion = "sad";
    if (text.includes("anxious") || text.includes("panic")) emotion = "anxiety";

    let event = "general";
    if (text.includes("cheated") || text.includes("breakup")) event = "relationship_pain";
    if (text.includes("alone") || text.includes("lonely")) event = "loneliness";

    const turnCount = history.length;
    let stage = turnCount <= 2 ? "listening" : turnCount <= 5 ? "exploring" : "guiding";

    const lastBot = history[history.length - 1]?.content || "";
    const lastWasQuestion = lastBot.includes("?");

    const lastUserMsg = history.filter(m => m.role === "user").slice(-1)[0]?.content || "";
    const isUserRepeating = user_input.toLowerCase() === lastUserMsg.toLowerCase();

    // 3. MASTER PROMPT
    let baseSystemPrompt = `
You are an emotionally intelligent, therapist-style AI assistant.
Your goal is NOT to interrogate. Make the user feel understood and gently guided.

CORE RULES:
* Max 1 question. NEVER consecutive turns.
* ALWAYS start with empathy.
* Keep responses 2-4 lines. Natural, warm tone.
* CONTEXT PROGRESSION: Each response MUST add a new insight, angle, or deeper emotional understanding. Move the conversation forward.
    `;

    if (isUserRepeating) {
      baseSystemPrompt += `\nUSER IS REPEATING: The user has said this before. Do NOT repeat your previous response. Instead, shift perspective, go deeper into the emotion, or guide the conversation forward in a new direction.`;
    }

    // 4. GENERATION LOOP (RETRY LOGIC)
    let reply = "";
    let attempts = 0;
    const MAX_ATTEMPTS = 2;

    while (attempts <= MAX_ATTEMPTS) {
      let currentSystemPrompt = baseSystemPrompt;
      
      if (attempts > 0) {
        currentSystemPrompt += `\nREWRITE INSTRUCTION: Your last attempt was too similar to previous responses. 
        Rewrite this in a COMPLETELY new way. Change structure, tone, and approach. 
        Do NOT repeat meaning or phrasing. Move the conversation forward.`;
      }

      // Contextual injection
      if (stage === "listening") currentSystemPrompt += `\nSTAGE: Listening. Mirror feelings. No advice.`;
      else if (stage === "exploring") currentSystemPrompt += `\nSTAGE: Exploring. Deep reflection.`;
      else currentSystemPrompt += `\nSTAGE: Guiding. Offer a small, thoughtful suggestion.`;

      if (event === "relationship_pain") currentSystemPrompt += `\nEVENT: Relationship Pain. Acknowledge betrayal specifically.`;
      if (lastWasQuestion) currentSystemPrompt += `\nFLOW: Do NOT ask a question this time. Use a statement.`;

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
          temperature: 0.8 // Higher temp for more variety
        })
      });

      const data = await response.json();
      if (!response.ok) {
        reply = generateFallback(user_input);
        break;
      }

      reply = data.choices?.[0]?.message?.content || "";

      // 5. SEMANTIC & CLICHÉ CHECK
      const isTooSimilar = history
        .filter((m: any) => m.role === "assistant")
        .slice(-3)
        .some((prev: any) => getSimilarity(reply, prev.content) > 0.75);

      const isBannedRepeat = containsBannedRepeatedly(reply, history);

      if (!isTooSimilar && !isBannedRepeat) {
        break; // Good response found
      }

      attempts++;
    }

    // 6. FAILSAFE FALLBACK
    if (attempts > MAX_ATTEMPTS) {
      reply = `I'm really reflecting on what you said about feeling ${emotion}. It sounds like this is hitting a deep spot. One small thing that might help right now is just taking a second to name what's feeling the heaviest. I'm right here with you.`;
    }

    return new Response(JSON.stringify({ reply }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ reply: "I'm listening. Tell me more about what's happening." }), { status: 200 });
  }
}

function generateFallback(input: string) {
  const text = input.toLowerCase();
  if (text.includes("cheated") || text.includes("breakup")) return "That sounds really painful… betrayal like that cuts deep. I’m here with you.";
  if (text.includes("alone") || text.includes("lonely")) return "Feeling alone like that is heavy. You don’t have to carry it all by yourself right now.";
  return "I'm listening. Tell me what’s been on your mind.";
}
