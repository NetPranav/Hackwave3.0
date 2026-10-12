import { describe, expect, it } from 'vitest';
import { shopLocator } from '../src/demo-shop.js';

/** A fake internet: GitHub's public API + the candidate sites. */
function net(sites: Record<string, { status: number; location?: string } | 'down'>, gh: { homepage?: string; deployUrl?: string }) {
  return (async (input: string | URL) => {
    const url = String(input);
    if (url === 'https://api.github.com/repos/o/shop') return new Response(JSON.stringify({ homepage: gh.homepage ?? null }), { status: 200 });
    if (url.startsWith('https://api.github.com/repos/o/shop/deployments?')) return new Response(JSON.stringify(gh.deployUrl ? [{ id: 7 }] : []), { status: 200 });
    if (url.startsWith('https://api.github.com/repos/o/shop/deployments/7/statuses')) return new Response(JSON.stringify([{ state: 'success', environment_url: gh.deployUrl }]), { status: 200 });
    const s = sites[url.replace(/\/$/, '')];
    if (!s || s === 'down') throw new TypeError('fetch failed');
    return new Response('ok', { status: s.status, headers: s.location ? { location: s.location } : {} });
  }) as typeof fetch;
}

describe('where is the demo shop (hosted if it answers, else local)', () => {
  it('skips a per-deployment URL behind a login and uses the public homepage', async () => {
    const f = net({ 'https://shop.example.app': { status: 200 }, 'https://shop-abc.example.app': { status: 302, location: 'https://vercel.com/sso-api?url=x' } }, { homepage: 'https://shop.example.app', deployUrl: 'https://shop-abc.example.app' });
    const loc = await shopLocator({ repo: async () => 'o/shop', fetchImpl: f, localUrl: 'http://localhost:3100' }).locate();
    expect(loc).toMatchObject({ url: 'https://shop.example.app', live: true, source: 'repo-homepage' });
  });
  it('the URL registered by demo:online wins; when it stops answering, the next candidate, then local', async () => {
    const sites: Record<string, { status: number } | 'down'> = { 'https://fresh.example.app': { status: 200 }, 'http://localhost:3100': { status: 200 } };
    const locator = shopLocator({ repo: async () => 'o/shop', fetchImpl: net(sites, { deployUrl: 'https://old.example.app' }), localUrl: 'http://localhost:3100', ttlMs: 0 });
    locator.register('https://fresh.example.app/');
    expect(await locator.locate()).toMatchObject({ url: 'https://fresh.example.app', source: 'registered', live: true });
    sites['https://fresh.example.app'] = 'down';
    const fallback = await locator.locate();
    expect(fallback).toMatchObject({ url: 'http://localhost:3100', source: 'local', live: false });
    expect(fallback.tried.map((t) => [t.source, t.ok])).toEqual([['registered', false], ['github-deployment', false], ['local', true]]);
  });
});
