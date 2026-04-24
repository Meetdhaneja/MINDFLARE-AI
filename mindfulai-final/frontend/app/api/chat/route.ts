import { NextRequest } from "next/server";

// -----------------------------
// HELPER: SEMANTIC SIMILARITY
// -----------------------------
function getSimilarity(text1: string, text2: string) {
  const s1 = new Set(text1.toLowerCase().split(/\W+/));
  const s2 = new Set(text2.toLowerCase().split(/\W+/));
  const intersect = new Set([...s1].filter(x => s2.has(x)));
  return intersect.size / Math.max(s1.size, s2.size);
}

// -----------------------------
// HELPER: STATE DETECTORS
// -----------------------------
function detectUserType(text: string) {
  const t = text.toLowerCase();
  if (t.includes("how do i") || t.includes("advice") || t.includes("help me decide")) return "Solution-seeker";
  if (t.includes("don't know") || t.includes("unsure") || t.includes("confused")) return "Confused";
  return "Venting";
}

function detectMomentum(text: string) {
  const len = text.split(/\s+/).length;
  if (len < 5) return "Low";
  if (len < 20) return "Medium";
  return "High";
}

function detectTrend(history: any[], currentEmotion: string) {
  const lastEmotions = history.filter(m => m.emotion).slice(-3).map(m => m.emotion);
  if (lastEmotions.length < 2) return "Stable";
  return lastEmotions.every(e => e === currentEmotion) ? "Stable" : "Shifting";
}

// -----------------------------
// HELPER: REPETITION & VALIDATION
// -----------------------------
function containsBannedRepeatedly(response: string, history: any[]) {
  const words = ["always", "never", "definitely", "everyone", "i recommend", "you should"];
  const resLower = response.toLowerCase();
  
  const hasBanned = words.some(w => resLower.includes(w));
  if (!hasBanned) return false;

  const prevTurns = history.filter(m => m.role === "assistant").slice(-3).map(m => m.content.toLowerCase());
  return prevTurns.some(prev => words.some(w => prev.includes(w) && resLower.includes(w)));
}

function validateResponse(response: string, history: any[]) {
  const resLower = response.toLowerCase();
  const bannedPatterns = ["i am sorry", "as an ai", "my apologies"]; 
  
  if (bannedPatterns.some(p => resLower.includes(p))) return false;
  return true;
}

// -----------------------------
// MAIN ORCHESTRATOR
// -----------------------------
export async function POST(req: NextRequest) {
  try {
    const { messages, user_input } = await req.json();

    // 1. INPUT PIPELINE (ELITE BRAIN)
    const history = messages.slice(-12);
    const text = user_input.toLowerCase();
    
    let emotion = "neutral";
    if (text.includes("sad") || text.includes("lonely")) emotion = "sadness";
    if (text.includes("anxious") || text.includes("panic")) emotion = "anxiety";

    const trend = detectTrend(history, emotion);
    const userType = detectUserType(user_input);
    const turnCount = history.length;
    const depth = turnCount <= 2 ? 1 : turnCount <= 5 ? 2 : 3;
    const momentum = detectMomentum(user_input);
    const lastBotWasQ = (history[history.length - 1]?.content || "").includes("?");
    const silence = (momentum === "Low" && lastBotWasQ);

    const stage = turnCount <= 2 ? "listening" : turnCount <= 5 ? "exploring" : "guiding";
    let action = "EMPATHIZE";
    if (stage === "listening") action = turnCount === 0 ? "EMPATHIZE" : "REFLECT";
    else if (stage === "exploring") action = "EXPLORE";
    else action = turnCount % 2 === 0 ? "GUIDE" : "SUGGEST";

    // 2. CONTROLLED PROMPT BUILDING
    const systemPrompt = `
You are the decision-making brain of a human-like conversational AI.
You generate controlled, grounded, and context-aware responses.

---
INPUT STATE:
Action: ${action}
Emotion: ${emotion}
Emotion Trend: ${trend}
User Type: ${userType}
Depth Level: ${depth}
Momentum: ${momentum}
Silence Mode: ${silence}
---

CORE OBJECTIVE: Generate a response that is emotionally accurate, grounded in user input, and progressive.

---
GOLD STANDARD EXAMPLES (FOLLOW THIS TONE):
Example 1:
User: "I don't know how to handle this creative block."
Assistant: "It makes sense that this is getting to you — there's real stuff happening here. So the anger is there... but underneath it, what's actually going on? What do you think would happen if you told someone close to you what you just told me?"

Example 2:
User: "Relationship anxiety is genuinely hard."
Assistant: "I notice you almost minimized that just now — but what you described? That's heavy. If you took the other person out of the equation — what are you left with?"

Example 3:
User: "I've been up since 3am spiraling about my job."
Assistant: "I can feel the tension in what you're describing. Like you're stretched thin. What part of this situation feels most out of your control right now?"
---

STRICT ANTI-HALLUCINATION RULES:
1. DO NOT INVENT FACTS: Only use info provided by user. Do NOT assume details.
2. NO FAKE CERTAINTY: Avoid absolute statements like "always" or "definitely". Use "It sounds like" or "It might be".
3. NOTopic Drift: Do not change topic or introduce unrelated ideas.

ACTION ENFORCEMENT:
- EMPATHIZE: Validate emotion. No advice. No question.
- REFLECT: Rephrase feeling. Add depth. Optional 1 soft question.
- EXPLORE: Ask 1 meaningful, specific question. No generic questions.
- GUIDE: Provide perspective. No direct instructions.
- SUGGEST: Provide 1 small, realistic step.

USER TYPE ADAPTATION:
- Venting: prioritize listening, minimal questions.
- Confused: gentle clarification, help structure thoughts.
- Solution-seeker: 1 clear, simple action.

RESPONSE CONSTRAINTS:
- 2 to 4 lines only. Natural human tone.
- NO repetition. NO robotic phrasing.
- Each response MUST add new value or perspective.
    `;

    // 3. GENERATION LOOP (STRENGTHENED)
    let reply = "";
    let attempts = 0;
    const MAX_ATTEMPTS = 3;

    while (attempts <= MAX_ATTEMPTS) {
      let currentPrompt = systemPrompt;
      if (attempts > 0) {
        currentPrompt += `
\nCRITICAL ERROR: YOU ARE REPEATING YOURSELF. 
YOUR PREVIOUS ATTEMPT WAS TOO SIMILAR TO EARLIER RESPONSES.
DO NOT USE THE SAME PHRASING. DO NOT USE THE SAME STRUCTURE.
SAY SOMETHING COMPLETELY NEW AND MOVE THE CONVERSATION FORWARD.
IF YOU ARE STUCK, SHIFT THE ANGLE ENTIRELY.
`;
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
            { role: "system", content: currentPrompt },
            ...history,
            { role: "user", content: user_input }
          ],
          temperature: 0.9 
        })
      });

      const data = await response.json();
      if (!response.ok) {
        reply = "I'm reflecting on what you've shared. It feels like there's more depth here than I can grasp in a single moment... could you help me understand a different side of this?";
        break;
      }

      reply = data.choices?.[0]?.message?.content || "";

      const isTooSimilar = history
        .filter((m: any) => m.role === "assistant")
        .slice(-5)
        .some((prev: any) => getSimilarity(reply, prev.content) > 0.5);

      if (!isTooSimilar && !containsBannedRepeatedly(reply, history) && validateResponse(reply, history)) {
        break;
      }
      attempts++;
    }

    if (attempts > MAX_ATTEMPTS) {
      reply = "I want to be careful not to repeat myself because I value what we're talking about. Let's look at this from a completely different angle—how is this affecting your daily peace right now?";
    }

    return new Response(JSON.stringify({ 
      reply,
      emotion,
      flow: stage,
      flow_step: turnCount,
      safe: true 
    }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ reply: "I'm listening. Tell me more about what's on your mind." }), { status: 200 });
  }
}
