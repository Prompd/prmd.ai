import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import { submitFeedback, type FeedbackRating } from '../api';
import { Icon } from './Icon';

interface FeedbackWidgetProps {
  /**
   * Repo classification from the LLM enricher (if any). Stored alongside
   * the rating so we can slice feedback by audience (CLI users vs webapp
   * users etc.) without joining tables.
   */
  generationKind?: 'cli' | 'webapp' | 'service' | 'library' | 'monorepo';
}

type Stage = 'rate' | 'comment' | 'done';

/**
 * Two-step feedback widget shown on the preview page after a successful
 * generation. Rendering is conditional on auth — anon users don't see it.
 * Rationale: the auth gate is our spam control; without it the endpoint
 * would need CAPTCHA or aggressive filtering. With it, feedback is signal,
 * not noise.
 */
export function FeedbackWidget({ generationKind }: FeedbackWidgetProps): JSX.Element | null {
  const auth = useAuth();
  const [stage, setStage] = useState<Stage>('rate');
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hide entirely for anonymous users — feedback is auth-only by design.
  if (!auth.enabled || !auth.isSignedIn) return null;

  async function recordRating(value: FeedbackRating): Promise<void> {
    if (submitting) return;
    setRating(value);
    setError(null);
    setSubmitting(true);
    try {
      const token = await auth.getToken();
      // Fire the rating immediately so even users who skip the comment
      // count as a signal. Comment submission later updates would require
      // a separate POST — for v1 we accept "comment-less rating only" as
      // the simplest model.
      await submitFeedback({ rating: value, generationKind }, { token });
      setStage('comment');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to send feedback');
      setRating(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitComment(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!rating || submitting) return;
    const trimmed = comment.trim();
    if (trimmed.length === 0) {
      // Empty comment → same as skip.
      setStage('done');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const token = await auth.getToken();
      // Re-submit with the comment attached. The earlier rating-only post
      // is already persisted; this adds a second row with the full payload.
      // Simplest model — duplicate the rating, take the latest with the
      // comment as the canonical record at query time.
      await submitFeedback({ rating, comment: trimmed, generationKind }, { token });
      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to send comment');
    } finally {
      setSubmitting(false);
    }
  }

  if (stage === 'done') {
    return (
      <div className="feedback-widget feedback-widget-done" role="status">
        <Icon name="check" size={14} />
        <span>Thanks — recorded.</span>
      </div>
    );
  }

  if (stage === 'comment') {
    return (
      <form className="feedback-widget" onSubmit={submitComment}>
        <p className="feedback-widget-prompt">
          {rating === 'positive'
            ? 'Glad it helped. Anything we should keep doing?'
            : "Sorry it missed. What's broken or missing?"}
        </p>
        <textarea
          className="textarea feedback-widget-input"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Optional — your note goes to the team only."
          autoFocus
        />
        {error && <p className="feedback-widget-error">{error}</p>}
        <div className="feedback-widget-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setStage('done')}
            disabled={submitting}
          >
            Skip
          </button>
          <button type="submit" className="btn btn-secondary btn-sm" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="feedback-widget" role="group" aria-label="Was the agent pack useful?">
      <span className="feedback-widget-prompt">Useful?</span>
      <button
        type="button"
        className="feedback-widget-btn"
        onClick={() => recordRating('positive')}
        disabled={submitting}
        aria-label="Yes, this was useful"
      >
        <Icon name="thumbs-up" size={14} />
      </button>
      <button
        type="button"
        className="feedback-widget-btn"
        onClick={() => recordRating('negative')}
        disabled={submitting}
        aria-label="No, this missed"
      >
        <Icon name="thumbs-down" size={14} />
      </button>
      {error && <span className="feedback-widget-error">{error}</span>}
    </div>
  );
}
