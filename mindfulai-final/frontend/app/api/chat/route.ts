import { NextRequest } from "next/server";

interface ChatMessage {
  role: string;
  content: string;
  emotion?: string;
}

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

function detectTrend(history: ChatMessage[], currentEmotion: string) {
  const lastEmotions = history.filter(m => m.emotion).slice(-3).map(m => m.emotion);
  if (lastEmotions.length < 2) return "Stable";
  return lastEmotions.every(e => e === currentEmotion) ? "Stable" : "Shifting";
}

// -----------------------------
// HELPER: REPETITION & VALIDATION
// -----------------------------
function containsBannedRepeatedly(response: string, history: ChatMessage[]) {
  const words = ["always", "never", "definitely", "everyone", "i recommend", "you should"];
  const resLower = response.toLowerCase();
  
  const hasBanned = words.some(w => resLower.includes(w));
  if (!hasBanned) return false;

  const prevTurns = history.filter(m => m.role === "assistant").slice(-3).map(m => m.content.toLowerCase());
  return prevTurns.some((prev: string) => words.some(w => prev.includes(w) && resLower.includes(w)));
}

function validateResponse(response: string, history: ChatMessage[]) {
  const resLower = response.toLowerCase();
  const bannedPatterns = ["i am sorry", "as an ai", "my apologies"]; 
  
  if (bannedPatterns.some(p => resLower.includes(p))) return false;
  return true;
}

// -----------------------------
// HELPER: USER PROFILE DETECTOR
// -----------------------------
function detectProfile(history: ChatMessage[]) {
  const t = history.map((m: ChatMessage) => m.content.toLowerCase()).join(" ");
  return {
    personality: t.includes("alone") || t.includes("quiet") ? "Introvert" : "Extrovert",
    coping_style: t.includes("fix") || t.includes("do") ? "Problem-solver" : "Avoidant/Emotional",
    energy: t.includes("tired") || t.includes("exhausted") ? "Low" : "Normal",
    social: t.includes("people") || t.includes("friends") ? "High" : "Low"
  };
}

// -----------------------------
// HELPER: SUGGESTION ENGINE
// -----------------------------
function getSuggestion(emotion: string, profile: any, turn: number) {
  if (turn < 3) return null;
  
  if (emotion === "anxiety") return "maybe try focusing on your breath for just 30 seconds... it can help anchor you.";
  if (emotion === "sadness" && profile.energy === "Low") return "even just resting for a moment without your phone might give you a bit of space.";
  if (profile.personality === "Introvert") return "perhaps some quiet time with a book or just your thoughts could feel grounding.";
  return "sometimes a small change of scenery, even just a different room, can shift things slightly.";
}

// -----------------------------
// MAIN ORCHESTRATOR
// -----------------------------
export async function POST(req: NextRequest) {
  try {
    const { messages, user_input } = await req.json();

    // 1. INPUT PIPELINE (ELITE BRAIN 4.0)
    const history = messages.slice(-12);
    const text = user_input.toLowerCase();
    const turnCount = history.length;
    const profile = detectProfile(history);
    
    // Extract past suggestions to avoid repetition
    const pastSuggestions = history
      .filter((m: ChatMessage) => m.role === "assistant")
      .map((m: ChatMessage) => m.content.toLowerCase());

    let emotion = "neutral";
    if (text.includes("sad") || text.includes("lonely") || text.includes("hurt")) emotion = "sadness";
    if (text.includes("anxious") || text.includes("panic") || text.includes("scared")) emotion = "anxiety";
    if (text.includes("angry") || text.includes("mad")) emotion = "anger";

    const trend = detectTrend(history, emotion);
    const userType = detectUserType(user_input);
    const depth = Math.min(Math.floor(turnCount / 2) + 1, 3);
    const momentum = detectMomentum(user_input);
    const lastBotWasQ = (history[history.length - 1]?.content || "").includes("?");
    const silence = (momentum === "Low" && lastBotWasQ);

    // Enhanced Action Logic
    const stage = turnCount <= 3 ? "listening" : turnCount <= 6 ? "exploring" : "guiding";
    let action = "EMPATHIZE";
    if (silence) action = "REFLECT";
    else if (stage === "listening") action = turnCount % 2 === 0 ? "EMPATHIZE" : "REFLECT";
    else if (stage === "exploring") action = "EXPLORE";
    else action = turnCount % 2 === 0 ? "GUIDE" : "SUGGEST";

    let suggestion = getSuggestion(emotion, profile, turnCount);
    // Anti-Repetition for Suggestions
    if (suggestion && pastSuggestions.some((prev: string) => prev.includes(suggestion!.split("...")[0]))) {
      suggestion = "maybe just taking a deep breath and noticing one thing you can see right now could help.";
    }

    // 2. CONVERSATION BRAIN PROMPT
    const systemPrompt = `
You are the CONVERSATION BRAIN of a human-like AI assistant.
You do NOT simply reply. You DECIDE how to respond using structured intelligence.

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

USER PROFILE:
- Personality: ${profile.personality}
- Coping Style: ${profile.coping_style}
- Energy Level: ${profile.energy}
- Social Preference: ${profile.social}
---

CORE OBJECTIVE: Generate a response that is emotionally accurate, context-aware, and personalized.

STRICT RESPONSE STRUCTURE (MANDATORY):
1. Emotional acknowledgment (Warm, human)
2. Deeper insight or reflection (Based on Depth Level)
3. Action-based response (Follow Action: ${action} strictly)
4. Personalized Suggestion (IF turn >= 3: ${suggestion || "none"})
5. Optional ONE soft question

STRICT ANTI-HALLUCINATION & ANTI-REPETITION:
- DO NOT assume facts. Use "it seems like..." or "it might be..."
- DO NOT repeat phrases from previous messages: ${history.slice(-3).map((m: ChatMessage) => m.content).join(" | ")}
- NEVER use generic advice like "stay positive".

GOLD STANDARD EXAMPLES (FOLLOW THIS TONE):
User: "I've been up since 3am spiraling about my job."
Assistant: "I can feel the tension in what you're describing. Like you're stretched thin. What part of this situation feels most out of your control right now?"
    `;

    // 3. GENERATION LOOP (STRENGTHENED)
    let reply = "";
    let attempts = 0;
    const MAX_ATTEMPTS = 3;

    while (attempts <= MAX_ATTEMPTS) {
      let currentPrompt = systemPrompt;
      if (attempts > 0) {
        currentPrompt += "\nCRITICAL: YOUR LAST ATTEMPT WAS REPETITIVE. CHANGE THE STRUCTURE ENTIRELY.";
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
        .filter((m: ChatMessage) => m.role === "assistant")
        .slice(-5)
        .some((prev: ChatMessage) => getSimilarity(reply, prev.content) > 0.5);

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
