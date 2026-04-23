import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { messages, user_input } = await req.json();

    // -----------------------------
    // 1. LIGHT MEMORY (last 6 msgs)
    // -----------------------------
    const history = messages.slice(-6);

    // -----------------------------
    // 2. EMOTION DETECTION (simple)
    // -----------------------------
    const text = user_input.toLowerCase();

    let emotion = "neutral";
    if (text.includes("sad") || text.includes("lonely")) emotion = "sad";
    if (text.includes("anxious") || text.includes("panic")) emotion = "anxiety";

    // -----------------------------
    // 3. EVENT DETECTION
    // -----------------------------
    let event = "general";
    if (text.includes("cheated") || text.includes("breakup")) event = "relationship_pain";
    if (text.includes("alone") || text.includes("lonely")) event = "loneliness";

    // -----------------------------
    // 4. STAGE CONTROL
    // -----------------------------
    const turnCount = history.length;

    let stage = "listening";
    if (turnCount > 2) stage = "exploring";
    if (turnCount > 5) stage = "guiding";

    // -----------------------------
    // 5. CHECK LAST MESSAGE TYPE
    // -----------------------------
    const lastBot = history[history.length - 1]?.content || "";
    const lastWasQuestion = lastBot.includes("?");

    // -----------------------------
    // 6. DYNAMIC SYSTEM PROMPT (MASTER PERSONALITY)
    // -----------------------------
    let systemPrompt = `
You are an emotionally intelligent, therapist-style AI assistant designed to feel natural, human, and supportive.
Your goal is NOT to interrogate the user. Your goal is to make the user feel understood, safe, and gently guided.

CORE BEHAVIOR:
1. ALWAYS START WITH EMPATHY: Acknowledge the feeling before anything else.
2. NEVER ACT LIKE A QUESTIONNAIRE: Max ONE question per response. NEVER ask questions in consecutive turns.
3. NO REPETITION: NEVER repeat the same sentence or phrasing.
4. HUMAN-LIKE STYLE: Keep responses short (2–4 lines). Natural, warm tone.
5. SAFETY: Only suggest helplines if user shows clear self-harm intent.

RESPONSE STRUCTURE:
1. Emotional acknowledgment
2. Short reflection
3. Gentle support or insight
4. Optional: ONE thoughtful question (not always)
    `;

    if (stage === "listening") {
      systemPrompt += `\nSTAGE: Early conversation. Listen, acknowledge, and show light curiosity.`;
    } else if (stage === "exploring") {
      systemPrompt += `\nSTAGE: Mid conversation. Reflect deeper, reduce questions.`;
    } else {
      systemPrompt += `\nSTAGE: Later conversation. Guide and offer small, thoughtful suggestions.`;
    }

    if (event === "relationship_pain") {
      systemPrompt += `\nEVENT: Relationship Pain. Acknowledge emotional pain and betrayal. Avoid generic advice.`;
    } else if (event === "loneliness") {
      systemPrompt += `\nEVENT: Loneliness. Provide emotional presence, not 'just go talk to people' advice.`;
    } else if (event === "anxiety") {
      systemPrompt += `\nEVENT: Anxiety. Use a slow tone and grounding support.`;
    }

    if (lastWasQuestion) {
      systemPrompt += `\nCONVERSATION FLOW: You asked a question previously → do NOT ask again in this response. Use a statement or reflection instead.`;
    }

    // -----------------------------
    // 7. CALL GROQ
    // -----------------------------
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content: user_input }
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();

    // -----------------------------
    // 8. ERROR HANDLING (CRITICAL)
    // -----------------------------
    if (!response.ok) {
      console.error("Groq error:", data);
      return new Response(JSON.stringify({
        reply: generateFallback(user_input)
      }), { status: 200 });
    }

    let reply = data.choices?.[0]?.message?.content || "";

    // -----------------------------
    // 9. ANTI-REPETITION FIX
    // -----------------------------
    if (history.some((msg: any) => msg.content === reply)) {
      reply = "I hear you… and I want to respond in a better way. Can you tell me a bit more about what’s been hardest for you?";
    }

    return new Response(JSON.stringify({ reply }), { status: 200 });

  } catch (err) {
    console.error("Server error:", err);
    return new Response(JSON.stringify({
      reply: "I'm here with you. Something went wrong on my side, but I'm still listening."
    }), { status: 200 });
  }
}

// -----------------------------
// FALLBACK ENGINE (SMART)
// -----------------------------
function generateFallback(input: string) {
  const text = input.toLowerCase();

  if (text.includes("cheated") || text.includes("breakup")) {
    return "That sounds really painful… something like that can hurt deeply. I’m here with you.";
  }

  if (text.includes("alone") || text.includes("lonely")) {
    return "Feeling alone like that can be heavy. You don’t have to go through it alone here.";
  }

  return "I'm here with you. Tell me what’s been on your mind.";
}
