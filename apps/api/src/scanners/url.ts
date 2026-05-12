export interface ParsedRepoUrl {
  host: 'github' | 'bitbucket';
  owner: string;
  repo: string;
}

const VALID_SEGMENT = /^[A-Za-z0-9_.-]+$/;

function clean(segment: string): string {
  return segment.replace(/\.git$/i, '');
}

export function parseRepoUrl(raw: string): ParsedRepoUrl | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter((p) => p.length > 0);
  if (parts.length < 2) return null;

  const owner = parts[0];
  const repoRaw = parts[1];
  if (!owner || !repoRaw) return null;
  const repo = clean(repoRaw);
  if (!VALID_SEGMENT.test(owner) || !VALID_SEGMENT.test(repo)) return null;

  if (host === 'github.com' || host.endsWith('.github.com')) {
    return { host: 'github', owner, repo };
  }
  if (host === 'bitbucket.org' || host.endsWith('.bitbucket.org')) {
    return { host: 'bitbucket', owner, repo };
  }
  return null;
}
