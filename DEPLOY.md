# Deploying the API proxy (worker.js) — Groq edition, free

Your AI provider key must never live inside `index.html` or `admin.html` — anyone who views the page source could steal it. Instead, the key lives in a small Cloudflare Worker that sits between your site and the AI provider. This setup uses **Groq**, which is free — no credit card required, just a per-minute rate limit that resets on its own.

## 1. Get a free Groq API key

1. Go to https://console.groq.com and sign up (free)
2. Go to https://console.groq.com/keys
3. Click **Create API Key**, copy it somewhere safe — it's only shown once

## 2. Create the Cloudflare Worker

1. Go to https://dash.cloudflare.com/sign-up and create a free account (or log in)
2. Sidebar → **Workers & Pages** → **Create**
3. Choose **Start with Hello World!** (not "Import a repository")
4. Give it a name, e.g. `meridian-proxy`, click **Deploy**
5. Click **Edit code**
6. Delete everything in the editor and paste in the entire contents of `worker.js` from this repo
7. Click **Deploy** again (top right)

## 3. Add your Groq key as a secret

1. On your worker's page, go to **Settings** → **Variables and Secrets**
2. Click **Add** → type **Secret**
3. Name: `GROQ_API_KEY` (exact spelling matters)
4. Value: paste the key from step 1
5. Save, then make sure you **Deploy** again so the change goes live

## 4. Copy your worker URL

On the worker's overview page you'll see a URL like:

```
https://meridian-proxy.your-subdomain.workers.dev
```

## 5. Point your site at the worker

Open `index.html` and `admin.html`, find this line near the top of the `<script>` section in each file:

```js
const API_ENDPOINT = "https://YOUR-WORKER-SUBDOMAIN.workers.dev"; // <-- replace with your deployed worker URL
```

Replace the placeholder with your real worker URL. Save, and push/upload both files again.

## 6. Test it

Open your site, send an outreach message, then go to the backend page and generate a reply. If something's wrong, the conversation bubble itself will now show the specific error (e.g. `(error: ...)`) instead of a generic failure — that message tells you exactly what to fix.

## Notes on the free tier

- Groq's free tier is rate-limited (requests per minute and per day), not credit-based — you don't pay, and it resets on its own rather than running out permanently.
- If you hit the limit, replies will show an error mentioning rate limits — just wait a bit and try again.
- The model used is `llama-3.3-70b-versatile`, set inside `worker.js` (`GROQ_MODEL` constant) — you can swap it for another Groq-hosted model if you want; see https://console.groq.com/docs/models for the current list.

## Optional: lock the worker to your site only

By default `worker.js` sets `ALLOWED_ORIGIN = "*"`, meaning any website could call your worker if they discovered the URL (and eat into your rate limit). Once everything works, open `worker.js` in the Cloudflare editor and change:

```js
const ALLOWED_ORIGIN = "*";
```

to your actual site's origin, e.g.:

```js
const ALLOWED_ORIGIN = "https://yourname.github.io";
```

Redeploy the worker after changing this.

## V2 hardening notes
- The UI is explicitly marked **Simulation**.
- `worker.js` now restricts browser calls to the Render production origin plus local development origins.
- The worker validates request size/message shape, caps output tokens, disables caching, and applies a lightweight per-instance rate limit.
- Overview now supports JSON backup export/import because the current prototype still stores data in browser `localStorage`.
- Mobile layouts were added to both the console and backend.

### Important limitation
This remains a browser-local simulation prototype. `localStorage` is not a shared database, and the backend page must remain open for its browser timers to run. A real multi-user application should move state and scheduled jobs to a server/database rather than extending this localStorage design.
