import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { create } from 'tar';
import { scanRepo } from '../src/scan-repo.js';

describe('scanRepo', () => {
  it('downloads a tarball (GitHub layout: one top folder), scans it, cleans up', async () => {
    const shop = fileURLToPath(new URL('./fixtures', import.meta.url));
    const chunks: Buffer[] = [];
    // GitHub tarballs wrap everything in "<owner>-<repo>-<sha>/"; fixtures/shop plays that folder.
    for await (const c of create({ gzip: true, cwd: shop }, ['shop'])) chunks.push(c as Buffer);
    const tgz = Buffer.concat(chunks);
    const octokit = { request: async () => ({ data: tgz.buffer.slice(tgz.byteOffset, tgz.byteOffset + tgz.byteLength) }) };
    const map = await scanRepo(octokit, 'demo', 'shop', 'main', 'abc123');
    expect(map.repo).toBe('demo/shop');
    expect(map.commit).toBe('abc123');
    expect(map.callSites.length).toBeGreaterThanOrEqual(5);
  });
});
