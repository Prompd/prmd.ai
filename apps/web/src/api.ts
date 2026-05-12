import type { GenerateRequest, GenerateResponse, GeneratedFile } from '@prmd/shared';

export interface GenerateOptions {
  token?: string | null;
}

export interface RateLimitBucket {
  limit: number;
  remaining: number;
}

export interface RateLimitSnapshot {
  /** Per-IP bucket — applies to every request to /api/generate. */
  ip?: RateLimitBucket;
  /** Per-Clerk-user bucket — applies only to URL-flow scans for signed-in users. */
  user?: RateLimitBucket;
  /** Anonymous URL-flow bucket — applies to URL scans from unauthenticated visitors. */
  anonUrl?: RateLimitBucket;
}

export type RateLimitBucketName = 'ip' | 'user' | 'anon-url';

export interface GenerateResult {
  response: GenerateResponse;
  rateLimit: RateLimitSnapshot;
}

/**
 * Thrown when the API rejects the request with a 429. Carries which bucket
 * fired and the retry-after value so the UI can render the right surface
 * (anon → signup pitch; user → cooldown; ip → cooldown + soft signup) and
 * format "try again in N minutes" without parsing a string.
 */
export class RateLimitError extends Error {
  public readonly retryAfterSeconds: number;
  public readonly bucket: RateLimitBucketName | null;
  public readonly limit: number | null;
  public readonly rateLimit: RateLimitSnapshot;
  constructor(
    message: string,
    retryAfterSeconds: number,
    bucket: RateLimitBucketName | null,
    limit: number | null,
    rateLimit: RateLimitSnapshot,
  ) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
    this.bucket = bucket;
    this.limit = limit;
    this.rateLimit = rateLimit;
  }
}

function authHeaders(token?: string | null): Record<string, string> {
  return token ? { authorization: `Bearer ${token}` } : {};
}

function readBucket(res: Response, limitHeader: string, remainingHeader: string): RateLimitBucket | undefined {
  const limitRaw = res.headers.get(limitHeader);
  const remainingRaw = res.headers.get(remainingHeader);
  if (limitRaw === null || remainingRaw === null) return undefined;
  const limit = Number(limitRaw);
  const remaining = Number(remainingRaw);
  if (Number.isNaN(limit) || Number.isNaN(remaining)) return undefined;
  return { limit, remaining };
}

function readRateLimit(res: Response): RateLimitSnapshot {
  const snapshot: RateLimitSnapshot = {};
  const ip = readBucket(res, 'RateLimit-Limit', 'RateLimit-Remaining');
  if (ip) snapshot.ip = ip;
  const user = readBucket(res, 'X-RateLimit-User-Limit', 'X-RateLimit-User-Remaining');
  if (user) snapshot.user = user;
  const anonUrl = readBucket(res, 'X-RateLimit-Anon-URL-Limit', 'X-RateLimit-Anon-URL-Remaining');
  if (anonUrl) snapshot.anonUrl = anonUrl;
  return snapshot;
}

export async function generate(
  req: GenerateRequest,
  options: GenerateOptions = {},
): Promise<GenerateResult> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders(options.token) },
    body: JSON.stringify(req),
  });
  const rateLimit = readRateLimit(res);
  if (res.status === 429) {
    let message = 'too many requests — try again in a few minutes';
    let retryAfterSeconds = 0;
    let bucket: RateLimitBucketName | null = null;
    let limit: number | null = null;
    try {
      const body = (await res.json()) as {
        error?: string;
        retryAfterSeconds?: number;
        bucket?: RateLimitBucketName;
        limit?: number;
      };
      if (body.error) message = body.error;
      if (typeof body.retryAfterSeconds === 'number') retryAfterSeconds = body.retryAfterSeconds;
      if (body.bucket === 'ip' || body.bucket === 'user' || body.bucket === 'anon-url') bucket = body.bucket;
      if (typeof body.limit === 'number') limit = body.limit;
    } catch {
      /* fall through */
    }
    if (retryAfterSeconds === 0) {
      const header = res.headers.get('Retry-After');
      if (header) {
        const n = Number(header);
        if (!Number.isNaN(n)) retryAfterSeconds = n;
      }
    }
    throw new RateLimitError(message, retryAfterSeconds, bucket, limit, rateLimit);
  }
  if (!res.ok) {
    let message: string;
    try {
      const body = (await res.json()) as { error?: string };
      message = body.error ?? `${res.status}`;
    } catch {
      message = `${res.status}`;
    }
    throw new Error(message);
  }
  const response = (await res.json()) as GenerateResponse;
  return { response, rateLimit };
}

export type FeedbackRating = 'positive' | 'negative';

export interface FeedbackInput {
  rating: FeedbackRating;
  comment?: string;
  generationKind?: 'cli' | 'webapp' | 'service' | 'library' | 'monorepo';
}

export async function submitFeedback(
  input: FeedbackInput,
  options: GenerateOptions = {},
): Promise<void> {
  const res = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders(options.token) },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let message = `${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* fall through */
    }
    throw new Error(message);
  }
}

export async function downloadZip(name: string, files: GeneratedFile[]): Promise<void> {
  const res = await fetch('/api/download', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, files }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`download failed: ${res.status} ${text}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
