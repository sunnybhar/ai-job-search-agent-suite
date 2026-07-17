// ─────────────────────────────────────────────────────────────────
// Vercel Serverless Function — Anthropic API Proxy
// File location in your repo: /api/claude.js  (repo root, NOT src/)
//
// WHY: REACT_APP_* env vars are baked into the public JS bundle at
// build time — anyone with your Vercel URL can extract the key.
// This proxy keeps the key server-side only.
//
// SETUP (see README):
// 1. In Vercel → Settings → Environment Variables:
//    ADD:    ANTHROPIC_API_KEY  (no REACT_APP_ prefix)
//    DELETE: REACT_APP_ANTHROPIC_KEY  ← important, this one leaks
// 2. Redeploy. Then REVOKE the old key at console.anthropic.com
//    (it is already public in your current bundle).
// ─────────────────────────────────────────────────────────────────

// Only these models may be requested through the proxy (abuse guard)
const ALLOWED_MODELS = ["claude-opus-4-8", "claude-sonnet-4-6"];
const MAX_TOKENS_CAP = 10000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method not allowed" } });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: { message: "ANTHROPIC_API_KEY is not configured in Vercel environment variables." }
    });
  }

  const body = req.body || {};

  if (!ALLOWED_MODELS.includes(body.model)) {
    return res.status(400).json({ error: { message: `Model not allowed: ${body.model}` } });
  }
  if (typeof body.max_tokens !== "number" || body.max_tokens > MAX_TOKENS_CAP) {
    body.max_tokens = MAX_TOKENS_CAP;
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    });
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: { message: `Proxy error: ${e.message}` } });
  }
}
