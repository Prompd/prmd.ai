export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'pip' | 'poetry' | 'go' | 'cargo' | 'nuget' | 'other';

export interface RepoProfile {
  name: string;
  description?: string;
  languages: string[];
  frameworks: string[];
  testRunners: string[];
  packageManager?: PackageManager;
  hasCI: boolean;
  license?: string;
}

export type SuggestedSkill =
  | 'code-review'
  | 'testing'
  | 'security-review'
  | 'refactor-planning'
  | 'api-documentation'
  | 'release-notes';

export type RepoKind = 'cli' | 'webapp' | 'service' | 'library' | 'monorepo';

export interface EnrichedProfile extends RepoProfile {
  primaryLanguage?: string;
  summary?: string;
  architectureNotes?: string;
  suggestedSkills?: SuggestedSkill[];
  /**
   * High-level classification produced by the LLM enricher. Used by the
   * compiler's relevance filter to pick which specialist sub-agents ship.
   * Undefined when enrichment didn't run or couldn't classify.
   */
  kind?: RepoKind;
  /**
   * Short, concrete project-specific notes extracted by the LLM from the
   * README — e.g. "Uses MongoDB Atlas for primary storage", "All routes
   * prefixed with /api/v1". Surfaced in every sub-agent's project context
   * so the agents can be opinionated about the actual project, not generic
   * best practice. Capped at 7 items, each ≤200 chars by the enricher
   * schema. Untrusted-source — the LLM is instructed to treat the README
   * as data, but downstream consumers should still treat these as informed
   * summaries rather than verified facts.
   */
  keyPoints?: string[];
}

export type GeneratedFileLanguage = 'markdown' | 'json';

export interface GeneratedFile {
  path: string;
  contents: string;
  language: GeneratedFileLanguage;
}

export type RepoUrlHost = 'github' | 'bitbucket';

export type GenerateSource =
  | { kind: 'manual'; profile: RepoProfile }
  | { kind: 'github'; url: string }
  | { kind: 'bitbucket'; url: string };

export type OutputFormat = 'agentsmd' | 'claude' | 'cursor' | 'copilot';

export interface GenerateRequest {
  source: GenerateSource;
  formats?: OutputFormat[];
}

export interface GenerateResponse {
  profile: EnrichedProfile;
  files: GeneratedFile[];
}

export interface DownloadRequest {
  name: string;
  files: GeneratedFile[];
}
