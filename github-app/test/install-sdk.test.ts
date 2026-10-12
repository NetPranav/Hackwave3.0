import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planSdkInstall, sdkSource } from '../src/install-sdk.js';

const repo = (files: Record<string, string>) => {
  const d = mkdtempSync(join(tmpdir(), 'seismo-install-'));
  for (const [p, c] of Object.entries(files)) { mkdirSync(join(d, p, '..'), { recursive: true }); writeFileSync(join(d, p), c); }
  return d;
};

describe('setup PR installs and starts the SDK (v3-P1.2)', () => {
  it('Next.js + npm: dependency (vendored tarball), updated lockfile, instrumentation, config from env URLs, .env.example', () => {
    const sdk = sdkSource({});
    expect(sdk.tarball!.fileName).toMatch(/^seismo-sdk-\d+\.\d+\.\d+\.tgz$/);
    const dir = repo({
      'package.json': JSON.stringify({ name: 'shop', version: '1.0.0', dependencies: { next: '16.4.0' } }, null, 2),
      'package-lock.json': JSON.stringify({ name: 'shop', version: '1.0.0', lockfileVersion: 3, requires: true, packages: { '': { name: 'shop', version: '1.0.0', dependencies: { next: '16.4.0' } } } }, null, 2),
      'tsconfig.json': '{}',
      'src/app/page.tsx': 'export default function P() { return null }',
      'src/lib/pay.ts': 'export const f = () => fetch(`${process.env.RAZORPAY_API_URL}/payments`);',
    });
    const plan = planSdkInstall(dir, sdk);
    const byPath = Object.fromEntries(plan.files.map((f) => [f.path, f]));
    expect(JSON.parse(byPath['package.json']!.content).dependencies['@seismo/sdk']).toBe(`file:vendor/${sdk.tarball!.fileName}`);
    expect(byPath[`vendor/${sdk.tarball!.fileName}`]!.encoding).toBe('base64');
    expect(byPath['src/instrumentation.ts']!.content).toContain("await import('@seismo/sdk/auto')");
    expect(JSON.parse(byPath['seismo.config.json']!.content).services).toEqual({ RAZORPAY_API_URL: 'razorpay' });
    expect(byPath['.env.example']!.content).toContain('SEISMO_KEY=');
    // lockfile either updated (needs the npm registry for next) or the human is told to run npm install
    expect(Boolean(byPath['package-lock.json']) || plan.notes.some((n) => n.includes('npm install'))).toBe(true);
  }, 180_000);
  it('plain Node (ESM entry from the start script): one import line at the top, shebang kept', () => {
    const dir = repo({
      'package.json': JSON.stringify({ name: 'api', type: 'module', scripts: { start: 'node --enable-source-maps server.js' } }),
      'server.js': '#!/usr/bin/env node\nimport http from "node:http";\nhttp.createServer().listen(3000);\n',
    });
    const plan = planSdkInstall(dir, { spec: '^0.1.5' });
    const server = plan.files.find((f) => f.path === 'server.js')!.content;
    expect(server.startsWith("#!/usr/bin/env node\nimport '@seismo/sdk/auto';")).toBe(true);
    expect(JSON.parse(plan.files.find((f) => f.path === 'package.json')!.content).dependencies['@seismo/sdk']).toBe('^0.1.5');
    expect(plan.files.some((f) => f.path.startsWith('vendor/'))).toBe(false);   // published version: nothing vendored
  });
  it('already set up (SDK dependency, instrumentation, config, env): nothing to add', () => {
    const dir = repo({
      'package.json': JSON.stringify({ dependencies: { next: '16.4.0', '@seismo/sdk': 'file:vendor/x.tgz' } }),
      'instrumentation.ts': "export async function register() { await import('@seismo/sdk/auto'); }",
      'seismo.config.json': '{}', '.env.example': 'SEISMO_KEY=\n',
    });
    expect(planSdkInstall(dir, { spec: '^0.1.5' }).files).toEqual([]);
  });
  it('an existing instrumentation without Seismo is not overwritten: a note tells the human what to add', () => {
    const dir = repo({ 'package.json': JSON.stringify({ dependencies: { next: '16.4.0' } }), 'instrumentation.ts': 'export async function register() { /* theirs */ }' });
    const plan = planSdkInstall(dir, { spec: '^0.1.5' });
    expect(plan.files.some((f) => f.path === 'instrumentation.ts')).toBe(false);
    expect(plan.notes.join(' ')).toContain('already exists');
  });
});
