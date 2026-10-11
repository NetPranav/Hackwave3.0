import { createHmac } from 'node:crypto';

export type Fmt = 'email' | 'uuid' | 'prefixed_id' | 'iso_date' | 'epoch_s' | 'epoch_ms' | 'url' | 'phone' | 'currency_code' | 'enum_candidate' | 'text' | 'hex_id';

const RE = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  prefixed: /^[a-z]{1,8}_[A-Za-z0-9]{2,}$/,
  iso: /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/,
  url: /^https?:\/\/\S+$/,
  phone: /^\+?[\d\s().-]{8,16}$/,
  currency: /^[A-Z]{3}$/,
  hex: /^[0-9a-f]{16,}$/i,
  enum: /^[A-Za-z][A-Za-z0-9_-]{0,23}$/,
};

/** Format class of a string value, computed locally; the value itself never leaves. */
export function formatOf(s: string): Fmt {
  if (RE.email.test(s)) return 'email';
  if (RE.uuid.test(s)) return 'uuid';
  if (RE.url.test(s)) return 'url';
  if (RE.iso.test(s)) return 'iso_date';
  if (RE.prefixed.test(s) && /\d/.test(s)) return 'prefixed_id';
  if (RE.hex.test(s)) return 'hex_id';
  if (RE.currency.test(s)) return 'currency_code';
  if (RE.phone.test(s) && /\d{6}/.test(s.replace(/\D/g, ''))) return 'phone';
  if (RE.enum.test(s)) return 'enum_candidate';
  return 'text';
}

export function numberFormat(n: number): Fmt | undefined {
  const a = Math.abs(n);
  if (Number.isInteger(n) && a >= 1e9 && a < 4e9) return 'epoch_s';
  if (Number.isInteger(n) && a >= 1e12 && a < 4e12) return 'epoch_ms';
  return undefined;
}

export const magnitude = (n: number) => (n === 0 ? 0 : Math.floor(Math.log10(Math.abs(n))));

/** Salted hash; the salt stays on the customer's server and is never sent anywhere. */
export const hasher = (salt: string) => (v: string) => createHmac('sha256', salt).update(v).digest('hex').slice(0, 16);

/** Interpolated percentile over a sorted copy. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const a = [...values].sort((x, y) => x - y);
  const idx = (a.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return a[lo]! + (a[hi]! - a[lo]!) * (idx - lo);
}

const ID_SEGMENT = /^(\d+|[0-9a-f]{8}-[0-9a-f-]{27}|[a-z]{1,8}_[A-Za-z0-9]+|[0-9a-f]{16,})$/i;
const PAGING = new Set(['page', 'limit', 'per_page', 'perpage', '$top', '$skip', 'cursor', 'offset', 'size', 'page_size']);
const LIMITS = new Set(['limit', 'per_page', 'perpage', '$top', 'size', 'page_size']);

/** `/v1/users/8812/orders?page=2` -> `{ endpoint: '/v1/users/{id}/orders', queryKeys: ['page'], limit }`. */
export function normalise(url: URL) {
  const path = url.pathname.split('/').map((seg) => (seg && ID_SEGMENT.test(seg) ? '{id}' : seg)).join('/') || '/';
  const queryKeys = [...new Set([...url.searchParams.keys()])].sort();
  let limit: number | undefined;
  for (const k of queryKeys) {
    if (LIMITS.has(k.toLowerCase())) {
      const n = Number(url.searchParams.get(k));
      if (Number.isInteger(n) && n >= 0) limit = n;
    }
  }
  void PAGING;
  return { endpoint: path, queryKeys, limit };
}
