// ─────────────────────────────────────────────────────────────────
// src/lib/api.js
// One API client for every agent. Each agent used to carry its own
// copy of this block.
//
// THE BUG THIS FIXES
// The old per-agent fallback read REACT_APP_ANTHROPIC_KEY with no
// environment check. REACT_APP_ vars are inlined at build time, so
// while that variable exists in Vercel (and it had to, until Agents
// 04 and 05 were migrated) every agent took the direct branch in
// production and the proxy was bypassed entirely.
//
// The fallback is now gated on NODE_ENV. Create React App sets
// NODE_ENV to "production" for every `npm run build` and that value
// cannot be overridden, so a production bundle cannot take the
// direct branch even if the variable is still present.
//
// apiUrl() and apiHeaders() keep their old signatures so existing
// call sites work unchanged. callClaude() is the newer wrapper with
// timeout handling and a readable 504 message. Use it for long
// calls (Agent 09).
// ─────────────────────────────────────────────────────────────────

const IS_DEV = process.env.NODE_ENV === "development";
const DEV_KEY = IS_DEV ? process.env.REACT_APP_ANTHROPIC_KEY : undefined;

// Must match APP_TOKEN in the Vercel environment. This ships in the
// bundle, so it is obfuscation against bots, not authentication.
// Vercel Deployment Protection is the real control. See api/claude.js.
const CLIENT_TOKEN = process.env.REACT_APP_CLIENT_TOKEN || "";

export const usingDirectKey = Boolean(DEV_KEY);

export const apiUrl = () =>
  DEV_KEY ? "https://api.anthropic.com/v1/messages" : "/api/claude";

export const apiHeaders = () =>
  DEV_KEY
    ? {
        "Content-Type": "application/json",
        "x-api-key": DEV_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      }
    : {
        "Content-Type": "application/json",
        ...(CLIENT_TOKEN ? { "x-app-token": CLIENT_TOKEN } : {}),
      };

/**
 * Wrapper with timeout and readable gateway-timeout errors.
 * Returns concatenated text blocks.
 */
export async function callClaude({
  model = "claude-sonnet-4-6",
  system,
  userMessage,
  messages,
  maxTokens = 2000,
  useSearch = false,
  maxSearches = 4,
  timeoutMs = 180_000,
}) {
  const body = {
    model,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: messages || [{ role: "user", content: userMessage }],
  };
  if (useSearch) {
    body.tools = [
      { type: "web_search_20250305", name: "web_search", max_uses: maxSearches },
    ];
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(apiUrl(), {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    // A gateway timeout returns HTML, not JSON. The old code called
    // response.json() straight away and threw an unreadable parse
    // error instead of saying what happened.
    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(
        response.status === 504
          ? "The server cut the request off for taking too long. Lower max_tokens for this agent or reduce web searches."
          : `Unexpected response (${response.status}). ${raw.slice(0, 200)}`
      );
    }

    if (!response.ok) throw new Error(data?.error?.message || "API error");

    return (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text || "")
      .join("");
  } catch (e) {
    if (e.name === "AbortError") {
      throw new Error("Request timed out in the browser after 3 minutes.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
