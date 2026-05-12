# @prmd-ai/agent-pack

The Prompd pack that powers [prmd.ai](https://prmd.ai/) — a set of templates
that compile into AI agent instruction files (`AGENTS.md`, `CLAUDE.md`,
Cursor rules, GitHub Copilot instructions, and Claude Code sub-agents) for
any repository.

## What it ships

| File | Purpose |
|---|---|
| `sumerize-metadata.prmd` | LLM prompt that turns a deterministic repo scan + README into an enriched profile (description, summary, `kind` classification, `keyPoints`, suggested skills). Treats READMEs as untrusted data — won't follow injected instructions. |
| `AGENTS.md` | Universal agent instructions, rendered from the enriched profile. |
| `CLAUDE.md` | Claude Code project file — either a pointer to `AGENTS.md` (default) or a self-contained version when `AGENTS.md` isn't shipped. |
| `cursor-rules.md` | Cursor IDE rules file. |
| `copilot-instructions.md` | GitHub Copilot custom instructions. |
| `agents/agent-base.prmd` | Shared base for the specialist sub-agents — handles project context, working rules, and the Claude Code subagent frontmatter. |
| `agents/*-agent.prmd` | Specialist sub-agents (see below). Each inherits from `agent-base.prmd` and contributes role-specific guidance. |

## Specialist sub-agents

Each specialist is shipped as a separate Claude Code sub-agent under
`.claude/agents/`. The prmd.ai compiler picks which to include based on
the repo's detected frameworks and the LLM's `kind` classification.

| Agent | Voice | When it ships |
|---|---|---|
| `frontend` | Component clarity, native HTML over custom widgets | Frontend framework detected (React, Vue, Svelte, Angular, Next.js, etc.) |
| `backend` | Hostile input, idempotency, observability | Backend framework detected (Express, Fastify, FastAPI, Django, Rails, Gin, etc.) |
| `cli` | Piping, exit codes, stderr vs stdout discipline | CLI library detected (Click, Cobra, Clap, Commander, etc.) or `kind: cli` |
| `testing` | Edge cases first, mock at the seam, flake triage | Always |
| `code-reviewer` | Defend the merge six months out | Always — gets `model: opus` in frontmatter |
| `security-reviewer` | Read every change as if an attacker authored it | Always — gets `model: opus` |
| `docs-writer` | Write for someone with 15 minutes | Always — gets `model: haiku` |
| `devops` | Pin everything, least-privilege every token | Always |
| `a11y` | Keyboard + screen reader only | Frontend signal present |

## How prmd.ai uses it

The prmd.ai backend installs this pack via `prompd install`, then compiles
the requested templates with the user's enriched repo profile. The pack
version is pinned in the API's `prompd.json` so deploys are reproducible.

Output flow:

```
URL or manual input
  → deterministic scan (package.json / pyproject / Cargo.toml / .csproj / etc.)
  → LLM enrichment via sumerize-metadata.prmd (READMEs treated as data, not instructions)
  → compile selected templates with the enriched profile
  → ZIP of .md files the user drops into their repo
```

## Using the pack directly

```bash
# From a project that has prompd.json with this pack as a dependency
prompd install @prmd-ai/agent-pack
prompd compile @prmd-ai/agent-pack/AGENTS.md --params metadata=...
```

You'd typically consume this through prmd.ai's hosted compiler instead —
it does the deterministic scan, LLM enrichment, and template selection for
you. Direct use is for forking and customizing.

## Customization

To build your own variant:

1. Fork this repo / copy the `prompds/` directory.
2. Edit any template — the `agents/*-agent.prmd` files are the main place
   to change voice or add role-specific guidance.
3. Override the persona for a child agent by setting its `persona`
   parameter default (see `agents/code-reviewer-agent.prmd` for an
   example).
4. Add new agents by creating `agents/your-agent.prmd` that inherits from
   `agent-base.prmd`, then list the new file in `prompd.json`'s `files`.
5. Bump `prompd.json` version and publish to your own scope on prompdhub.

## Source & license

- Source: [github.com/Prompd/prmd.ai](https://github.com/Prompd/prmd.ai) — see the `prompds/` directory.
- License: MIT.

The pack is iterated alongside prmd.ai; bump versions are listed at
[prompdhub.ai/packages/@prmd-ai/agent-pack](https://www.prompdhub.ai/packages/@prmd-ai/agent-pack).
