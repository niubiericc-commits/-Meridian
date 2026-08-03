/**
 * Meridian API proxy — Cloudflare Worker
 *
 * Purpose: your static site (index.html / admin.html) cannot safely call
 * https://api.anthropic.com directly — that would mean putting your API key
 * in browser-visible JavaScript, where anyone could steal it. This worker
 * sits in between: your key lives here as a secret, never in the page.
 *
 *   Browser  --POST-->  this worker (has the key)  --POST-->  Anthropic API
 *
 * Setup:
 *   1. Create a free Cloudflare account: https://dash.cloudflare.com/sign-up
 *   2. Workers & Pages -> Create -> Create Worker
 *   3. Paste this entire file into the editor, replacing the default code
 *   4. Settings -> Variables and Secrets -> add a secret named
 *      ANTHROPIC_API_KEY with your Anthropic API key as the value
 *      (get a key at https://console.anthropic.com/settings/keys)
 *   5. Deploy. Copy the worker URL (looks like
 *      https://meridian-proxy.YOUR-SUBDOMAIN.workers.dev)
 *   6. Paste that URL into API_ENDPOINT near the top of index.html and
 *      admin.html
 *
 * Optional hardening: set ALLOWED_ORIGIN below to your exact site URL
 * (e.g. "https://yourname.github.io") instead of "*" once it's working,
 * so only your own page can call this worker.
 */

const ALLOWED_ORIGIN = "*";

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

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    if (!env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY secret is not set on this worker." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body;
    try {
      body = await request.text();
    } catch (e) {
      return new Response("Bad request body", { status: 400, headers: corsHeaders });
    }

    let upstream;
    try {
      upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body,
      });
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Could not reach Anthropic API", detail: String(e) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const responseBody = await upstream.text();
    return new Response(responseBody, {
      status: upstream.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  },
};
