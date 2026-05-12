import { join } from 'node:path';
import { PrompdCompiler as PrompdCompilerImpl, NodeFileSystem } from '@prompd/cli';
import type { EnrichedProfile, GeneratedFile, GeneratedFileLanguage, OutputFormat } from '@prmd/shared';
import { API_ROOT, getAgentPackPath } from './package-resolver.js';

export interface PrompdCompilerAdapter {
  compile(profile: EnrichedProfile, formats?: OutputFormat[]): Promise<GeneratedFile[]>;
}

interface TemplateEntry {
  source: string;
  outputPath: string;
  language: GeneratedFileLanguage;
  format: OutputFormat;
  /**
   * Optional relevance filter. Return true to include this template for the
   * given profile, false to skip. Templates without a filter are always
   * included when their format is selected.
   *
   * Used to drop role-specialist sub-agents (frontend / backend / testing)
   * from the output when the profile clearly doesn't need them. Code review
   * and security review apply to every project so they have no filter.
   */
  includeWhen?: (profile: EnrichedProfile) => boolean;
  /**
   * Extra key/value pairs appended to the Claude Code subagent YAML
   * frontmatter (after name / description / template). Strings only —
   * the template renders them verbatim as `key: value`, so callers are
   * responsible for any YAML escaping. Empty/undefined means no extras.
   *
   * Typical use: per-agent model selection (`model: opus` for high-stakes
   * reviewers, `model: haiku` for routine work).
   *
   * Note: persona / voice overrides DO NOT live here — those flow through
   * Prompd's `inherits:` parameter system (child .prmd files declare their
   * own `persona` default). Only `type: json` defaults fail to inherit,
   * which is why `frontmatter` has to be overridden in compiler.ts.
   */
  frontmatter?: Record<string, string>;
  /**
   * Slug + one-line description used to render the "Sub-agents" list in
   * AGENTS.md and CLAUDE.md. Only set for templates that produce a Claude
   * Code subagent under `.claude/agents/`. Driving the list from this field
   * keeps the documentation in sync with what actually shipped — when the
   * relevance filter drops an agent, it also drops out of the list.
   */
  subagent?: { slug: string; description: string };
}

// Framework names we recognize as frontend signals. Mirrors the display names
// emitted by the scanner's detection table (apps/api/src/scanners/detection.ts).
const FRONTEND_FRAMEWORKS = new Set<string>([
  'React', 'Vue', 'Svelte', 'Angular', 'Solid',
  'Next.js', 'Nuxt', 'Remix', 'Astro',
  'Vite', 'Webpack', 'Rollup', 'esbuild',
  'Electron', 'React Native',
  'Blazor', 'Razor', 'MAUI',
]);

const BACKEND_FRAMEWORKS = new Set<string>([
  'Express', 'Fastify', 'NestJS', 'Koa', 'Hono', 'tRPC',
  'Prisma', 'Drizzle',
  'Django', 'FastAPI', 'Flask', 'Starlette', 'Pyramid', 'Tornado', 'Litestar',
  'Ruby on Rails', 'Sinatra', 'Hanami',
  'Gin', 'Echo', 'Fiber', 'Chi', 'Gorilla Mux',
  'Axum', 'Actix Web', 'Rocket', 'Warp',
  'Laravel', 'Symfony', 'CakePHP', 'Slim',
  'ASP.NET Core', 'Entity Framework', 'Dapper',
]);

// CLI parser / TUI libraries. A repo using any of these almost certainly
// ships a command-line entry point and benefits from the cli specialist.
const CLI_FRAMEWORKS = new Set<string>([
  'Click', 'Typer', 'Fire', 'docopt',
  'Commander', 'yargs', 'oclif', 'cac', 'meow', 'Ink',
  'Cobra', 'urfave/cli',
  'Clap',
  'Thor',
  'System.CommandLine', 'CommandLineParser', 'Spectre.Console',
]);

function hasFrontendSignal(profile: EnrichedProfile): boolean {
  return profile.frameworks.some((f) => FRONTEND_FRAMEWORKS.has(f));
}

function hasBackendSignal(profile: EnrichedProfile): boolean {
  return profile.frameworks.some((f) => BACKEND_FRAMEWORKS.has(f));
}

function hasCliSignal(profile: EnrichedProfile): boolean {
  if (profile.kind === 'cli') return true;
  return profile.frameworks.some((f) => CLI_FRAMEWORKS.has(f));
}

/**
 * When the LLM classifies the project as a pure CLI, the frontend and
 * backend specialists are usually noise — there's no UI, no API surface.
 * Sub-CLI tools (e.g. a CLI that calls services internally) can still ship
 * the backend agent if the LLM tagged frameworks accordingly; this gate
 * only fires on the strong `kind === 'cli'` signal.
 */
function isPureCli(profile: EnrichedProfile): boolean {
  return profile.kind === 'cli';
}

/**
 * When we know nothing about the profile's frameworks, include all specialists
 * — it's safer to ship a slightly bigger pack than to drop an agent the user
 * actually needs. Only skip when we have explicit framework info that
 * contradicts the agent's relevance.
 */
function hasNoFrameworkInfo(profile: EnrichedProfile): boolean {
  return profile.frameworks.length === 0;
}

const TEMPLATES: TemplateEntry[] = [
  { source: 'AGENTS.md',                           outputPath: 'AGENTS.md',                          language: 'markdown', format: 'agentsmd' },
  { source: 'CLAUDE.md',                           outputPath: 'CLAUDE.md',                          language: 'markdown', format: 'claude' },
  { source: 'cursor-rules.md',                     outputPath: '.cursor/rules/project.mdc',          language: 'markdown', format: 'cursor' },
  { source: 'copilot-instructions.md',             outputPath: '.github/copilot-instructions.md',    language: 'markdown', format: 'copilot' },
  {
    source: 'agents/frontend-agent.prmd',
    outputPath: '.claude/agents/frontend.md',
    language: 'markdown',
    format: 'claude',
    includeWhen: (p) => !isPureCli(p) && (hasNoFrameworkInfo(p) || hasFrontendSignal(p)),
    subagent: { slug: 'frontend', description: 'UI, components, styling, client-side logic.' },
  },
  {
    source: 'agents/backend-agent.prmd',
    outputPath: '.claude/agents/backend.md',
    language: 'markdown',
    format: 'claude',
    includeWhen: (p) => !isPureCli(p) && (hasNoFrameworkInfo(p) || hasBackendSignal(p)),
    subagent: { slug: 'backend', description: 'APIs, server logic, data access, integrations.' },
  },
  {
    source: 'agents/cli-agent.prmd',
    outputPath: '.claude/agents/cli.md',
    language: 'markdown',
    format: 'claude',
    includeWhen: (p) => hasCliSignal(p),
    subagent: { slug: 'cli', description: 'Command-line tools: arguments, subcommands, exit codes, terminal UX.' },
  },
  {
    source: 'agents/testing-agent.prmd',
    outputPath: '.claude/agents/testing.md',
    language: 'markdown',
    format: 'claude',
    subagent: { slug: 'testing', description: 'Test design, coverage, and test infrastructure.' },
  },
  {
    source: 'agents/code-reviewer-agent.prmd',
    outputPath: '.claude/agents/code-reviewer.md',
    language: 'markdown',
    format: 'claude',
    // Code review benefits from deep reasoning — Claude Code routes this agent
    // to opus instead of the user's global default.
    frontmatter: { model: 'opus' },
    subagent: { slug: 'code-reviewer', description: 'Change review for correctness, security, performance, and tests.' },
  },
  {
    source: 'agents/security-reviewer-agent.prmd',
    outputPath: '.claude/agents/security-reviewer.md',
    language: 'markdown',
    format: 'claude',
    // Security analysis is high-stakes — same reasoning as code-reviewer.
    frontmatter: { model: 'opus' },
    subagent: { slug: 'security-reviewer', description: 'Security-focused review — injection, auth, secrets, dependencies.' },
  },
  {
    source: 'agents/docs-writer-agent.prmd',
    outputPath: '.claude/agents/docs-writer.md',
    language: 'markdown',
    format: 'claude',
    // Docs are routine and high-frequency — bias toward cost over depth.
    frontmatter: { model: 'haiku' },
    subagent: { slug: 'docs-writer', description: 'README, API reference, changelog, and doc comments.' },
  },
  {
    source: 'agents/devops-agent.prmd',
    outputPath: '.claude/agents/devops.md',
    language: 'markdown',
    format: 'claude',
    subagent: { slug: 'devops', description: 'CI/CD pipelines, Dockerfiles, deploy configs, secrets, observability.' },
  },
  {
    source: 'agents/a11y-agent.prmd',
    outputPath: '.claude/agents/a11y.md',
    language: 'markdown',
    format: 'claude',
    includeWhen: (p) => !isPureCli(p) && hasFrontendSignal(p),
    subagent: { slug: 'a11y', description: 'Keyboard navigation, screen reader behavior, semantic HTML, contrast.' },
  },
];

export interface PrompdCompilerAdapterOptions {
  workspaceRoot?: string;
}

export function createPrompdCompilerAdapter(
  options: PrompdCompilerAdapterOptions = {},
): PrompdCompilerAdapter {
  const workspaceRoot = options.workspaceRoot ?? API_ROOT;
  const compiler = new PrompdCompilerImpl();
  const fileSystem = new NodeFileSystem();

  return {
    async compile(profile, formats) {
      const packagePath = await getAgentPackPath();

      const selected = formats && formats.length > 0 ? new Set<OutputFormat>(formats) : null;
      const templates = TEMPLATES.filter((t) => {
        if (selected !== null && !selected.has(t.format)) return false;
        if (t.includeWhen && !t.includeWhen(profile)) return false;
        return true;
      });

      // When AGENTS.md is part of the output, CLAUDE.md can defer to it for the
      // shared rules instead of duplicating project context / out-of-scope.
      const hasAgentsMd = selected === null || selected.has('agentsmd');

      // Build the subagents list from what actually shipped this compile.
      // Drives the "Sub-agents" bulleted list in AGENTS.md and CLAUDE.md so
      // the documentation never claims an agent the user didn't get.
      const subagents = templates
        .map((t) => t.subagent)
        .filter((s): s is NonNullable<typeof s> => s !== undefined);

      const files: GeneratedFile[] = [];

      for (const entry of templates) {
        const sourcePath = join(packagePath, entry.source);
        // Fresh parameters object per compile — the compiler's semantic stage
        // mutates this object to apply defaults, so reusing leaks state across
        // sibling templates (e.g. frontend's agent_slug into backend's render).
        const parameters: Record<string, unknown> = { profile };
        if (entry.source === 'CLAUDE.md') {
          parameters.hasAgentsMd = hasAgentsMd;
          parameters.subagents = subagents;
        }
        if (entry.source === 'AGENTS.md') {
          parameters.subagents = subagents;
        }
        // Always pass `frontmatter` so the template's for-loop has a value to
        // iterate. Templates with no extras get an empty object → loop emits
        // nothing → frontmatter block stays at the existing three lines.
        parameters.frontmatter = entry.frontmatter ?? {};
        const contents = await compiler.compile(sourcePath, {
          parameters,
          outputFormat: 'markdown',
          fileSystem,
          workspaceRoot,
        });
        files.push({
          path: entry.outputPath,
          contents,
          language: entry.language,
        });
      }

      return files.sort((a, b) => a.path.localeCompare(b.path));
    },
  };
}
