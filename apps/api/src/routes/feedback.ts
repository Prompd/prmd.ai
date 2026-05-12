import { Router } from 'express';
import { z } from 'zod';
import type { AuthVerifier } from '../auth.js';
import { isMongoConnected } from '../db.js';
import { Feedback } from '../models/feedback.js';
import { notifyFeedback } from '../lib/notifications.js';

export interface FeedbackDeps {
  auth: AuthVerifier;
}

const feedbackRequestSchema = z.object({
  rating: z.enum(['positive', 'negative']),
  comment: z.string().max(2000).optional(),
  generationKind: z.enum(['cli', 'webapp', 'service', 'library', 'monorepo']).optional(),
});

/**
 * Strip the obvious injection vectors from a free-text comment before
 * storing. Not bulletproof, but cheap and good enough at launch volume:
 *   - Trim outer whitespace
 *   - Strip HTML tags (anything between < and >)
 *   - Strip ASCII control characters except tab + newline
 *   - Cap at 1000 chars (the model also enforces this; double safety)
 */
function sanitizeComment(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) return '';
  const noTags = trimmed.replace(/<[^>]*>/g, '');
  // eslint-disable-next-line no-control-regex
  const noControl = noTags.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return noControl.slice(0, 1000);
}

export function feedbackRouter(deps: FeedbackDeps): Router {
  const router = Router();
  router.post('/feedback', async (req, res) => {
    // Feedback is auth-only. The Clerk gate is the spam control — at
    // launch volume that's cheaper than CAPTCHA and gives us reliable
    // dedupe by userId.
    if (!deps.auth.enabled) {
      res.status(503).json({ error: 'Feedback isn\'t available — auth is not configured on this server.' });
      return;
    }
    const userId = await deps.auth.verify(req);
    if (!userId) {
      res.status(401).json({ error: 'Sign in to send feedback.' });
      return;
    }

    const parsed = feedbackRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid request', details: parsed.error.flatten() });
      return;
    }

    if (!isMongoConnected()) {
      // Without persistence we have nowhere to put the feedback. Acknowledge
      // success to the client so the UI flow stays smooth, but log so this
      // shows up in operator awareness.
      console.warn('feedback: received but Mongo not connected — dropped');
      res.status(202).json({ ok: true, persisted: false });
      return;
    }

    try {
      const doc: Record<string, unknown> = {
        userId,
        rating: parsed.data.rating,
      };
      if (parsed.data.generationKind) doc.generationKind = parsed.data.generationKind;
      let cleanedComment: string | undefined;
      if (parsed.data.comment) {
        const cleaned = sanitizeComment(parsed.data.comment);
        if (cleaned.length > 0) {
          doc.comment = cleaned;
          cleanedComment = cleaned;
        }
      }
      await Feedback.create(doc);
      res.status(201).json({ ok: true, persisted: true });

      // Fire-and-forget push after the response is sent so a Pushover
      // hiccup can't add latency or break the client flow. The lib
      // suppresses low-signal pings (positive + no comment) internally.
      void notifyFeedback({
        userId,
        rating: parsed.data.rating,
        comment: cleanedComment,
        generationKind: parsed.data.generationKind,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'internal error';
      console.error(`feedback: write failed — ${message}`);
      res.status(500).json({ error: 'Failed to record feedback. Try again later.' });
    }
  });
  return router;
}
