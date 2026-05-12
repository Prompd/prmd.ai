import { Router } from 'express';
import type { GenerateResponse } from '@prmd/shared';
import { ScannerError, type RepoScanner } from '../scanner.js';
import type { ProfileEnricher } from '../enricher.js';
import type { PrompdCompilerAdapter } from '../compiler.js';
import type { AuthVerifier } from '../auth.js';
import { isMongoConnected } from '../db.js';
import { User } from '../models/user.js';
import { Usage } from '../models/usage.js';
import { checkAnonUrlLimit, checkUserLimit, RATE_LIMITS } from '../rate-limit.js';
import { parseRepoUrl } from '../scanners/url.js';
import { generateRequestSchema } from '../validation.js';

export interface GenerateDeps {
  scanner: RepoScanner;
  passthroughEnricher: ProfileEnricher;
  llmEnricher: ProfileEnricher | null;
  compiler: PrompdCompilerAdapter;
  auth: AuthVerifier;
}

export function generateRouter(deps: GenerateDeps): Router {
  const router = Router();
  router.post('/generate', async (req, res) => {
    const parsed = generateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid request', details: parsed.error.flatten() });
      return;
    }
    const startedAt = Date.now();
    const sourceKind = parsed.data.source.kind;
    const ip = req.ip ?? 'unknown';
    let userId: string | null = null;

    // Scan target identifier — `owner/repo` for URL flows, profile name
    // for manual. Computed once up front so even error-path usage logs
    // have it.
    let target: string | undefined;
    if (parsed.data.source.kind === 'manual') {
      const name = parsed.data.source.profile.name?.trim();
      if (name) target = name;
    } else {
      const parsedUrl = parseRepoUrl(parsed.data.source.url);
      if (parsedUrl) target = `${parsedUrl.owner}/${parsedUrl.repo}`;
    }
    try {
      // URL flows are open to anonymous users but at a tight cap (covers
      // evaluation without exposing the LLM free tier to abuse). Signed-in
      // users get a much higher per-account ceiling. Manual flow is IP-only.
      if (sourceKind !== 'manual') {
        if (deps.auth.enabled) {
          // Best-effort identity. Failure to verify is not fatal — anon
          // path picks them up.
          userId = await deps.auth.verify(req);
        }

        if (userId) {
          const userCheck = await checkUserLimit(userId);
          res.setHeader('X-RateLimit-User-Limit', String(userCheck.limit));
          res.setHeader('X-RateLimit-User-Remaining', String(userCheck.remaining));
          if (!userCheck.ok) {
            res.setHeader('Retry-After', String(userCheck.retryAfterSeconds));
            res.status(429).json({
              error: `You've hit the per-account scan limit (${RATE_LIMITS.perUserHourly}/hour). Try again in about ${Math.ceil(userCheck.retryAfterSeconds / 60)} minutes.`,
              retryAfterSeconds: userCheck.retryAfterSeconds,
              bucket: 'user',
              limit: RATE_LIMITS.perUserHourly,
            });
            return;
          }
        } else {
          const anonCheck = await checkAnonUrlLimit(ip);
          res.setHeader('X-RateLimit-Anon-URL-Limit', String(anonCheck.limit));
          res.setHeader('X-RateLimit-Anon-URL-Remaining', String(anonCheck.remaining));
          if (!anonCheck.ok) {
            res.setHeader('Retry-After', String(anonCheck.retryAfterSeconds));
            res.status(429).json({
              error: `You've used your ${RATE_LIMITS.anonUrlHourly} free repo scans this hour. Sign in for ${RATE_LIMITS.perUserHourly}/hour or wait about ${Math.ceil(anonCheck.retryAfterSeconds / 60)} minutes.`,
              retryAfterSeconds: anonCheck.retryAfterSeconds,
              bucket: 'anon-url',
              limit: RATE_LIMITS.anonUrlHourly,
            });
            return;
          }
        }
      }
      const scan = await deps.scanner.scan(parsed.data.source);
      // LLM enrichment runs for URL-based flows (github/bitbucket) when an API
      // key is configured. Manual flow always uses the passthrough — the user
      // already gave us the full profile and the LLM would just spend tokens
      // refining what they typed.
      const useLLM =
        sourceKind !== 'manual' && deps.llmEnricher !== null;
      const enricher = useLLM && deps.llmEnricher !== null ? deps.llmEnricher : deps.passthroughEnricher;
      const enriched = await enricher.enrich(scan);
      const files = await deps.compiler.compile(enriched, parsed.data.formats);
      const body: GenerateResponse = { profile: enriched, files };
      res.json(body);

      // Persist usage after responding so a slow DB write doesn't add latency
      // to the user's request. Errors swallowed — observability shouldn't
      // affect the user-facing flow.
      void logUsage({
        userId,
        ip,
        sourceKind,
        target,
        kindClassified: enriched.kind,
        filesCount: files.length,
        durationMs: Date.now() - startedAt,
      });
    } catch (err) {
      // ScannerError messages are intentionally user-facing (we wrote them
      // for clarity). All other errors get a generic 500 to the client so
      // we don't leak internal paths, stack details, or driver messages.
      // The real error still goes to the server log + usage doc for debugging.
      const status = err instanceof ScannerError ? err.status : 500;
      const internalMessage = err instanceof Error ? err.message : 'internal error';
      const clientMessage =
        err instanceof ScannerError
          ? err.message
          : 'Generation failed. Please try again.';
      if (!(err instanceof ScannerError)) {
        console.error(`generate: unhandled error — ${internalMessage}`);
      }
      res.status(status).json({ error: clientMessage });
      void logUsage({
        userId,
        ip,
        sourceKind,
        target,
        durationMs: Date.now() - startedAt,
        error: internalMessage,
      });
    }
  });
  return router;
}

interface UsageLogInput {
  userId: string | null;
  ip: string;
  sourceKind: 'manual' | 'github' | 'bitbucket';
  target?: string;
  kindClassified?: string;
  filesCount?: number;
  durationMs: number;
  error?: string;
}

async function logUsage(input: UsageLogInput): Promise<void> {
  if (!isMongoConnected()) return;
  try {
    await Usage.create({
      userId: input.userId ?? undefined,
      ip: input.ip,
      sourceKind: input.sourceKind,
      target: input.target,
      kindClassified: input.kindClassified,
      filesCount: input.filesCount,
      durationMs: input.durationMs,
      error: input.error,
    });
    if (input.userId && !input.error) {
      // Bump per-user counters. Upsert handles first-time scanners.
      await User.findOneAndUpdate(
        { userId: input.userId },
        {
          $set: { lastSeenAt: new Date() },
          $setOnInsert: { firstSeenAt: new Date() },
          $inc: { totalScans: 1 },
        },
        { upsert: true },
      );
    }
  } catch {
    // Observability path — never let it break the user-facing response.
  }
}
