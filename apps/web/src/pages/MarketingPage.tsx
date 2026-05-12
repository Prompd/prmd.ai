import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { trackEvent } from '../lib/analytics';
import { useMetaDescription, useTitle } from '../lib/seo';

interface Feature {
  icon: 'wand' | 'package' | 'code';
  title: string;
  body: string;
}

const FEATURES: Feature[] = [
  {
    icon: 'wand',
    title: 'Scan or describe',
    body: 'Paste a GitHub URL and we read your package manifests, language stats, and README to build a project profile. Or describe your stack by hand if you\'d rather not share a URL — the manual flow needs no sign-in.',
  },
  {
    icon: 'package',
    title: 'Stack-aware, not generic',
    body: 'Output is tuned to what we actually detect. A Python CLI skips the frontend agent; a React + Express repo gets the accessibility sub-agent. Templates are versioned in a registry and rendered with your profile — no hand-prompted boilerplate.',
  },
  {
    icon: 'code',
    title: 'Preview, edit, download',
    body: 'Every generated file opens in a Monaco editor. Tweak the wording, drop a sub-agent you don\'t need, then download the whole pack as a ZIP ready to drop into your repo root.',
  },
];

export function MarketingPage(): JSX.Element {
  useTitle('prmd.ai — AGENTS.md, CLAUDE.md, and AI agent config generator');
  useMetaDescription(
    'Generate AGENTS.md, CLAUDE.md, Cursor rules, and GitHub Copilot instructions from any public GitHub repo or manual project details. Free, no signup for the manual flow.',
  );
  return (
    <div className="marketing">
      <section className="hero">
        <div className="hero-inner">
          <h1 className="hero-title">
            Agent instruction packs,{' '}
            <span className="hero-title-accent">compiled from your repo.</span>
          </h1>
          <p className="hero-subtitle">
            AGENTS.md, CLAUDE.md, Cursor rules, and Claude Code sub-agents — tuned to your stack, packaged as a ZIP.
          </p>
          <div className="hero-actions">
            <Link
              to="/app"
              className="btn btn-primary btn-lg"
              onClick={() => trackEvent({ name: 'cta_click', cta: 'open_generator_hero' })}
            >
              Open generator <Icon name="arrow-right" size={16} />
            </Link>
            <a
              href="#how"
              className="btn btn-lg"
              onClick={() => trackEvent({ name: 'cta_click', cta: 'how_it_works' })}
            >
              How it works
            </a>
          </div>
          <p className="hero-credit">
            Built with{' '}
            <a
              href="https://prompd.io"
              target="_blank"
              rel="noreferrer"
              onClick={() => trackEvent({ name: 'cta_click', cta: 'prompd_credit' })}
            >
              Prompd
            </a>
            , compiled from{' '}
            <a
              href="https://www.prompdhub.ai/packages/@prmd-ai/agent-pack"
              target="_blank"
              rel="noreferrer"
              onClick={() => trackEvent({ name: 'cta_click', cta: 'agent_pack' })}
            >
              @prmd-ai/agent-pack
            </a>
            .
          </p>

          <div className="hero-card">
            <div className="hero-code">
              <div className="hero-code-bar">
                <span className="hero-code-dot" />
                <span className="hero-code-dot" />
                <span className="hero-code-dot" />
                <span className="hero-code-name">AGENTS.md</span>
              </div>
              <div className="code-comment"># AGENTS.md</div>
              <div>&nbsp;</div>
              <div>## Project Overview</div>
              <div>&nbsp;</div>
              <div>
                acme — a demo project
              </div>
              <div>- Languages: <span className="code-string">TypeScript, Python</span></div>
              <div>- Frameworks: <span className="code-string">React, Express</span></div>
              <div>- Test runners: <span className="code-string">vitest</span></div>
              <div>- Package manager: <span className="code-string">npm</span></div>
              <div>- CI configured: <span className="code-string">yes</span></div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="section">
        <div className="section-inner">
          <div className="section-head">
            <p className="section-eyebrow">How it works</p>
            <h2 className="section-title">From repo URL to downloadable zip in three steps.</h2>
          </div>
          <div className="feature-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="feature-card">
                <div className="feature-icon">
                  <Icon name={f.icon} size={20} />
                </div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-body">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <span>prmd.ai · part of the Prompd ecosystem</span>
          <div className="site-footer-links">
            <a
              href="https://github.com/prompd/prmd.ai"
              target="_blank"
              rel="noreferrer"
              onClick={() => trackEvent({ name: 'cta_click', cta: 'github_repo' })}
              aria-label="prmd.ai source on GitHub"
            >
              <Icon name="github" size={14} />
              <span>source</span>
            </a>
            <a href="https://prompdhub.ai" target="_blank" rel="noreferrer">
              prompdhub.ai
            </a>
            <a href="https://prompd.io" target="_blank" rel="noreferrer">
              prompd.io
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
