/**
 * Cloudflare Worker: Digital Twin Proxy
 * - POST /api/twin
 * - Receives JSON payload from frontend
 * - Calls OpenAI Responses API
 * - Returns { persona_text, persona_html, model }
 */

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

// Lock this down to your GitHub Pages origin(s).
// Example: ["https://emilio-vasquez.github.io"]
const ALLOWED_ORIGINS = [
  "http://localhost:8787",
  "http://127.0.0.1:8787",
  // Add your Pages origin here:
  "https://emilio-vasquez.github.io",
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(resObj, origin, status = 200) {
  return new Response(JSON.stringify(resObj), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  });
}

function stripUnsafeHtml(text) {
  // Minimal, conservative HTML rendering: wrap in <p> and escape.
  // (We return both persona_text + persona_html; frontend prefers persona_html.)
  const esc = String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const paragraphs = esc
    .split(/\n\s*\n/g)
    .map((p) => `<p>${p.replaceAll("\n", "<br>")}</p>`)
    .join("");

  return paragraphs;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/api/twin") {
      return new Response("Not found", { status: 404, headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders(origin) });
    }

    if (!env.OPENAI_API_KEY) {
      return json({ error: "Missing OPENAI_API_KEY in Worker environment." }, origin, 500);
    }

    // CORS lock
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return json({ error: "Origin not allowed." }, origin, 403);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, origin, 400);
    }

    // Build a safe, friendly prompt.
    const prompt = buildPrompt(payload);

    const model = "gpt-4.1-mini";

    try {
      const r = await fetch(OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: prompt,
          // Keep it fast and safe
          max_output_tokens: 300,
        }),
      });

      if (!r.ok) {
        const txt = await r.text();
        return json({ error: `OpenAI error (${r.status})`, detail: txt }, origin, 502);
      }

      const data = await r.json();

      // Responses API returns output in a structured format.
      // We'll extract best-effort text.
      const personaText = extractText(data) || "(No text returned)";

      return json(
        {
          model,
          persona_text: personaText,
          persona_html: stripUnsafeHtml(personaText),
        },
        origin,
        200,
      );
    } catch (e) {
      return json({ error: "Request failed", detail: String(e?.message || e) }, origin, 502);
    }
  },
};

function buildPrompt(p) {
  const inputs = p?.inputs || {};
  const outputs = p?.outputs || {};

  return [
    "You are generating a fictional \"Digital Twin\" persona for a college workshop.",
    "IMPORTANT SAFETY AND TONE:",
    "- Friendly, playful, non-scary.",
    "- No threats, fear, guilt, or shaming.",
    "- Do not claim real tracking or real identity.",
    "- Treat all data as hypothetical and simulated.",
    "\nWrite the persona in this exact format (plain text, no markdown):",
    "1) Twin Name: <short nickname>",
    "2) One-liner: <one sentence>",
    "3) Persona Summary: <2-3 sentences>",
    "4) What the system would do next: <3 bullet lines starting with '- '>",
    "5) Blind Spots: <2 bullet lines starting with '- ' about what the system cannot know>",
    "\nHere are the simulated signals:",
    `- Age range: ${inputs.age_range || "(unknown)"}`,
    `- Major interest: ${inputs.major_interest || "(unknown)"}`,
    `- Social media use (0-10): ${inputs.social_media_use ?? "(unknown)"}`,
    `- Location sharing: ${inputs.location_sharing ? "ON" : "OFF"}`,
    `- Password habits: ${inputs.password_habits || "(unknown)"}`,
    `- Device usage: ${(inputs.device_usage || []).join(", ") || "none"}`,
    `- Late-night activity: ${inputs.late_night_activity ? "ON" : "OFF"}`,
    "\nHere are the current generated outputs:",
    `- Ad Profile: ${outputs.ad_profile || "(unknown)"}`,
    `- Security Risk Score: ${outputs.security_risk_score ?? "(unknown)"}/100 (${outputs.risk_level || "?"})`,
    `- Targeting Confidence: ${outputs.targeting_confidence ?? "(unknown)"}% (${outputs.confidence_level || "?"})`,
    `- Mirroring Strength: ${outputs.mirroring_strength || "(unknown)"}`,
    `- Recreation Likelihood: ${outputs.recreation_likelihood || "(unknown)"}`,
    "\nMake it feel personal but clearly fictional. Keep it under ~220 words total.",
  ].join("\n");
}

function extractText(respJson) {
  // Best-effort extraction for Responses API
  // Typical shape: { output: [{ content: [{ type: 'output_text', text: '...' }] }] }
  try {
    const out = respJson?.output;
    if (!Array.isArray(out)) return "";
    const texts = [];
    for (const item of out) {
      const content = item?.content;
      if (!Array.isArray(content)) continue;
      for (const c of content) {
        if (c?.type === "output_text" && typeof c?.text === "string") {
          texts.push(c.text);
        }
      }
    }
    return texts.join("\n").trim();
  } catch {
    return "";
  }
}
