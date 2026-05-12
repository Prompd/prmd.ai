import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * One document per /api/generate call. Used for:
 *   1. Per-user rate limit enforcement (count docs in last hour for a userId)
 *   2. Abuse forensics — replay what hit the system and from where
 *   3. Aggregate metrics — generations per day, kind classification breakdown
 *
 * 7-day TTL keeps the collection bounded; for longer-term analytics we'd
 * aggregate into a separate collection later. Manual-flow rows have no
 * userId — only IP. URL-flow rows have both.
 */
const UsageSchema = new Schema(
  {
    userId: { type: String, index: true },
    ip: { type: String, index: true },
    // `at` is indexed via the TTL definition below — declaring `index: true`
    // here would create a duplicate.
    at: { type: Date, default: Date.now },
    sourceKind: { type: String, enum: ['manual', 'github', 'bitbucket'], required: true },
    /**
     * Scan target identifier. For URL flows: `owner/repo` (e.g.
     * "prompd/prompd-cli"). For manual flow: the user-supplied profile
     * name. Indexed so we can answer "which repos get scanned most" and
     * "show all scans of repo X" without scanning the whole collection.
     */
    target: { type: String, index: true },
    // From the LLM enricher's classification — null for manual or when LLM
    // enrichment didn't run / failed.
    kindClassified: { type: String, enum: ['cli', 'webapp', 'service', 'library', 'monorepo'] },
    filesCount: { type: Number },
    durationMs: { type: Number },
    error: { type: String },
  },
  { collection: 'usage' },
);

// TTL — Mongo auto-deletes docs older than 7 days based on `at`.
UsageSchema.index({ at: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

// Compound index for the rate-limit hot path: "scans by this user in the
// last hour". Mongo can serve this from index alone.
UsageSchema.index({ userId: 1, at: -1 });

export type UsageDoc = InferSchemaType<typeof UsageSchema>;
export const Usage = model<UsageDoc>('Usage', UsageSchema);
