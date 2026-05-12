import rateLimit from 'express-rate-limit';
import { isMongoConnected } from './db.js';
import { Usage } from './models/usage.js';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Per-IP limiter — applied as middleware on every cost-bearing route.
 * Generous enough for real iteration on the manual flow (no LLM cost) but
 * catches casual scraping. In-memory per-process; effective ceiling across
 * Cloud Run is roughly `30 × max-instances` per hour.
 */
export const ipLimiter = rateLimit({
  windowMs: HOUR_MS,
  max: 30,
  // draft-6 sends RateLimit-Limit / RateLimit-Remaining as separate headers
  // (vs draft-7's combined `RateLimit:` field). Separate headers are easier
  // for the SPA to read with res.headers.get(key).
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  // Use the resolved client IP after Express' trust-proxy resolves
  // X-Forwarded-For (set in index.ts). req.ip is the right key here.
  keyGenerator: (req): string => req.ip ?? 'unknown',
  // Custom handler so the 429 response shape matches the per-user / anon-url
  // 429s emitted from the route — SPA reads { bucket, retryAfterSeconds }
  // and renders a single conditional surface based on which bucket fired.
  handler: (req, res) => {
    // express-rate-limit stamps req.rateLimit.resetTime on hit; fall back to
    // a full window if absent. The library augments the Express Request
    // type via module declaration but the augmentation isn't always picked
    // up reliably, so we read through a narrow local cast.
    const rateInfo = (req as { rateLimit?: { resetTime?: Date } }).rateLimit;
    const resetTime = rateInfo?.resetTime;
    const retryAfterSeconds = resetTime
      ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
      : 3600;
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.status(429).json({
      error: `You've made 30 requests from this address this hour. Try again in about ${Math.ceil(retryAfterSeconds / 60)} minutes.`,
      retryAfterSeconds,
      bucket: 'ip',
      limit: 30,
    });
  },
});

const USER_LIMIT = 30;
const ANON_URL_LIMIT = 5;

export interface BucketLimitResult {
  ok: boolean;
  /** Seconds until the user can try again. Always 0 when ok=true. */
  retryAfterSeconds: number;
  limit: number;
  remaining: number;
}

/**
 * Per-Clerk-user rate limit, backed by the Usage collection. Reads the
 * count of generate events for this user in the last hour and compares
 * against USER_LIMIT. Cheap when the user has a compound index on
 * `{ userId, at }` — Mongo answers from the index without touching docs.
 *
 * When Mongo isn't connected (local dev without DB), this always allows
 * the request — IP limiting is the only enforcement in that mode.
 */
export async function checkUserLimit(userId: string): Promise<BucketLimitResult> {
  if (!isMongoConnected()) {
    return { ok: true, retryAfterSeconds: 0, limit: USER_LIMIT, remaining: USER_LIMIT };
  }
  const since = new Date(Date.now() - HOUR_MS);
  const count = await Usage.countDocuments({ userId, at: { $gte: since } });
  if (count >= USER_LIMIT) {
    const oldest = await Usage.findOne(
      { userId, at: { $gte: since } },
      { at: 1 },
    ).sort({ at: 1 });
    const oldestAt = oldest?.at instanceof Date ? oldest.at.getTime() : Date.now();
    const retryAfter = Math.max(1, Math.ceil((oldestAt + HOUR_MS - Date.now()) / 1000));
    return { ok: false, retryAfterSeconds: retryAfter, limit: USER_LIMIT, remaining: 0 };
  }
  return { ok: true, retryAfterSeconds: 0, limit: USER_LIMIT, remaining: USER_LIMIT - count };
}

/**
 * Per-IP rate limit specifically for ANONYMOUS URL-flow scans. The whole
 * point: keep the door open for evaluation but stop one bad actor from
 * draining the Gemini free tier and locking the service out for everyone
 * until we can ship a provider change.
 *
 * Tighter than the catch-all IP limiter because URL scans cost an LLM call
 * + GitHub API quota; manual flow has neither.
 *
 * Counts only URL-flow rows in Usage (sourceKind ≠ manual) for the given
 * IP that have NO userId — that way an anon user signing in mid-session
 * gets clean slate against the per-user bucket, and authenticated users
 * aren't penalized for anonymous activity from the same IP.
 */
export async function checkAnonUrlLimit(ip: string): Promise<BucketLimitResult> {
  if (!isMongoConnected()) {
    return { ok: true, retryAfterSeconds: 0, limit: ANON_URL_LIMIT, remaining: ANON_URL_LIMIT };
  }
  const since = new Date(Date.now() - HOUR_MS);
  const filter = {
    ip,
    sourceKind: { $ne: 'manual' as const },
    userId: { $exists: false },
    at: { $gte: since },
  };
  const count = await Usage.countDocuments(filter);
  if (count >= ANON_URL_LIMIT) {
    const oldest = await Usage.findOne(filter, { at: 1 }).sort({ at: 1 });
    const oldestAt = oldest?.at instanceof Date ? oldest.at.getTime() : Date.now();
    const retryAfter = Math.max(1, Math.ceil((oldestAt + HOUR_MS - Date.now()) / 1000));
    return { ok: false, retryAfterSeconds: retryAfter, limit: ANON_URL_LIMIT, remaining: 0 };
  }
  return { ok: true, retryAfterSeconds: 0, limit: ANON_URL_LIMIT, remaining: ANON_URL_LIMIT - count };
}

export const RATE_LIMITS = {
  perIpHourly: 30,
  perUserHourly: USER_LIMIT,
  anonUrlHourly: ANON_URL_LIMIT,
} as const;
