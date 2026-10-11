// Generates contracts/generated/openapi.json + schemas/*.json from the zod schemas.
import { mkdirSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { ROUTES } from './api.js';
import * as all from './index.js';

const out = new URL('../generated/', import.meta.url);
mkdirSync(new URL('schemas/', out), { recursive: true });
const js = (s: z.ZodType) => z.toJSONSchema(s, { target: 'draft-2020-12', unrepresentable: 'any' });

const paths: Record<string, Record<string, unknown>> = {};
for (const r of ROUTES) {
  (paths[r.path] ??= {})[r.method] = {
    summary: r.summary, 'x-auth': r.auth,
    ...(r.request ? { requestBody: { content: { 'application/json': { schema: js(r.request) } } } } : {}),
    responses: { '200': { description: 'OK', content: { 'application/json': { schema: js(r.response) } } } },
  };
}
writeFileSync(new URL('openapi.json', out), JSON.stringify({ openapi: '3.1.0', info: { title: 'Seismo API', version: '0.1.0' }, paths }, null, 2));

for (const [name, v] of Object.entries(all)) {
  if (v instanceof z.ZodType) writeFileSync(new URL(`schemas/${name}.json`, out), JSON.stringify(js(v), null, 2));
}
console.log('contracts generated');
