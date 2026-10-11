import { z } from 'zod';

/**
 * Minimal OpenAI-compatible client for NVIDIA NIM (spike S1: `response_format: json_schema` works on the hosted API,
 * `nvext.guided_json` is rejected). JSON only, zod-validated, 2 retries that include the validation error, 20 s timeout,
 * client-side rate limit below the provider limit. Throws on final failure: callers fall back to templates.
 */
export interface NimOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  perMinute?: number;                 // our own cap (S1: ~40/min reported, we use 30)
  fetchImpl?: typeof fetch;
}

export class RateLimiter {
  private stamps: number[] = [];
  constructor(private perMinute: number, private now = () => Date.now()) {}
  /** Resolves when a slot is free. */
  async take(): Promise<void> {
    for (;;) {
      const t = this.now();
      this.stamps = this.stamps.filter((s) => t - s < 60_000);
      if (this.stamps.length < this.perMinute) { this.stamps.push(t); return; }
      await new Promise((r) => setTimeout(r, Math.min(250, Math.max(20, 60_000 - (t - this.stamps[0]!)))));   // re-check often
    }
  }
}

export class NimClient {
  readonly enabled: boolean;
  private limiter: RateLimiter;
  private f: typeof fetch;
  constructor(private o: NimOptions = {}) {
    this.o = { apiKey: process.env.NIM_API_KEY, baseUrl: process.env.NIM_BASE_URL ?? 'https://integrate.api.nvidia.com/v1', timeoutMs: 45_000, perMinute: 30, ...o };
    this.enabled = !!this.o.apiKey;
    this.limiter = new RateLimiter(this.o.perMinute!);
    this.f = o.fetchImpl ?? ((...a) => fetch(...a));
  }

  /** `check` runs after zod: return a problem description to reject (it is sent back to the model as the retry reason). */
  async json<T>(model: string, system: string, user: string, schema: z.ZodType<T>, name: string, check?: (v: T) => string | undefined): Promise<{ value: T; latencyMs: number }> {
    if (!this.enabled) throw new Error('NIM disabled (no NIM_API_KEY)');
    const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12' });
    const messages: { role: string; content: string }[] = [{ role: 'system', content: system }, { role: 'user', content: user }];
    let lastError = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.limiter.take();
      const t0 = Date.now();
      const res = await this.f(`${this.o.baseUrl}/chat/completions`, {
        method: 'POST', signal: AbortSignal.timeout(this.o.timeoutMs!),
        headers: { authorization: `Bearer ${this.o.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 1200, response_format: { type: 'json_schema', json_schema: { name, schema: jsonSchema } } }),
      });
      if (!res.ok) { lastError = `HTTP ${res.status}`; if (process.env.AI_DEBUG) console.error(`[nim] attempt ${attempt + 1}: ${lastError}`); if (res.status === 429 || res.status >= 500) continue; throw new Error(`NIM ${lastError}: ${(await res.text()).slice(0, 200)}`); }
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = body.choices?.[0]?.message?.content ?? '';
      let parsed: unknown;
      try { parsed = JSON.parse(stripFence(text)); } catch { lastError = 'not JSON'; messages.push({ role: 'assistant', content: text.slice(0, 2000) }, { role: 'user', content: 'That was not valid JSON. Reply with JSON only, matching the schema.' }); continue; }
      const v = schema.safeParse(parsed);
      const problem = v.success ? check?.(v.data) : undefined;
      if (v.success && !problem) return { value: v.data, latencyMs: Date.now() - t0 };
      lastError = (v.success ? problem! : v.error.message).slice(0, 500);
      if (process.env.AI_DEBUG) console.error(`[nim] attempt ${attempt + 1} rejected: ${lastError.slice(0, 300)} | output: ${text.slice(0, 300)}`);
      messages.push({ role: 'assistant', content: text.slice(0, 2000) }, { role: 'user', content: `The JSON did not match the schema: ${lastError}. Fix it and reply with JSON only.` });
    }
    throw new Error(`NIM gave no valid JSON after 3 attempts: ${lastError}`);
  }
}

const stripFence = (t: string) => t.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
