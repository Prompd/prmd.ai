import type { PackageManager, RepoProfile } from '@prmd/shared';
import {
  inferJsPackageManager,
  parseCargoToml,
  parseComposerJson,
  parseDotNetProject,
  parseGemfile,
  parseGoMod,
  parsePackageJson,
  parsePyproject,
  parseRequirementsTxt,
  type Detections,
} from './detection.js';

const GITHUB_API = 'https://api.github.com';
const USER_AGENT = 'prmd-ai/0.1';

export interface GitHubScannerOptions {
  token?: string;
  fetcher?: typeof fetch;
}

interface RepoMeta {
  name?: string;
  description?: string | null;
  license?: { spdx_id?: string | null } | null;
  default_branch?: string;
}

interface RepoContentsItem {
  name: string;
  path: string;
  type: 'file' | 'dir' | 'submodule' | 'symlink';
}

type ParserKey =
  | 'package.json'
  | 'pyproject.toml'
  | 'requirements.txt'
  | 'go.mod'
  | 'Cargo.toml'
  | 'Gemfile'
  | 'composer.json';

const PARSERS: Record<ParserKey, (text: string, d: Detections) => void> = {
  'package.json': parsePackageJson,
  'pyproject.toml': parsePyproject,
  'requirements.txt': parseRequirementsTxt,
  'go.mod': parseGoMod,
  'Cargo.toml': parseCargoToml,
  Gemfile: parseGemfile,
  'composer.json': parseComposerJson,
};

const PARSER_FILES: ParserKey[] = [
  'package.json',
  'pyproject.toml',
  'requirements.txt',
  'go.mod',
  'Cargo.toml',
  'Gemfile',
  'composer.json',
];

const JS_LOCKFILES = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', 'bun.lock'] as const;

function isParserKey(name: string): name is ParserKey {
  return PARSER_FILES.includes(name as ParserKey);
}

export class GitHubScannerError extends Error {
  public readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'GitHubScannerError';
    this.status = status;
  }
}

function authHeaders(token: string | undefined): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': USER_AGENT,
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function fetchJson<T>(
  doFetch: typeof fetch,
  url: string,
  token: string | undefined,
): Promise<T | null> {
  const res = await doFetch(url, { headers: authHeaders(token) });
  if (res.status === 404) return null;
  if (res.status === 403 || res.status === 401) {
    throw new GitHubScannerError(
      `GitHub API ${res.status} — ${res.status === 403 ? 'rate limited or forbidden (set GITHUB_TOKEN)' : 'auth failed (check GITHUB_TOKEN)'}`,
      res.status,
    );
  }
  if (!res.ok) {
    throw new GitHubScannerError(`GitHub API error ${res.status} for ${url}`, res.status);
  }
  return (await res.json()) as T;
}

async function fetchRawFile(
  doFetch: typeof fetch,
  url: string,
  token: string | undefined,
): Promise<string | null> {
  const res = await doFetch(url, {
    headers: { ...authHeaders(token), Accept: 'application/vnd.github.raw' },
  });
  if (res.status === 404) return null;
  if (res.status === 403 || res.status === 401) {
    throw new GitHubScannerError(
      `GitHub API ${res.status} fetching ${url}`,
      res.status,
    );
  }
  if (!res.ok) {
    throw new GitHubScannerError(`GitHub API ${res.status} fetching ${url}`, res.status);
  }
  return await res.text();
}

export interface ScanGitHubArgs {
  owner: string;
  repo: string;
}

export interface ScanGitHubResult {
  profile: RepoProfile;
  /**
   * Raw README content trimmed to README_MAX_BYTES. May contain anything,
   * including hostile prompt-injection payloads — feed it into the enricher
   * as quoted data, never as instructions. Undefined when the repo has no
   * recognizable README at root.
   */
  readme?: string;
}

// Capped to bound token cost and limit prompt-injection blast radius.
// 16 KB is enough for the LLM to extract a project summary while keeping
// the enricher prompt well under the model's context.
const README_MAX_BYTES = 16 * 1024;
const README_CANDIDATES = ['README.md', 'README.rst', 'README.txt', 'README', 'readme.md'] as const;

export async function scanGitHub(
  args: ScanGitHubArgs,
  options: GitHubScannerOptions = {},
): Promise<ScanGitHubResult> {
  const { owner, repo } = args;
  const doFetch = options.fetcher ?? fetch;
  const token = options.token;
  const base = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  // Phase 1: parallel — repo meta, language stats, root listing, workflows check
  const [meta, languages, rootContents, workflows] = await Promise.all([
    fetchJson<RepoMeta>(doFetch, base, token),
    fetchJson<Record<string, number>>(doFetch, `${base}/languages`, token),
    fetchJson<RepoContentsItem[]>(doFetch, `${base}/contents`, token),
    fetchJson<RepoContentsItem[] | null>(doFetch, `${base}/contents/.github/workflows`, token),
  ]);

  if (!meta) {
    throw new GitHubScannerError(
      `Repository not found: ${owner}/${repo}. Public repos only; private repos need OAuth (not yet supported).`,
      404,
    );
  }

  const rootFiles = new Set<string>();
  const dotnetProjectFiles: string[] = [];
  // GitHub repos host README under several conventions; pick the first one
  // that exists, matching case-insensitively.
  let readmeFilename: string | undefined;
  if (Array.isArray(rootContents)) {
    for (const item of rootContents) {
      if (item.type !== 'file') continue;
      rootFiles.add(item.name);
      if (/\.(cs|fs|vb)proj$/i.test(item.name)) {
        dotnetProjectFiles.push(item.name);
      }
      if (!readmeFilename) {
        const lower = item.name.toLowerCase();
        if (README_CANDIDATES.some((cand) => cand.toLowerCase() === lower)) {
          readmeFilename = item.name;
        }
      }
    }
  }

  const lockfilesPresent = new Set(JS_LOCKFILES.filter((name) => rootFiles.has(name)));

  // Phase 2: parallel — fetch contents of config files that exist
  const toFetch = PARSER_FILES.filter((name) => rootFiles.has(name));
  const fetched = await Promise.all(
    toFetch.map(async (name) => {
      const text = await fetchRawFile(doFetch, `${base}/contents/${name}`, token);
      return [name, text] as const;
    }),
  );

  const dotnetFetched = await Promise.all(
    dotnetProjectFiles.map(async (name) => {
      const text = await fetchRawFile(doFetch, `${base}/contents/${name}`, token);
      return text;
    }),
  );

  // Fetch the README in parallel with the config-file pass above. We bound
  // it by byte count rather than line count — token cost and injection
  // surface both scale with bytes, not lines.
  let readme: string | undefined;
  if (readmeFilename) {
    try {
      const raw = await fetchRawFile(doFetch, `${base}/contents/${readmeFilename}`, token);
      if (raw && raw.trim().length > 0) {
        readme = raw.length > README_MAX_BYTES ? raw.slice(0, README_MAX_BYTES) : raw;
      }
    } catch {
      // A README fetch failure is not fatal — proceed without it.
    }
  }

  // Detect
  const detections: Detections = {
    frameworks: new Set(),
    testRunners: new Set(),
  };
  for (const [name, text] of fetched) {
    if (text === null) continue;
    if (isParserKey(name)) {
      PARSERS[name](text, detections);
    }
  }
  for (const text of dotnetFetched) {
    if (text === null) continue;
    parseDotNetProject(text, detections);
  }

  // Package manager inference (favor explicit package.json packageManager field
  // set by parsePackageJson, fall back to lockfile presence, then config files).
  let packageManager: PackageManager | undefined = detections.packageManager;
  if (!packageManager) {
    if (rootFiles.has('package.json')) {
      packageManager = inferJsPackageManager(lockfilesPresent) ?? 'npm';
    } else if (rootFiles.has('pyproject.toml')) {
      packageManager = detections.packageManager ?? 'pip';
    } else if (rootFiles.has('requirements.txt') || rootFiles.has('Pipfile')) {
      packageManager = 'pip';
    } else if (rootFiles.has('go.mod')) {
      packageManager = 'go';
    } else if (rootFiles.has('Cargo.toml')) {
      packageManager = 'cargo';
    } else if (dotnetProjectFiles.length > 0) {
      packageManager = 'nuget';
    } else if (rootFiles.has('Gemfile') || rootFiles.has('composer.json')) {
      packageManager = 'other';
    }
  }

  // Languages: byte counts → ordered list
  const languageList = languages
    ? Object.entries(languages)
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name)
    : [];

  const hasCI = Array.isArray(workflows) && workflows.length > 0;

  const profile: RepoProfile = {
    name: meta.name ?? repo,
    description: meta.description ?? undefined,
    languages: languageList,
    frameworks: [...detections.frameworks].sort(),
    testRunners: [...detections.testRunners].sort(),
    hasCI,
  };
  if (packageManager) profile.packageManager = packageManager;
  const spdx = meta.license?.spdx_id;
  if (spdx && spdx !== 'NOASSERTION') profile.license = spdx;

  const result: ScanGitHubResult = { profile };
  if (readme) result.readme = readme;
  return result;
}
