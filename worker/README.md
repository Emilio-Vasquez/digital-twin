# Secure Backend (Cloudflare Worker)

This Worker keeps your OpenAI API key **off** GitHub Pages and acts as a proxy endpoint:

- Frontend (GitHub Pages) calls: `POST https://<your-worker-domain>/api/twin`
- Worker calls OpenAI securely using `env.OPENAI_API_KEY`

## Files
- `wrangler.toml` — Worker config
- `src/worker.js` — Worker code
- `.dev.vars.example` — local dev env var example (contains placeholder `THISISMYAPI`)

## Quick setup

1) Install Wrangler

```bash
npm i -g wrangler
```

2) From this `worker/` folder:

```bash
wrangler login
wrangler deploy
```

3) Set your key **as a secret** (recommended):

```bash
wrangler secret put OPENAI_API_KEY
```

4) Lock CORS to your GitHub Pages origin by editing `ALLOWED_ORIGINS` in `src/worker.js`.

5) In the frontend `script.js`, set:

```js
const API_BASE_URL = "https://<your-worker-domain>";
```

> Note: OpenAI recommends **never** placing your API key in client-side code. See OpenAI key safety guidance. citeturn0search0turn0search2
