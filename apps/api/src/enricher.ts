import { join } from 'node:path';
import { PrompdExecutor, NodeFileSystem } from '@prompd/cli';
import { z } from 'zod';
import type { EnrichedProfile, RepoKind, RepoProfile, SuggestedSkill } from '@prmd/shared';
import type { ScanResult } from './scanner.js';
import { getAgentPackPath } from './package-resolver.js';

export interface ProfileEnricher {
  enrich(scan: ScanResult): Promise<EnrichedProfile>;
}

function withPrimaryLanguage(profile: RepoProfile): EnrichedProfile {
  const primaryLanguage = profile.languages[0];
  const enriched: EnrichedProfile = { ...profile };
  if (primaryLanguage) enriched.primaryLanguage = primaryLanguage;
  return enriched;
}

export function createPassthroughEnricher(): ProfileEnricher {
  return {
    async enrich(scan) {
      return withPrimaryLanguage(scan.profile);
    },
  };
}

const SUGGESTED_SKILLS: SuggestedSkill[] = [
  'code-review',
  'testing',
  'security-review',
  'refactor-planning',
  'api-documentation',
  'release-notes',
];

const REPO_KINDS: RepoKind[] = ['cli', 'webapp', 'service', 'library', 'monorepo'];

const enricherResponseSchema = z.object({
  description: z.string().max(2000).optional(),
  primaryLanguage: z.string().max(50).optional(),
  languages: z.array(z.string().max(50)).max(50).optional(),
  frameworks: z.array(z.string().max(50)).max(50).optional(),
  testRunners: z.array(z.string().max(50)).max(50).optional(),
  summary: z.string().max(2000).optional(),
  architectureNotes: z.string().max(1000).optional(),
  kind: z.enum(REPO_KINDS as [RepoKind, ...RepoKind[]]).optional(),
  // Concrete project-specific notes the LLM extracts from the README and
  // metadata. Bounded tightly so injected content can't expand into an
  // unbounded payload landing in the agent files.
  keyPoints: z.array(z.string().max(200)).max(7).optional(),
  suggestedSkills: z.array(z.enum(SUGGESTED_SKILLS as [SuggestedSkill, ...SuggestedSkill[]])).max(20).optional(),
});

function stripJsonFences(text: string): string {
  let s = text.trim();
  // Common LLM wrapper: ```json ... ``` or ``` ... ```
  if (s.startsWith('```')) {
    const firstNewline = s.indexOf('\n');
    if (firstNewline !== -1) s = s.slice(firstNewline + 1);
    if (s.endsWith('```')) s = s.slice(0, -3).trimEnd();
  }
  return s.trim();
}

export interface LLMEnricherOptions {
  apiKey: string;
  model?: string;
  enricherFileName?: string;
  log?: (message: string) => void;
}

export function createLLMEnricher(opts: LLMEnricherOptions): ProfileEnricher {
  const executor = new PrompdExecutor();
  const fileSystem = new NodeFileSystem();
  const model = opts.model ?? 'gemini-2.5-flash';
  const enricherFileName = opts.enricherFileName ?? 'sumerize-metadata.prmd';
  const log = opts.log ?? (() => {});

  return {
    async enrich(scan) {
      const profile = scan.profile;
      const fallback = withPrimaryLanguage(profile);
      try {
        const packagePath = await getAgentPackPath();
        const enricherPath = join(packagePath, enricherFileName);

        // README is passed as a separate parameter so the prompt template
        // can render it inside a quoted block with anti-injection framing.
        // Empty string when absent so the template's conditional sees a
        // consistent value.
        const result = await executor.execute(enricherPath, {
          provider: 'google',
          model,
          apiKey: opts.apiKey,
          params: { metadata: profile, readme: scan.readme ?? '' },
          fileSystem,
        });

        if (!result.success) {
          log(`enricher: provider error - ${result.error ?? 'unknown'}`);
          return fallback;
        }
        const text = result.response ?? result.content ?? '';
        if (!text.trim()) {
          log('enricher: empty response');
          return fallback;
        }

        const cleaned = stripJsonFences(text);
        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(cleaned);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'unknown';
          log(`enricher: JSON parse failed (${message})`);
          return fallback;
        }

        const validation = enricherResponseSchema.safeParse(parsedJson);
        if (!validation.success) {
          log(`enricher: schema validation failed - ${validation.error.message}`);
          return fallback;
        }

        const llm = validation.data;
        log(
          `enricher: LLM enrichment succeeded — readme=${scan.readme ? `${scan.readme.length}b` : 'no'}, kind=${llm.kind ?? 'unset'}, keyPoints=${llm.keyPoints?.length ?? 0}, summary=${llm.summary ? 'yes' : 'no'}`,
        );
        const merged: EnrichedProfile = {
          ...profile,
          ...(llm.description !== undefined ? { description: llm.description } : {}),
          ...(llm.languages !== undefined ? { languages: llm.languages } : {}),
          ...(llm.frameworks !== undefined ? { frameworks: llm.frameworks } : {}),
          ...(llm.testRunners !== undefined ? { testRunners: llm.testRunners } : {}),
          ...(llm.summary !== undefined ? { summary: llm.summary } : {}),
          ...(llm.architectureNotes !== undefined ? { architectureNotes: llm.architectureNotes } : {}),
          ...(llm.kind !== undefined ? { kind: llm.kind } : {}),
          ...(llm.keyPoints !== undefined ? { keyPoints: llm.keyPoints } : {}),
          ...(llm.suggestedSkills !== undefined ? { suggestedSkills: llm.suggestedSkills } : {}),
        };
        merged.primaryLanguage = llm.primaryLanguage ?? merged.languages[0];
        if (!merged.primaryLanguage) delete merged.primaryLanguage;
        return merged;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown';
        log(`enricher: unexpected failure - ${message}`);
        return fallback;
      }
    },
  };
}
