import { describe, expect, it } from 'vitest';
import type { DriftEvent } from '@seismo/contracts';
import { stressTest, templateFor } from '../src/fix-templates.js';

const ev = (o: Partial<DriftEvent>): DriftEvent => ({ id: 'drift-abc123', service: 'payments', endpoint: 'POST /payments', field: 'amount', detector: 'D4', title: 't', severity: 'breaking', state: 'breaking', confidence: 0.9, detectedAt: '2026-10-11T00:00:00.000Z', before: null, after: null, usages: [], ...o });

describe('fix templates (v2): fixed data rules per change type, never AI code', () => {
  it('type change integer -> string: coerce back to number; stress test passes', () => {
    const t = templateFor(ev({ detector: 'D4', before: { type: 'integer' }, after: { type: 'string' } }));
    expect(t.rule).toMatchObject({ kind: 'coerce', field: 'amount', to: 'number', endpoint: 'POST /payments', path: '$' });
    const s = stressTest(t.rule!);
    expect(s).toMatchObject({ passed: true, runs: 2000 });
  });
  it('unit change x100: scale rule, stress test passes with other rules already in the repo', () => {
    const t = templateFor(ev({ detector: 'D5', title: 'Unit change: amount ×100 (paise?)', endpoint: 'GET /payments/{id}' }));
    expect(t.rule).toMatchObject({ kind: 'scale', divideBy: 100 });
    const existing = [{ kind: 'alias' as const, endpoint: 'GET /users/{id}', path: '$', target: 'name', source: 'display_name' }];
    expect(stressTest(t.rule!, existing).passed).toBe(true);
  });
  it('new enum value: a map rule ONLY for a spelling variant of a known value, with a confident judge choice', () => {
    const base = { detector: 'D7', field: 'data[].status', endpoint: 'GET /shipments/{id}', before: { values: ['in_transit', 'delivered'] }, after: { added: [{ value: 'partially_shipped', share: 0.3 }] } };
    expect(templateFor(ev(base)).rule).toBeUndefined();                                                          // no judge: a person decides
    const judged = templateFor(ev({ ...base, explanation: { title: 't', summary: 'ssssssssss', impact: 'i i', recommendation: 'r r', risk: 'low', channels: { whatsapp: 'wwwwwwwwww', slack: 'ssssssssss', emailSubject: 'e e', emailBody: 'eeeeeeeeee' }, confidence: 1, model: 'm', latencyMs: 1, source: 'ai', judgement: { choice: 'in_transit', confidence: 0.8, reason: 'still moving' } } }));
    // a new MEANING is never folded into an old value, however sure the judge is (found live: "lost" -> "in_transit")
    expect(judged.rule).toBeUndefined();
    expect(judged.why).toContain('its own meaning');
    // only a spelling/format variant of a known value is mapped
    const variant = templateFor(ev({ ...base, after: { added: [{ value: 'In-Transit', share: 0.3 }] }, explanation: { title: 't', summary: 'ssssssssss', impact: 'i i', recommendation: 'r r', risk: 'low', channels: { whatsapp: 'wwwwwwwwww', slack: 'ssssssssss', emailSubject: 'e e', emailBody: 'eeeeeeeeee' }, confidence: 1, model: 'm', latencyMs: 1, source: 'ai', judgement: { choice: 'in_transit', confidence: 0.8, reason: 'same value' } } }));
    expect(variant.rule).toMatchObject({ kind: 'map', field: 'status', path: '$.data[*]', map: { 'In-Transit': 'in_transit' } });
    expect(stressTest(variant.rule!).passed).toBe(true);
    const invented = templateFor(ev({ ...base, explanation: { ...(judged as never), title: 't', summary: 'ssssssssss', impact: 'i i', recommendation: 'r r', risk: 'low', channels: { whatsapp: 'wwwwwwwwww', slack: 'ssssssssss', emailSubject: 'e e', emailBody: 'eeeeeeeeee' }, confidence: 1, model: 'm', latencyMs: 1, source: 'ai', judgement: { choice: 'teleported', confidence: 0.99, reason: 'x' } } }));
    expect(invented.rule).toBeUndefined();                                                                        // the judge may not invent values
  });
  it('limit cap, error shape, removal: no data rule, says why', () => {
    for (const d of ['D9', 'D11', 'D1', 'D10']) {
      const t = templateFor(ev({ detector: d }));
      expect(t.rule).toBeUndefined();
      expect(t.why).toMatch(/code change|code has to change/);
    }
  });
  it('the stress test catches a broken rule (here: a map that would collide with the alias pipeline is still fine, but a bad scale is not)', () => {
    const bad = { id: 'x', kind: 'scale' as const, endpoint: 'GET /a', path: '$', field: 'amount', divideBy: 0 };
    const s = stressTest(bad as never);
    expect(s.passed).toBe(false);                     // runtime ignores divideBy 0, so values do not change as the rule claims
    expect(s.failures.length).toBeGreaterThan(0);
  });
});
