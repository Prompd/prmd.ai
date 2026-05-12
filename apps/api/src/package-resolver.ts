import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// apps/api/src/package-resolver.ts -> apps/api
export const API_ROOT = resolve(HERE, '..');

export const AGENT_PACK_NAME = '@prmd-ai/agent-pack';

interface ProjectManifest {
  dependencies?: Record<string, string>;
}

let cachedPath: string | null = null;
let cachedVersion: string | null = null;

async function readPackageVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion;
  const manifestPath = join(API_ROOT, 'prompd.json');
  const raw = await readFile(manifestPath, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${manifestPath}: invalid JSON shape`);
  }
  const manifest = parsed as ProjectManifest;
  const version = manifest.dependencies?.[AGENT_PACK_NAME];
  if (!version || typeof version !== 'string') {
    throw new Error(`${manifestPath}: missing dependency '${AGENT_PACK_NAME}'`);
  }
  cachedVersion = version;
  return version;
}

export async function getAgentPackPath(): Promise<string> {
  if (cachedPath) return cachedPath;
  const version = await readPackageVersion();
  cachedPath = join(API_ROOT, '.prompd', 'packages', AGENT_PACK_NAME, version);
  return cachedPath;
}
