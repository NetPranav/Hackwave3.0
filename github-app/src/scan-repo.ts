import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { extract } from 'tar';
import type { CodeMap } from '@seismo/contracts';
import { scanDirectory } from './scanner.js';

interface OctokitLike {
  request: (route: string, params: Record<string, unknown>) => Promise<{ data: unknown }>;
}

/** Download the repo tarball at `ref` into a temp dir, run `fn` on it, always delete it. */
export async function withCheckout<T>(octokit: OctokitLike, owner: string, repo: string, ref: string, fn: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'seismo-scan-'));
  try {
    const res = await octokit.request('GET /repos/{owner}/{repo}/tarball/{ref}', { owner, repo, ref });
    const stream = Readable.from(Buffer.from(res.data as ArrayBuffer));
    await pipeline(stream, extract({ cwd: dir, strip: 1 }));
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Download the repo tarball at `ref`, scan it, delete it. Returns the code map. */
export function scanRepo(octokit: OctokitLike, owner: string, repo: string, ref: string, commit: string): Promise<CodeMap> {
  return withCheckout(octokit, owner, repo, ref, (dir) => scanDirectory(dir, { repo: `${owner}/${repo}`, commit }));
}

/** Post a finished scan to the backend. */
export async function publishCodeMap(map: CodeMap, backendUrl = process.env.BACKEND_URL ?? 'http://localhost:4000') {
  const r = await fetch(`${backendUrl}/internal/codemap`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-token': process.env.INTERNAL_TOKEN ?? 'dev-internal' },
    body: JSON.stringify(map),
  });
  if (!r.ok) throw new Error(`backend rejected code map: ${r.status} ${await r.text()}`);
}
