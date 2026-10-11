// Integration test against a real Postgres (runs when DATABASE_URL is set; CI has no database, so it is skipped there).
import { describe, expect, it } from 'vitest';
import { pgEvents } from '../src/event-store.js';
import { pgKeys, SdkKeys } from '../src/ingest-store.js';
import { pgSettings, DEFAULT_SETTINGS } from '../src/settings-store.js';
import { pgOwners } from '../src/projects.js';

describe.runIf(!!process.env.DATABASE_URL)('Postgres stores', () => {
  const project = `test-${Date.now()}`;
  it('drift events survive a new store instance', async () => {
    const a = pgEvents(project);
    const ev = { key: 'k1', runs: 2, lastSeen: 1, dispatched: true, event: { id: `drift-${project}`, service: 'users', endpoint: 'GET /users/{id}', detector: 'D3', title: 't', severity: 'breaking' as const, state: 'fix_pending' as const, confidence: 0.9, detectedAt: new Date().toISOString(), before: null, after: null, usages: [] } };
    await a.save([ev]);
    const loaded = await pgEvents(project).load();
    expect(loaded).toEqual([ev]);
    await a.remove([ev.event.id]);
    expect(await pgEvents(project).load()).toEqual([]);
  });
  it('SDK keys survive a restart; a revoked key stays revoked', async () => {
    const k1 = new SdkKeys('');
    await k1.attach(pgKeys());
    const { id, key } = k1.create(project);
    await new Promise((r) => setTimeout(r, 300));
    const k2 = new SdkKeys('');
    await k2.attach(pgKeys());
    expect(k2.verify(key)).toBe(project);
    k2.revoke(id);
    await new Promise((r) => setTimeout(r, 300));
    const k3 = new SdkKeys('');
    await k3.attach(pgKeys());
    expect(k3.verify(key)).toBeNull();
  });
  it('notification settings persist', async () => {
    const s = pgSettings(project);
    expect(await s.get()).toEqual(DEFAULT_SETTINGS);
    await s.put({ ...DEFAULT_SETTINGS, minSeverity: 'breaking' });
    expect((await pgSettings(project).get()).minSeverity).toBe('breaking');
  });
  it('project owner is claimed once and survives a restart; legacy "unknown" rows are taken over', async () => {
    const id = `${project}-own`;
    expect(await pgOwners().claim(id, 'alice')).toBe('alice');
    expect(await pgOwners().claim(id, 'mallory')).toBe('alice');
    expect(await pgOwners().get(id)).toBe('alice');
    const legacy = `${project}-legacy`;
    const k = new SdkKeys('');
    await k.attach(pgKeys());
    k.create(legacy);                                   // written without an owner -> "unknown"
    await new Promise((r) => setTimeout(r, 300));
    expect(await pgOwners().get(legacy)).toBe('unknown');
    expect(await pgOwners().claim(legacy, 'bob')).toBe('bob');
    expect(await pgOwners().get(id)).toBe('alice');      // other projects untouched
  });
});
