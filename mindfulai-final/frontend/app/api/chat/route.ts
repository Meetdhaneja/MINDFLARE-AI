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
    // 6. DYNAMIC SYSTEM PROMPT
    // -----------------------------
    let systemPrompt = `
You are a human-like therapist AI.

Rules:
* Max 1 question
* If last message had a question → DO NOT ask again
* Always start with empathy
* Keep response short (2-4 lines)
* No repetition
    `;

    if (stage === "guiding") {
      systemPrompt += `\n* Focus on support, not questions`;
    }

    if (event === "relationship_pain") {
      systemPrompt += `\n* Acknowledge emotional pain and betrayal\n* Avoid generic questions`;
    }

    if (event === "loneliness") {
      systemPrompt += `\n* Provide emotional presence, not advice`;
    }

    if (lastWasQuestion) {
      systemPrompt += `\n* Do NOT ask a question in this response`;
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
