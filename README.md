# prmd.ai

Generate AI coding-agent instruction packs from a GitHub URL or a short manual stack description. Outputs `AGENTS.md`, `CLAUDE.md`, Cursor rules, GitHub Copilot instructions, and a relevance-filtered set of Claude Code sub-agents under `.claude/agents/` — packaged as a ZIP you drop into your repo.

Live at **[prmd.ai](https://prmd.ai)**.

## What it does

You give prmd.ai a GitHub repo URL (or describe your stack by hand). It:

1. Scans the repo's root manifests (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `.csproj`, `Gemfile`, `composer.json`) and the GitHub languages stat.
2. Enriches that with an LLM pass (Gemini 2.5 Flash) — but only the deterministic profile + a size-capped README, with anti-injection framing so a malicious README can't slip instructions into your output.
3. Picks which specialist sub-agents to ship based on what was detected (frontend / backend / cli / a11y / docs-writer / devops / testing / code-reviewer / security-reviewer).
4. Compiles the [`@prmd-ai/agent-pack`](https://www.prompdhub.ai/packages/@prmd-ai/agent-pack) Prompd template into the selected output formats.
5. Returns a ZIP of `.md` files you drop straight into your repo's root.

The agent files include a "Project context" block populated from the scan, a per-agent persona, and (for URL flows) project-specific notes the LLM extracted from your README — so the agents are grounded in your project, not generic best practices.

## Project layout

```
apps/
  api/                   Express + tsx backend (Cloud Run)
    src/
      scanners/          deterministic repo + README fetch (GitHub today, Bitbucket TBD)
      enricher.ts        LLM enrichment via @prompd/cli executor
      compiler.ts        template selection + relevance gating
      rate-limit.ts      per-IP + per-user buckets
      routes/            generate, download, feedback, health
      models/            Mongoose models (User, Usage, Feedback)
    prompd.json          pinned @prmd-ai/agent-pack version
    Dockerfile
  web/                   React + Vite SPA + nginx (Cloud Run)
    src/                 marketing + generator + preview pages
    Dockerfile           Vite build → nginx with /api/* proxy

packages/
  shared/                cross-workspace types (RepoProfile, etc.)

prompds/                 Source of the @prmd-ai/agent-pack Prompd package
  agents/                role-specialist templates (frontend, backend, cli, ...)
  sumerize-metadata.prmd LLM enricher prompt with anti-injection rule
  AGENTS.md / CLAUDE.md  output templates
  prompd.json            pack manifest, published to prompdhub.ai

deployment/              Cloud Build configs + GCP setup scripts
```

## Local development

Prerequisites: Node 20+, npm, MongoDB (optional — falls back to no persistence).

```bash
git clone https://github.com/prompd/prmd.ai
cd prmd.ai
npm install
```

Copy the env templates and fill in the values you have:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Minimum required for a working local dev: `GOOGLE_API_KEY` (free tier at [aistudio.google.com](https://aistudio.google.com/apikey)) and `GITHUB_TOKEN` (PAT with `public_repo` scope). Everything else degrades gracefully.

Then in two terminals:

```bash
npm run dev:api     # Express on :3130
npm run dev:web     # Vite on :5173
```

Visit `http://localhost:5173`. The web's dev server proxies `/api/*` to the api.

## Deployment

Deploys to Google Cloud Run via Cloud Build. See [deployment/README.md](deployment/README.md) for the full runbook — secrets, IAM, services, domain mappings.

Two services: `api-prmd-ai` (Express) and `prmd-ai` (nginx + Vite SPA, proxies `/api/*` to the api service). Sized small (`512Mi/1CPU` api, `256Mi/1CPU` web) with `min-instances: 0` so they scale to zero when idle.

## Architecture notes

- **No source code leaves the server.** prmd.ai never sends repo source to the LLM — only the deterministic profile (frameworks, languages) and a size-capped README, framed as untrusted data.
- **Anti-injection prompt framing.** The enricher's system prompt explicitly instructs the LLM to treat the README as data, never as instructions. The LLM's output is then schema-validated with `zod` so a successful injection can't expand into an unbounded payload landing in your agent files.
- **Per-IP rate limit** (5/hr anon URL, 30/hr per IP overall, 30/hr per signed-in user) protects the Gemini free tier from abuse and caps drift if one bad actor tries to spam.
- **Usage logging** (Mongo, optional) records every generate event with a 7-day TTL — used for the rate-limit count and for spotting unusual patterns.
- **Pack versioning.** The agent templates are a versioned [Prompd package](https://www.prompdhub.ai/packages/@prmd-ai/agent-pack) — the api pins a specific version in `apps/api/prompd.json`, so deploys are reproducible.

## License

[Elastic License 2.0](./LICENSE) — source-available, free for non-SaaS use. Hosting prmd.ai or substantially similar functionality as a service to third parties is not licensed. Build with it, fork it, run it yourself; just don't resell it as a hosted product.

## Built with Prompd

The agent templates that drive prmd.ai are themselves a [Prompd](https://prompd.app) package. If you want to fork the pack and ship your own variant with different agents or different voice, the templates live in [`prompds/`](./prompds/) — see [`prompds/README.md`](./prompds/README.md) for the customization path.
