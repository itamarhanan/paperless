import { createGoogleGenerativeAI, google } from "@ai-sdk/google";

/**
 * Who pays for an AI request. Readers may bring their own Gemini key (kept in
 * their browser, sent per request, never stored); everyone else shares the
 * site's key within per-person and daily limits, so a public deployment can't
 * run up an unbounded bill.
 */

import { KEY_HEADER } from "./ai-key";

type Scope = "enhance" | "chat" | "ask";

/** Requests per person per hour, by feature. A page check runs about once a minute while reading. */
const PER_HOUR: Record<Scope, number> = { enhance: 90, chat: 30, ask: 10 };
/** All AI requests on the site's key per day. Set AI_DAILY_LIMIT=0 to turn the shared key off. */
const DAILY = Number(process.env.AI_DAILY_LIMIT ?? 2000);

const HOUR = 3600;
const DAY = 86400;

// Counted in memory, per server instance: a rough guard against runaway use,
// not exact accounting. Resets when the server restarts.
const counters = new Map<string, { count: number; resetAt: number }>();

function increment(key: string, ttlSeconds: number): number {
  const now = Date.now();
  const entry = counters.get(key);
  if (!entry || entry.resetAt <= now) {
    if (counters.size > 10000) counters.clear();
    counters.set(key, { count: 1, resetAt: now + ttlSeconds * 1000 });
    return 1;
  }
  return ++entry.count;
}

function clientAddress(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

const ownKey = (req: Request) => {
  const key = req.headers.get(KEY_HEADER)?.trim();
  return key && /^[\w-]{20,80}$/.test(key) ? key : null;
};

export type AiAccess =
  | { ok: true; google: typeof google; ownKey: boolean }
  | { ok: false; response: Response };

function limited(message: string, retryAfter: number): AiAccess {
  return {
    ok: false,
    response: Response.json(
      { error: message, code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    ),
  };
}

/** Decides whether this request may use the AI, and with which key. */
export function aiAccess(req: Request, scope: Scope): AiAccess {
  const key = ownKey(req);
  if (key) return { ok: true, google: createGoogleGenerativeAI({ apiKey: key }), ownKey: true };

  const serverKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || (scope === "chat" && process.env.GROQ_API_KEY);
  if (!serverKey || DAILY <= 0) {
    return {
      ok: false,
      response: Response.json(
        { error: "AI features need a Gemini key on this site. Add your own in Appearance › Pages and AI.", code: "no_key" },
        { status: 503 }
      ),
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const hour = Math.floor(now / HOUR);
  const day = Math.floor(now / DAY);
  const mine = increment(`ai:${scope}:${clientAddress(req)}:${hour}`, HOUR);
  if (mine > PER_HOUR[scope]) {
    return limited("You’ve reached this hour’s AI limit. Add your own Gemini key to keep going.", HOUR - (now % HOUR));
  }
  const everyone = increment(`ai:all:${day}`, DAY);
  if (everyone > DAILY) {
    return limited("Paperless has used today’s shared AI allowance. Add your own Gemini key to keep going.", DAY - (now % DAY));
  }
  return { ok: true, google, ownKey: false };
}
