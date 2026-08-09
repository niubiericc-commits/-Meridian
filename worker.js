/**
 * Meridian API proxy — Cloudflare Worker (Groq edition, free tier)
 *
 * Your front end (index.html / admin.html) sends requests shaped like
 * Anthropic's Messages API: { model, max_tokens, system, messages }.
 * This worker converts that into Groq's OpenAI-compatible chat completions
 * format, calls Groq (free, no credit card), and converts the response
 * back into the { content: [{ type: "text", text }] } shape the front end
 * already expects — so index.html and admin.html never need to change.
 *
 *   Browser  --Anthropic-shaped POST-->  this worker (has the Groq key)
 *            <--Anthropic-shaped JSON--  converts to/from Groq's format
 *                                         --> https://api.groq.com
 *
 * Setup:
 *   1. Create a free Groq account: https://console.groq.com
 *   2. Create an API key: https://console.groq.com/keys
 *   3. In your Cloudflare Worker: Settings -> Variables and Secrets ->
 *      Add -> Secret -> name it GROQ_API_KEY -> paste your key -> Deploy
 *   4. Paste this file's contents into the Worker's Edit Code screen,
 *      Deploy
 *   5. index.html / admin.html already point at your worker URL from the
 *      earlier setup — nothing else to change there
 *
 * Optional hardening: set ALLOWED_ORIGIN below to your exact site URL
 * (e.g. "https://yourname.github.io") instead of "*" once it's working,
 * so only your own page can call this worker.
 */

const ALLOWED_ORIGIN = "*";
const GROQ_MODEL = "llama-3.3-70b-versatile";

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === "GET") {
      return new Response(
        JSON.stringify({
          status: "ok",
          provider: "groq",
          note: "This is the Groq edition of worker.js. If you're seeing this in your browser, this worker IS running the new code. Compare this URL to the API_ENDPOINT in your index.html / admin.html — they must match exactly.",
        }, null, 2),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    if (!env.GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: { message: "GROQ_API_KEY secret is not set on this worker." } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let incoming;
    try {
      incoming = await request.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: { message: "Bad request body (not valid JSON)" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert Anthropic-shaped request -> Groq (OpenAI-compatible) request
    const groqMessages = [];
    if (incoming.system) {
      groqMessages.push({ role: "system", content: incoming.system });
    }
    for (const m of incoming.messages || []) {
      groqMessages.push({ role: m.role, content: m.content });
    }

    let upstream;
    try {
      upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          max_tokens: incoming.max_tokens || 300,
          temperature: typeof incoming.temperature === "number" ? incoming.temperature : 1,
          messages: groqMessages,
        }),
      });
    } catch (e) {
      return new Response(
        JSON.stringify({ error: { message: "Could not reach Groq API: " + String(e) } }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let groqData;
    try {
      groqData = await upstream.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: { message: "Groq returned a non-JSON response" } }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!upstream.ok) {
      // Groq's error shape is usually { error: { message, type, code } } already,
      // pass it through as-is so the front end can display it.
      return new Response(JSON.stringify(groqData), {
        status: upstream.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert Groq response -> Anthropic-shaped response the front end expects
    const replyText = groqData?.choices?.[0]?.message?.content ?? "";
    const anthropicShaped = {
      content: [{ type: "text", text: replyText }],
    };

    return new Response(JSON.stringify(anthropicShaped), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  },
};
