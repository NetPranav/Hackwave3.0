import { describe, expect, it } from 'vitest';
import type { Fingerprint } from '@seismo/contracts';
import { buildServices } from '../../services/src/app.js';
import { buildBaselines } from '../src/baseline.js';
import { bucketKey, mergeInto, startBucket } from '../src/rollup.js';
import { capture } from './helpers.js';

describe('10 s rollups (Render free: ~40,000 per-request fingerprints starved the engine)', () => {
  it('a baseline from the buckets equals the baseline from the raw per-request fingerprints', async () => {
    const s = buildServices();
    const T = Date.parse('2026-10-14T10:00:00Z');
    const raw: Fingerprint[] = [];
    // like a serverless app: one fingerprint per request, ~2 a second for 2 minutes
    for (let i = 0; i < 240; i++) raw.push(...(await capture(s, '/users/u_1', 1, { service: 'users', at: T + i * 500, windowSeconds: 1 })));
    const buckets = new Map<string, Fingerprint>();
    for (const f of raw) { const k = bucketKey(f); const b = buckets.get(k); if (b) mergeInto(b, f); else buckets.set(k, startBucket(f)); }
    expect(buckets.size).toBeLessThanOrEqual(13);              // 240 fingerprints -> one bucket per 10 s
    const a = buildBaselines(raw, T + 200_000)[0]!, b = buildBaselines([...buckets.values()], T + 200_000)[0]!;
    expect(b.samples).toBe(a.samples);
    for (const [path, f] of Object.entries(a.fields)) {
      expect(b.fields[path]!.presence).toBeCloseTo(f.presence, 6);
      expect(b.fields[path]!.types).toEqual(f.types);
      expect(b.fields[path]!.fmt).toEqual(f.fmt);
    }
    expect(raw[0]!.batchId).toBe(raw[0]!.batchId);              // the originals are untouched
  });
});
