## Refer to the following file for instructions
./AGENTS.md

## Adding a new specialist sub-agent

The "Sub-agents" list rendered in generated `AGENTS.md` and `CLAUDE.md` files is driven by [apps/api/src/compiler.ts](apps/api/src/compiler.ts)'s `TEMPLATES` array — specifically the `subagent: { slug, description }` field on each entry. The pack's `AGENTS.md` / `CLAUDE.md` templates iterate over whatever shipped this compile, so the list always matches what's actually in `.claude/agents/`.

To add a new sub-agent (e.g. `release-manager`):

1. **Create the template** at `prompds/agents/release-manager-agent.prmd`. Inherit from `agents/agent-base.prmd`, set the four defaults (`agent_slug`, `agent_title`, `agent_summary`, `templateName`), and override `persona` for role-specific voice.
2. **Add to the pack manifest** — list the new file in `prompds/prompd.json`'s `files` array and bump the version.
3. **Publish** the new pack version to prompdhub.ai via the Prompd app.
4. **Pin & install** in the API — bump `apps/api/prompd.json` dep to the new version and run `npx prompd install @prmd-ai/agent-pack@<version>` from `apps/api/`.
5. **Wire routing** in [apps/api/src/compiler.ts](apps/api/src/compiler.ts) — add a `TEMPLATES` entry with `source`, `outputPath`, `format: 'claude'`, optional `includeWhen` predicate, optional `frontmatter` kvps (e.g. `{ model: 'opus' }`), and the new `subagent: { slug, description }` for the bullet list.

Steps 1–4 ship the template. Step 5 wires routing + relevance gating + descriptions in one place. The list in the generated `AGENTS.md` updates automatically — no template edits needed.

When **removing** an agent, do the inverse: drop the `TEMPLATES` entry first (stops shipping it), then remove the file from `prompd.json`'s `files` array on the next pack version.

## Not "fully dynamic" — and why

`subagent.description` lives in `compiler.ts` rather than being parsed from the `.prmd` file's frontmatter. Parsing the `.prmd` frontmatter at compile time would shave one editing step but would require: a YAML parser at the runtime layer, caching the parse, and accepting the `.prmd`'s `agent_summary` (typically a full sentence) as the list description instead of the current tight phrasing. The single editing point in `compiler.ts` is the deliberate trade — touch one file per new agent, get short list descriptions, keep `includeWhen` + `frontmatter` kvps co-located.
