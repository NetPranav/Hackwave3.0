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
