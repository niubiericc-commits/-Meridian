# Deploying the API proxy (worker.js)

Your Anthropic API key must never live inside `index.html` or `admin.html` — anyone who views the page source could steal it. Instead, the key lives in a small Cloudflare Worker that sits between your site and Anthropic's API. This takes about 5 minutes and Cloudflare's free tier is enough for this.

## 1. Get an Anthropic API key

Go to https://console.anthropic.com/settings/keys and create a key. Keep this page open — you'll paste it in step 4.

## 2. Create the worker

1. Go to https://dash.cloudflare.com/sign-up and create a free account (or log in)
2. In the sidebar, click **Workers & Pages**
3. Click **Create** → **Create Worker**
4. Give it a name, e.g. `meridian-proxy` — this becomes part of your URL
5. Click **Deploy** (it deploys a placeholder first, that's fine)
6. Click **Edit code**
7. Delete everything in the editor and paste in the entire contents of `worker.js` from this repo
8. Click **Deploy** again (top right)

## 3. Add your API key as a secret

1. Still on your worker's page, go to **Settings** → **Variables and Secrets**
2. Click **Add** → choose type **Secret**
3. Name: `ANTHROPIC_API_KEY`
4. Value: paste the key from step 1
5. Save and deploy

## 4. Copy your worker URL

On the worker's overview page you'll see a URL like:

```
https://meridian-proxy.your-subdomain.workers.dev
```

Copy it.

## 5. Point your site at the worker

Open `index.html` and `admin.html`, find this line near the top of the `<script>` section in each file:

```js
const API_ENDPOINT = "https://YOUR-WORKER-SUBDOMAIN.workers.dev"; // <-- replace with your deployed worker URL
```

Replace the placeholder URL with your actual worker URL from step 4. Save, and re-deploy/re-upload both files (e.g. commit and push if you're using GitHub Pages).

## 6. Test it

Open your site, import some leads, send an outreach message, then go to the backend page and try generating a reply. If it still fails, open your browser's developer console (F12) on the page — the error there will usually say exactly what went wrong (wrong URL, missing secret, invalid key, etc).

## Optional: lock the worker to your site only

By default `worker.js` sets `ALLOWED_ORIGIN = "*"`, meaning any website could call your worker (and burn through your API quota) if they discovered the URL. Once everything works, open `worker.js` in the Cloudflare editor and change:

```js
const ALLOWED_ORIGIN = "*";
```

to your actual site's origin, e.g.:

```js
const ALLOWED_ORIGIN = "https://yourname.github.io";
```

Redeploy the worker after changing this.
