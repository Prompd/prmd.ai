/**
 * Pushover wrapper for ops-side notifications.
 *
 * Fire-and-forget: failures are logged but never bubble up, so a Pushover
 * outage can't break the user-facing flow (e.g. a feedback submission).
 *
 * When PUSHOVER_TOKEN or PUSHOVER_USER is unset, every notifier becomes a
 * silent no-op. Lets dev environments run without a Pushover account.
 */

interface PushoverPayload {
  title: string;
  message: string;
  url?: string;
  urlTitle?: string;
  /** Pushover priority: -2 silent | -1 low | 0 default | 1 high | 2 emergency. */
  priority?: -2 | -1 | 0 | 1 | 2;
}

async function sendPushover(payload: PushoverPayload): Promise<void> {
  const token = process.env.PUSHOVER_TOKEN?.trim();
  const user = process.env.PUSHOVER_USER?.trim();
  if (!token || !user) return;

  try {
    const response = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        user,
        title: payload.title,
        message: payload.message,
        url: payload.url,
        url_title: payload.urlTitle,
        priority: payload.priority ?? 0,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`pushover: notification failed — ${response.status} ${body}`);
    }
  } catch (err) {
    console.error(`pushover: notification error — ${err instanceof Error ? err.message : String(err)}`);
  }
}

export interface FeedbackNotification {
  userId?: string;
  /** Hashed IP for anonymous feedback — populated if/when anon emoji widget ships. */
  anonId?: string;
  rating: 'positive' | 'negative';
  comment?: string;
  /** Repo classification from the LLM enricher, if available. */
  generationKind?: string;
}

/**
 * Push a feedback notification. Fires at default priority for everything
 * during launch — see-everything mode. Pushover's $5 license covers 10K
 * messages/month, way more than we'll burn at launch volume. If it gets
 * noisy, the cheapest mitigations (in order): set Pushover quiet hours on
 * your account, delete the PUSHOVER_* secrets to silence everything, or
 * reintroduce priority filtering here.
 *
 * Future digest path: replace this per-event call site with a scheduled
 * worker (Cloud Scheduler → Cloud Run job, or in-process setInterval) that
 * queries the `feedback` collection for unprocessed entries in the last
 * hour, formats one summary message, and pushes once. The route in
 * routes/feedback.ts already persists every submission, so the queue is
 * already there — just need a worker on the read side.
 */
export async function notifyFeedback(data: FeedbackNotification): Promise<void> {
  const sigil = data.rating === 'positive' ? '👍' : '👎';
  const who = data.userId ?? (data.anonId ? `anon:${data.anonId.slice(0, 8)}` : 'unknown');
  const kindTag = data.generationKind ? ` (${data.generationKind})` : '';

  const bodyLines: string[] = [];
  if (data.comment) {
    bodyLines.push(data.comment);
    bodyLines.push('');
  }
  bodyLines.push(`— ${who}${kindTag}`);

  await sendPushover({
    title: `prmd.ai feedback ${sigil}`,
    message: bodyLines.join('\n'),
    // Default priority — sound and vibration, but not high-priority bypass.
    priority: 0,
  });
}
