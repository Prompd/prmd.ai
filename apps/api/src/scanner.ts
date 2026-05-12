import type { GenerateSource, RepoProfile } from '@prmd/shared';
import { parseRepoUrl } from './scanners/url.js';
import { GitHubScannerError, scanGitHub, type GitHubScannerOptions } from './scanners/github.js';

/**
 * Scanner output. `profile` is the deterministic shape sent to clients;
 * `readme` is the optional raw README captured from URL flows so the LLM
 * enricher can ground its output in actual project text. Treat `readme` as
 * untrusted input — it is NEVER echoed back to clients and NEVER fed to the
 * LLM as instructions, only as quoted data.
 */
export interface ScanResult {
  profile: RepoProfile;
  readme?: string;
}

export interface RepoScanner {
  scan(source: GenerateSource): Promise<ScanResult>;
}

export class ScannerError extends Error {
  public readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ScannerError';
    this.status = status;
  }
}

export interface ScannerOptions {
  githubToken?: string;
  fetcher?: typeof fetch;
}

export function createScanner(options: ScannerOptions = {}): RepoScanner {
  const githubOpts: GitHubScannerOptions = {};
  if (options.githubToken) githubOpts.token = options.githubToken;
  if (options.fetcher) githubOpts.fetcher = options.fetcher;

  return {
    async scan(source) {
      if (source.kind === 'manual') {
        return { profile: source.profile };
      }
      if (source.kind === 'bitbucket') {
        throw new ScannerError(
          'Bitbucket scanning is coming soon. For now, use the Manual details tab.',
          501,
        );
      }
      // github
      const parsed = parseRepoUrl(source.url);
      if (!parsed || parsed.host !== 'github') {
        throw new ScannerError(`Invalid GitHub repository URL: ${source.url}`);
      }
      try {
        return await scanGitHub({ owner: parsed.owner, repo: parsed.repo }, githubOpts);
      } catch (err) {
        if (err instanceof GitHubScannerError) {
          throw new ScannerError(err.message, err.status ?? 502);
        }
        throw err;
      }
    },
  };
}

// Kept for tests / fallback. Not wired into the live API.
export function createPlaceholderScanner(): RepoScanner {
  return {
    async scan(source) {
      if (source.kind === 'manual') return { profile: source.profile };
      const url = source.url.trim().replace(/\.git$/, '');
      const name = url.split('/').filter(Boolean).pop() ?? 'unknown-project';
      return {
        profile: {
          name,
          description: undefined,
          languages: [],
          frameworks: [],
          testRunners: [],
          hasCI: false,
        },
      };
    },
  };
}
