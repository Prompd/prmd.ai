import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SignInButton } from '@clerk/clerk-react';
import type {
  GenerateRequest,
  GenerateResponse,
  OutputFormat,
  PackageManager,
  RepoProfile,
} from '@prmd/shared';
import { generate, RateLimitError, type RateLimitSnapshot } from '../api';
import { useAuth } from '../auth';
import { Icon } from '../components/Icon';
import { trackEvent } from '../lib/analytics';

interface InputPageProps {
  onGenerated: (result: GenerateResponse) => void;
}

type Tab = 'manual' | 'url';

const PACKAGE_MANAGERS: PackageManager[] = ['npm', 'pnpm', 'yarn', 'bun', 'pip', 'poetry', 'go', 'cargo', 'nuget', 'other'];

interface FormatOption {
  key: OutputFormat;
  label: string;
  hint: string;
  icon: 'file-text' | 'sparkles' | 'mouse-pointer' | 'copilot';
}

const FORMAT_OPTIONS: FormatOption[] = [
  { key: 'agentsmd', label: 'AGENTS.md (universal)', hint: 'Single AGENTS.md at repo root', icon: 'file-text' },
  { key: 'claude',   label: 'Claude Code',           hint: 'CLAUDE.md plus five .claude/agents/*.md', icon: 'sparkles' },
  { key: 'cursor',   label: 'Cursor',                hint: '.cursor/rules/project.mdc',         icon: 'mouse-pointer' },
  { key: 'copilot',  label: 'GitHub Copilot',        hint: '.github/copilot-instructions.md',   icon: 'copilot' },
];

const DEFAULT_FORMATS: OutputFormat[] = ['agentsmd', 'claude'];

/**
 * Pick whether to surface a quota indicator and which bucket to show. We
 * surface the more restrictive bucket (per-user beats per-IP for URL flow)
 * and only when remaining is at or below the threshold — otherwise the
 * indicator is invisible noise.
 */
function pickQuotaToShow(
  snapshot: RateLimitSnapshot,
  tab: 'manual' | 'url',
): { limit: number; remaining: number; bucket: 'ip' | 'user' | 'anon-url' } | null {
  const QUOTA_THRESHOLD = 0.5; // show when ≤50% remaining
  const candidates: Array<{ bucket: 'ip' | 'user' | 'anon-url'; limit: number; remaining: number }> = [];
  if (snapshot.anonUrl && tab === 'url') candidates.push({ bucket: 'anon-url', ...snapshot.anonUrl });
  if (snapshot.user && tab === 'url') candidates.push({ bucket: 'user', ...snapshot.user });
  if (snapshot.ip) candidates.push({ bucket: 'ip', ...snapshot.ip });
  candidates.sort((a, b) => a.remaining - b.remaining);
  const top = candidates[0];
  if (!top) return null;
  if (top.remaining / top.limit > QUOTA_THRESHOLD) return null;
  return top;
}

function quotaLabel(bucket: 'ip' | 'user' | 'anon-url'): string {
  switch (bucket) {
    case 'user': return 'account scans';
    case 'anon-url': return 'free repo scans';
    case 'ip': return 'requests';
  }
}

function formatRetryMinutes(seconds: number): string {
  const m = Math.max(1, Math.ceil(seconds / 60));
  return m === 1 ? '1 minute' : `${m} minutes`;
}

interface RateLimitBannerProps {
  hit: RateLimitError;
  authEnabled: boolean;
  isSignedIn: boolean;
}

/**
 * Surface shown when /api/generate returns 429. Three variants:
 *   anon-url → primary signup CTA + countdown as secondary path
 *   user     → countdown only (already signed in, no upsell)
 *   ip       → countdown + soft signup pitch if not already in
 */
function RateLimitBanner({ hit, authEnabled, isSignedIn }: RateLimitBannerProps): JSX.Element {
  const retry = formatRetryMinutes(hit.retryAfterSeconds);

  if (hit.bucket === 'anon-url') {
    return (
      <div className="callout-rate-limit" role="alert">
        <p className="callout-rate-limit-title">
          You've used your {hit.limit ?? 5} free repo scans this hour.
        </p>
        <p className="callout-rate-limit-body">
          Sign in for more headroom — or wait {retry} to keep going as a guest.
        </p>
        <ul className="callout-rate-limit-perks">
          <li>30 scans per hour</li>
          <li>Per-account quota separate from this device's IP</li>
        </ul>
        {authEnabled && (
          <SignInButton
            mode="modal"
            forceRedirectUrl="/app?tab=url"
            signUpForceRedirectUrl="/app?tab=url"
          >
            <button type="button" className="btn btn-primary">
              Sign in with Prompd
            </button>
          </SignInButton>
        )}
      </div>
    );
  }

  if (hit.bucket === 'user') {
    return (
      <div className="callout-rate-limit" role="alert">
        <p className="callout-rate-limit-title">
          You've hit your hourly scan limit ({hit.limit ?? 30}/hr).
        </p>
        <p className="callout-rate-limit-body">Try again in {retry}.</p>
      </div>
    );
  }

  // ip bucket — applies to any request (manual or URL) from this address.
  return (
    <div className="callout-rate-limit" role="alert">
      <p className="callout-rate-limit-title">
        You've made {hit.limit ?? 30} requests from this address this hour.
      </p>
      <p className="callout-rate-limit-body">
        Try again in {retry}
        {authEnabled && !isSignedIn ? ' — or sign in to switch to the URL scanner with its own quota.' : '.'}
      </p>
      {authEnabled && !isSignedIn && (
        <SignInButton
          mode="modal"
          forceRedirectUrl="/app?tab=url"
          signUpForceRedirectUrl="/app?tab=url"
        >
          <button type="button" className="btn btn-secondary">
            Sign in with Prompd
          </button>
        </SignInButton>
      )}
    </div>
  );
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function detectHost(url: string): 'github' | 'bitbucket' | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === 'github.com' || host.endsWith('.github.com')) return 'github';
    if (host === 'bitbucket.org' || host.endsWith('.bitbucket.org') || host.endsWith('.bitbucket.io')) return 'bitbucket';
    return null;
  } catch {
    return null;
  }
}

export function InputPage({ onGenerated }: InputPageProps): JSX.Element {
  const auth = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab: Tab = searchParams.get('tab') === 'url' ? 'url' : 'manual';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitSnapshot>({});
  const [limitHit, setLimitHit] = useState<RateLimitError | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [languages, setLanguages] = useState('');
  const [frameworks, setFrameworks] = useState('');
  const [testRunners, setTestRunners] = useState('');
  const [packageManager, setPackageManager] = useState<PackageManager | ''>('');
  const [hasCI, setHasCI] = useState(false);
  const [license, setLicense] = useState('');

  const [repoUrl, setRepoUrl] = useState('');
  const detectedHost = repoUrl.trim().length > 0 ? detectHost(repoUrl.trim()) : null;
  const urlValid = detectedHost !== null;
  const lastTrackedHostRef = useRef<'github' | 'bitbucket' | null>(null);

  useEffect(() => {
    if (detectedHost && detectedHost !== lastTrackedHostRef.current) {
      lastTrackedHostRef.current = detectedHost;
      trackEvent({ name: 'repo_url_detected', host: detectedHost });
    } else if (!detectedHost) {
      lastTrackedHostRef.current = null;
    }
  }, [detectedHost]);

  const [formats, setFormats] = useState<Set<OutputFormat>>(() => new Set<OutputFormat>(DEFAULT_FORMATS));

  function toggleFormat(key: OutputFormat): void {
    setFormats((prev) => {
      const next = new Set(prev);
      const willCheck = !next.has(key);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      trackEvent({ name: 'format_toggle', format: key, checked: willCheck });
      return next;
    });
  }

  function handleTabChange(next: Tab): void {
    if (next === tab) return;
    setTab(next);
    // Persist tab in the URL so re-renders, reloads, and post-auth redirects
    // all restore the user to the tab they were on.
    const params = new URLSearchParams(searchParams);
    if (next === 'manual') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
    trackEvent({ name: 'source_tab_change', tab: next });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setLimitHit(null);
    setSubmitting(true);
    try {
      if (formats.size === 0) {
        throw new Error('Select at least one output format');
      }
      let request: GenerateRequest;
      const selectedFormats: OutputFormat[] = FORMAT_OPTIONS.filter((f) => formats.has(f.key)).map((f) => f.key);
      const langs = splitList(languages);
      const fws = splitList(frameworks);
      const runners = splitList(testRunners);
      if (tab === 'manual') {
        const profile: RepoProfile = {
          name: name.trim(),
          description: description.trim() || undefined,
          languages: langs,
          frameworks: fws,
          testRunners: runners,
          packageManager: packageManager || undefined,
          hasCI,
          license: license.trim() || undefined,
        };
        request = { source: { kind: 'manual', profile }, formats: selectedFormats };
      } else {
        if (!detectedHost) {
          throw new Error('Provide a valid GitHub or Bitbucket repository URL');
        }
        request = { source: { kind: detectedHost, url: repoUrl.trim() }, formats: selectedFormats };
      }
      trackEvent({
        name: 'generate_submit',
        tab,
        formats: selectedFormats,
        languages_count: tab === 'manual' ? langs.length : 0,
        frameworks_count: tab === 'manual' ? fws.length : 0,
        test_runners_count: tab === 'manual' ? runners.length : 0,
        has_description: tab === 'manual' && description.trim().length > 0,
      });
      const token = tab === 'url' ? await auth.getToken() : null;
      const { response, rateLimit: snapshot } = await generate(request, { token });
      setRateLimit(snapshot);
      trackEvent({
        name: 'generate_success',
        tab,
        file_count: response.files.length,
        formats: selectedFormats,
      });
      onGenerated(response);
    } catch (err) {
      if (err instanceof RateLimitError) {
        setRateLimit(err.rateLimit);
        setLimitHit(err);
        // Don't set the plain `error` string — the rich limit-hit block
        // replaces the inline banner for 429s.
      } else {
        const message = err instanceof Error ? err.message : 'unknown error';
        setError(message);
      }
      const message = err instanceof Error ? err.message : 'unknown error';
      trackEvent({ name: 'generate_error', tab, message });
    } finally {
      setSubmitting(false);
    }
  }

  // Show the rate-limit indicator only when remaining is getting close to
  // zero — at full quota it's invisible noise.
  const quotaStatus = pickQuotaToShow(rateLimit, tab);

  // URL tab is open to everyone — anon users hit the per-IP bucket (5/hr).
  // If Clerk is configured (`auth.enabled === true`), signed-in users get
  // a higher per-account ceiling. Either way, the URL form renders.
  const submitDisabled =
    submitting ||
    formats.size === 0 ||
    (tab === 'manual' ? !name.trim() : !urlValid);

  return (
    <div className="input-page">
      <header className="page-header">
        <p className="page-header-eyebrow">Generator</p>
        <h1 className="page-header-title">Build an agent pack</h1>
        <p className="page-header-hint">
          Describe your project, pick which assistant configs you want, and the server compiles the rendered files.
        </p>
      </header>
      <form className="input-card" onSubmit={handleSubmit}>
        <div className="input-card-body">
        <section className="form-section form-section-source" aria-labelledby="source-section-label">
          <div className="form-section-head">
            <p id="source-section-label" className="form-section-eyebrow">Project source</p>
            <p className="form-section-hint">Only the project name is required — fill in what you know.</p>
          </div>

          <div className="source-choice" role="radiogroup" aria-label="How to describe your project">
            <button
              type="button"
              role="radio"
              aria-checked={tab === 'manual'}
              data-active={tab === 'manual'}
              className="source-choice-card"
              onClick={() => handleTabChange('manual')}
            >
              <span className="source-choice-icon" aria-hidden="true">
                <Icon name="file-text" size={18} />
              </span>
              <span className="source-choice-text">
                <span className="source-choice-title">Describe your project</span>
                <span className="source-choice-hint">Type in your stack — free, no sign-in.</span>
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={tab === 'url'}
              data-active={tab === 'url'}
              className="source-choice-card"
              onClick={() => handleTabChange('url')}
            >
              <span className="source-choice-icon" aria-hidden="true">
                <Icon name="github" size={18} />
              </span>
              <span className="source-choice-text">
                <span className="source-choice-title">Scan a repository</span>
                <span className="source-choice-hint">Paste a GitHub or Bitbucket URL — 5 free scans/hr, more with sign-in.</span>
              </span>
            </button>
          </div>

          {tab === 'manual' ? (
            <div className="form-grid">
              <label className="field field-span-2">
                <span className="field-label">
                  Project name <span className="field-required" aria-hidden="true">*</span>
                </span>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={200}
                  placeholder="acme-checkout"
                />
              </label>
              <label className="field field-span-2">
                <span className="field-label">Description</span>
                <textarea
                  className="textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="One sentence on what the project does."
                />
              </label>
              <label className="field">
                <span className="field-label">Languages</span>
                <input
                  className="input"
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                  placeholder="TypeScript, Python"
                />
              </label>
              <label className="field">
                <span className="field-label">Frameworks</span>
                <input
                  className="input"
                  value={frameworks}
                  onChange={(e) => setFrameworks(e.target.value)}
                  placeholder="React, Express"
                />
              </label>
              <label className="field">
                <span className="field-label">Test runners</span>
                <input
                  className="input"
                  value={testRunners}
                  onChange={(e) => setTestRunners(e.target.value)}
                  placeholder="vitest, jest"
                />
              </label>
              <label className="field">
                <span className="field-label">Package manager</span>
                <select
                  className="select"
                  value={packageManager}
                  onChange={(e) => setPackageManager(e.target.value as PackageManager | '')}
                >
                  <option value="">(none)</option>
                  {PACKAGE_MANAGERS.map((pm) => (
                    <option key={pm} value={pm}>
                      {pm}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">License</span>
                <input
                  className="input"
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  placeholder="MIT"
                  maxLength={100}
                />
              </label>
              <label className="field-checkbox field-span-2">
                <input type="checkbox" checked={hasCI} onChange={(e) => setHasCI(e.target.checked)} />
                <span>Project has CI configured</span>
              </label>
            </div>
          ) : (
            <div className="form-grid">
              <label className="field field-span-2">
                <span className="field-label">
                  Repository URL <span className="field-required" aria-hidden="true">*</span>
                </span>
                <input
                  className="input input-mono"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                />
                {repoUrl.trim().length > 0 && (
                  <span className="field-hint field-hint-row">
                    {detectedHost === 'github' ? (
                      <>
                        <Icon name="github" size={14} />
                        Detected GitHub
                      </>
                    ) : detectedHost === 'bitbucket' ? (
                      <>
                        <Icon name="bitbucket" size={14} />
                        Detected Bitbucket
                      </>
                    ) : (
                      <>Use a github.com or bitbucket.org URL.</>
                    )}
                  </span>
                )}
              </label>
            </div>
          )}
        </section>

        <section className="form-section format-section" aria-labelledby="format-section-label">
          <div className="form-section-head">
            <p id="format-section-label" className="form-section-eyebrow">Output formats</p>
            <p className="form-section-hint">Pick the assistants you want configs for. Pick at least one.</p>
          </div>

          <div className="format-grid" role="group" aria-labelledby="format-section-label">
            {FORMAT_OPTIONS.map((opt) => {
              const checked = formats.has(opt.key);
              return (
                <label key={opt.key} className="format-card" data-checked={checked}>
                  <input
                    type="checkbox"
                    className="format-card-input"
                    checked={checked}
                    onChange={() => toggleFormat(opt.key)}
                  />
                  <span className="format-card-icon" aria-hidden="true">
                    <Icon name={opt.icon} size={20} />
                  </span>
                  <span className="format-card-text">
                    <span className="format-card-label">{opt.label}</span>
                    <span className="format-card-hint">{opt.hint}</span>
                  </span>
                  <span className="format-card-check" aria-hidden="true">
                    <Icon name="check" size={14} />
                  </span>
                </label>
              );
            })}
          </div>
        </section>
        </div>

        {limitHit ? (
          <RateLimitBanner hit={limitHit} authEnabled={auth.enabled} isSignedIn={auth.isSignedIn} />
        ) : error ? (
          <div className="callout-error" role="alert">
            {error}
          </div>
        ) : null}

        <div className="field-actions">
          {quotaStatus && (
            <span className="submit-quota" aria-live="polite" data-bucket={quotaStatus.bucket}>
              {quotaStatus.remaining} of {quotaStatus.limit} {quotaLabel(quotaStatus.bucket)} left this hour
            </span>
          )}
          {submitting && (
            <span className="submit-status" aria-live="polite">
              {tab === 'url'
                ? 'Scanning repository and compiling templates…'
                : 'Compiling templates…'}
            </span>
          )}
          <button type="submit" className="btn btn-primary btn-lg" disabled={submitDisabled}>
            {submitting ? (
              <>
                <Icon name="loader" size={16} className="spin" />
                Generating…
              </>
            ) : (
              <>
                Generate agent pack
                <Icon name="arrow-right" size={16} />
              </>
            )}
          </button>
        </div>
      </form>
      <div className="page-statusbar" role="contentinfo">
        <span className="page-statusbar-hint">
          {auth.enabled && auth.isSignedIn
            ? 'Signed in · 30 scans/hr'
            : 'Anon mode · 5 free repo scans/hr, manual is unlimited'}
        </span>
        <span className="page-statusbar-spacer" />
        <a
          href="https://github.com/prompd/prmd.ai"
          target="_blank"
          rel="noreferrer"
          onClick={() => trackEvent({ name: 'cta_click', cta: 'github_repo' })}
          aria-label="prmd.ai source on GitHub"
        >
          <Icon name="github" size={12} />
          <span>source</span>
        </a>
        <span className="page-statusbar-divider" aria-hidden="true">·</span>
        <a href="https://prompdhub.ai" target="_blank" rel="noreferrer">prompdhub.ai</a>
        <span className="page-statusbar-divider" aria-hidden="true">·</span>
        <a href="https://prompd.io" target="_blank" rel="noreferrer">prompd.io</a>
      </div>
    </div>
  );
}
