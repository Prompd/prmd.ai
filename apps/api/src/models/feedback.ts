import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * One document per feedback submission from the post-generation widget.
 *
 * Auth-only: every doc has a userId (no anonymous feedback — auth-gate is
 * the spam control, not a CAPTCHA). IP is intentionally NOT stored — adds
 * PII weight without buying spam protection that the auth gate doesn't
 * already provide.
 *
 * 90-day TTL keeps the collection bounded. If/when we need longer
 * retention for analytics, aggregate into a separate collection.
 */
const FeedbackSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    rating: { type: String, enum: ['positive', 'negative'], required: true },
    /**
     * Optional free-text comment. Sanitized at write: trimmed, HTML tags
     * stripped, control chars stripped, capped at 1000 chars.
     */
    comment: { type: String, maxlength: 1000 },
    /**
     * The LLM-classified repo kind for the generation that triggered
     * this feedback (cli / webapp / service / library / monorepo).
     * Lets us slice "which audience loves vs hates the output".
     * Undefined for manual-flow generations where no LLM ran.
     */
    generationKind: { type: String, enum: ['cli', 'webapp', 'service', 'library', 'monorepo'] },
    at: { type: Date, default: Date.now },
  },
  { collection: 'feedback' },
);

// TTL — Mongo auto-deletes docs older than 90 days based on `at`.
FeedbackSchema.index({ at: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export type FeedbackDoc = InferSchemaType<typeof FeedbackSchema>;
export const Feedback = model<FeedbackDoc>('Feedback', FeedbackSchema);
