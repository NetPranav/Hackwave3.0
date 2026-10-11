// S1: NVIDIA NIM structured output + latency. Usage: node --env-file=.env scripts/spikes/s1-nim.mjs
const models = ['nvidia/nemotron-3-ultra-550b-a55b', 'nvidia/nemotron-3-super-120b-a12b', 'nvidia/nemotron-nano-3-30b-a3b'];
const schema = { type: 'object', properties: { summary: { type: 'string' }, severity: { enum: ['info', 'warning', 'breaking'] }, confidence: { type: 'number' } }, required: ['summary', 'severity', 'confidence'] };
const prompt = 'Field "email" was renamed to "emailAddress" in GET /users/{id}. Return JSON {summary, severity, confidence}.';
for (const model of models) {
  for (const mode of ['response_format', 'guided_json']) {
    const body = { model, messages: [{ role: 'user', content: prompt }], max_tokens: 400, temperature: 0 };
    if (mode === 'response_format') body.response_format = { type: 'json_schema', json_schema: { name: 'x', schema } };
    else body.nvext = { guided_json: schema };
    const t = Date.now();
    try {
      const r = await fetch(`${process.env.NIM_BASE_URL}/chat/completions`, { method: 'POST', headers: { authorization: `Bearer ${process.env.NIM_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) });
      const j = await r.json();
      const text = j.choices?.[0]?.message?.content ?? JSON.stringify(j).slice(0, 150);
      let ok = false; try { const o = JSON.parse(text); ok = typeof o.summary === 'string' && ['info','warning','breaking'].includes(o.severity); } catch {}
      console.log(model, mode, r.status, `${Date.now() - t}ms`, ok ? 'VALID' : 'invalid', ok ? '' : text.slice(0, 120));
    } catch (e) { console.log(model, mode, 'ERR', String(e).slice(0, 100)); }
  }
}
