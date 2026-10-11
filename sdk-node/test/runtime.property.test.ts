import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { applyAliases, safeName, type AliasRule } from '../src/runtime.js';

const RUNS = { numRuns: 10_000 };
const name = fc.stringMatching(/^[A-Za-z_][A-Za-z0-9_]{0,10}$/);
const rule = fc.record({ target: name, source: name, path: fc.constantFrom('$', '$.a', '$.a.b', '$.items[*]', '$.data[*].user', '$[*]') });
const json = fc.jsonValue({ maxDepth: 4 });

/** Every key/value of `a` exists unchanged in `b` (deep); b may only have extra keys. */
function contained(a: unknown, b: unknown): boolean {
  if (a === null || typeof a !== 'object') return Object.is(a, b);
  if (b === null || typeof b !== 'object') return false;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((v, i) => contained(v, b[i]));
  return Object.keys(a).every((k) => k in b && contained((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

describe('applyAliases guarantees', () => {
  it('G1 identity: rules whose source never occurs return the SAME reference', () => {
    fc.assert(fc.property(json, fc.array(rule, { maxLength: 4 }), (v, rs) => {
      const rules = rs.map((r) => ({ ...r, source: 'zzNeverPresent_' + r.source }));
      expect(applyAliases(v, rules)).toBe(v);
    }), RUNS);
  });
  it('G1 identity: old-shape responses (target already present) are untouched', () => {
    fc.assert(fc.property(fc.dictionary(name, json, { minKeys: 1, maxKeys: 6 }), name, (obj, src) => {
      const target = Object.keys(obj)[0]!;
      if (target === src) return;
      const input = { ...obj, [src]: 'new-value' };
      const out = applyAliases(input, [{ target, source: src, path: '$' }]);
      expect(out).toBe(input);
    }), RUNS);
  });
  it('G2 additive only: nothing is removed or changed, extra keys are only rule targets', () => {
    fc.assert(fc.property(json, fc.array(rule, { maxLength: 4 }), (v, rs) => {
      const out = applyAliases(v, rs);
      expect(contained(v, out)).toBe(true);
      const targets = new Set(rs.map((r) => r.target));
      const extra = (a: unknown, b: unknown): boolean => {
        if (a === null || typeof a !== 'object' || b === null || typeof b !== 'object') return true;
        if (Array.isArray(a)) return (b as unknown[]).every((x, i) => extra(a[i], x));
        return Object.keys(b).every((k) => k in (a as object) ? extra((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]) : targets.has(k));
      };
      expect(extra(v, out)).toBe(true);
    }), RUNS);
  });
  it('G2 applies the rename, copy-on-write (input untouched)', () => {
    const input = Object.freeze({ id: 1, display_name: 'Asha', nested: Object.freeze({ keep: true }) });
    const out = applyAliases(input, [{ target: 'name', source: 'display_name', path: '$' }]) as Record<string, unknown>;
    expect(out).toEqual({ id: 1, display_name: 'Asha', name: 'Asha', nested: { keep: true } });
    expect(out['nested']).toBe(input.nested);
    expect('name' in input).toBe(false);
  });
  it('arrays and nested paths', () => {
    const input = { data: [{ user: { display_name: 'A' } }, { user: { name: 'B', display_name: 'X' } }] };
    const out = applyAliases(input, [{ target: 'name', source: 'display_name', path: '$.data[*].user' }]) as typeof input & { data: { user: { name?: string } }[] };
    expect(out.data[0]!.user.name).toBe('A');
    expect(out.data[1]!.user.name).toBe('B');           // old field wins
    expect(out.data[1]).toBe(input.data[1]);              // untouched element keeps its reference
  });
  it('G3 prototype tricks are rejected', () => {
    for (const bad of ['__proto__', 'constructor', 'prototype', 'toString', 'hasOwnProperty', '1abc', 'a-b', '', 'x'.repeat(65)]) {
      expect(safeName(bad)).toBe(false);
      const input = JSON.parse('{"source": 1, "__proto__": {"x": 1}}');
      const out = applyAliases(input, [{ target: bad, source: 'source' }, { target: 'ok', source: bad }]);
      expect(out).toBe(input);
      expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    }
    applyAliases({ a: 1 }, [{ target: '__proto__', source: 'a' }]);
    expect(({} as Record<string, unknown>)['a']).toBeUndefined();
  });
  it('G4 never throws on hostile inputs', () => {
    const cyc: Record<string, unknown> = { source: 1 }; cyc['self'] = cyc;
    const getter = { get source() { throw new Error('boom'); } };
    const proxy = new Proxy({}, { ownKeys() { throw new Error('boom'); }, getOwnPropertyDescriptor() { throw new Error('boom'); } });
    const huge = Array.from({ length: 200_000 }, (_, i) => ({ display_name: i }));
    const rules: AliasRule[] = [{ target: 'name', source: 'source', path: '$' }, { target: 'name', source: 'display_name', path: '$[*]' }, { target: 'x', source: 'source', path: '$.self.self.self' }];
    for (const bad of [cyc, getter, proxy, huge, null, undefined, 5, 'str', Object.freeze([1, 2]), new Date(), new Map()]) expect(() => applyAliases(bad as never, rules)).not.toThrow();
    expect(applyAliases(getter, rules)).toBe(getter);
    expect(applyAliases(new Map(), rules)).toBeInstanceOf(Map);
  });
  it('G4 malformed rules/paths are ignored', () => {
    const input = { a: 1, b: 2 };
    for (const bad of [{ target: 'x', source: 'a', path: '$..a' }, { target: 'x', source: 'a', path: 'a' }, { target: 'x', source: 'a', path: '$.__proto__' }, null, undefined, 5] as never[])
      expect(applyAliases(input, [bad])).toBe(input);
  });
  it('endpoint filter', () => {
    const input = { display_name: 'A' };
    const r = [{ endpoint: 'GET /users/{id}', target: 'name', source: 'display_name' }];
    expect(applyAliases(input, r, 'GET /orders')).toBe(input);
    expect(applyAliases(input, r, 'GET /users/42')).not.toBe(input);
    expect(applyAliases(input, r, 'GET /users/{id}')).not.toBe(input);
  });
});

import { applyTransforms } from '../src/runtime.js';
describe('applyTransforms (P5.10 scale rules)', () => {
  const scale = fc.record({ kind: fc.constant('scale' as const), field: name, divideBy: fc.constantFrom(10, 100, 1000), path: fc.constantFrom('$', '$.a', '$.items[*]') });
  it('T1 identity: no matching field -> same reference', () => {
    fc.assert(fc.property(json, fc.array(scale, { maxLength: 3 }), (v, rs) => {
      expect(applyTransforms(v, rs.map((r) => ({ ...r, field: 'zzNever_' + r.field })))).toBe(v);
    }), RUNS);
  });
  it('T2 only the named numeric field changes, by exactly the factor', () => {
    fc.assert(fc.property(fc.dictionary(name, fc.oneof(fc.integer(), fc.string(), fc.boolean()), { minKeys: 1, maxKeys: 6 }), (obj) => {
      const field = Object.keys(obj)[0]!;
      const out = applyTransforms(obj, [{ kind: 'scale', field, divideBy: 100, path: '$' }]) as Record<string, unknown>;
      for (const [k, v] of Object.entries(obj)) {
        if (k === field && typeof v === 'number') expect(out[k]).toBe(v / 100);
        else expect(out[k]).toBe(v);
      }
      expect(Object.keys(out).sort()).toEqual(Object.keys(obj).sort());
    }), RUNS);
  });
  it('paise -> rupees on the real payload shape; input untouched', () => {
    const v2 = Object.freeze({ id: 'pay_1', amount: 49900, currency: 'INR' });
    expect(applyTransforms(v2, [{ kind: 'scale', endpoint: 'GET /payments/{id}', field: 'amount', divideBy: 100 }], 'GET /payments/pay_1')).toEqual({ id: 'pay_1', amount: 499, currency: 'INR' });
    expect(v2.amount).toBe(49900);
    expect(applyTransforms(v2, [{ kind: 'scale', endpoint: 'GET /users/{id}', field: 'amount', divideBy: 100 }], 'GET /payments/pay_1')).toBe(v2);
  });
  it('T3 never throws; bad rules are ignored; aliases ignore scale rules and vice versa', () => {
    const bad = [{ kind: 'scale', field: '__proto__', divideBy: 100 }, { kind: 'scale', field: 'a', divideBy: 0 }, { kind: 'scale', field: 'a', divideBy: -1 }, { kind: 'scale', field: 'a', divideBy: Infinity }, null, 5];
    const input = { a: 100 };
    expect(applyTransforms(input, bad)).toBe(input);
    expect(applyAliases(input, [{ kind: 'scale', field: 'a', divideBy: 100 } as never])).toBe(input);
    expect(applyTransforms(input, [{ kind: 'alias', target: 'b', source: 'a' }])).toBe(input);
    for (const h of [null, 3, 'x', new Map(), Object.freeze([1])]) expect(() => applyTransforms(h as never, [{ kind: 'scale', field: 'a', divideBy: 10 }])).not.toThrow();
  });
});
