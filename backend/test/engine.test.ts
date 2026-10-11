import { describe, expect, it } from 'vitest';
import type { CodeMap } from '@seismo/contracts';
import { buildServices } from '../../services/src/app.js';
import { DriftEngine } from '../src/drift-engine.js';
import { memoryIngest } from '../src/ingest-store.js';
import { capture, toggle } from './helpers.js';

const NOW = Date.parse('2026-10-14T10:20:00Z');
const codeMap = (reads: { field: string; usage: 'display' | 'arithmetic'; money?: boolean }[]): CodeMap => ({
  repo: 'demo/shop', commit: 'c', scannedAt: '2026-10-14T10:00:00.000Z',
  callSites: [{ id: 'cs1', repo: 'demo/shop', file: 'lib/api.ts', line: 6, service: 'users', method: 'GET', endpoint: '/users/{param}' }],
  fieldReads: reads.map((r, i) => ({ callSiteId: 'cs1', field: r.field, file: 'app/checkout/page.tsx', line: 20 + i, usage: r.usage, money: r.money ?? false })),
  workflows: [],
});

async function scenario(maps: CodeMap[], flipTo: (s: ReturnType<typeof buildServices>) => Promise<void>) {
  const s = buildServices();
  const ingest = memoryIngest();
  for (let i = 0; i < 6; i++) for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: NOW - 15 * 60_000 + i * 5000 })) await ingest.add('dev', fp);
  await flipTo(s);
  for (let i = 0; i < 3; i++) for (const fp of await capture(s, '/users/u_1', 20, { service: 'users', at: NOW - 30_000 + i * 5000 })) await ingest.add('dev', fp);
  return new DriftEngine(ingest, async () => maps);
}

describe('drift engine (P4.2/P4.5)', () => {
  it('rename that code reads: suspected on run 1, breaking on run 2, with usages and an alias fix', async () => {
    const e = await scenario([codeMap([{ field: 'name', usage: 'display' }, { field: 'email', usage: 'display' }])], async (s) => void (await toggle(s, 'users-rename')));
    await e.run(NOW);
    const first = e.list().find((x) => x.detector === 'D3')!;
    expect(first.state).toBe('suspected');
    await e.run(NOW + 5000);
    const ev = e.list().find((x) => x.detector === 'D3')!;
    expect(ev.id).toBe(first.id);
    expect(ev.state).toBe('breaking');                        // a renamed field the code reads is broken whatever the usage
    expect(ev.usages[0]!.file).toBe('app/checkout/page.tsx');
    expect(ev.fix).toEqual({ rung: 'alias', rule: { kind: 'alias', path: '$', endpoint: 'GET /users/{id}', source: 'display_name', target: 'name' } });
  });
  it('a field read in a branch/arithmetic is breaking once confirmed', async () => {
    const e = await scenario([codeMap([{ field: 'name', usage: 'arithmetic' }])], async (s) => void (await toggle(s, 'users-rename')));
    await e.run(NOW); await e.run(NOW + 5000);
    expect(e.list().find((x) => x.detector === 'D3')!.state).toBe('breaking');
  });
  it('removing a field nobody reads stays info (no alert)', async () => {
    const e = await scenario([codeMap([{ field: 'email', usage: 'display' }])], async (s) => void (await toggle(s, 'users-rename')));
    await e.run(NOW); await e.run(NOW + 5000);
    const d3 = e.list().find((x) => x.detector === 'D3')!;
    // code reads `email`, not `name`: the rename is real but harmless to us
    expect(d3.severity).toBe('info');
    expect(d3.state).toBe('normal');
  });
  it('no drift, no events', async () => {
    const e = await scenario([codeMap([{ field: 'name', usage: 'display' }])], async () => undefined);
    await e.run(NOW); await e.run(NOW + 5000);
    expect(e.list()).toEqual([]);
  });
});
