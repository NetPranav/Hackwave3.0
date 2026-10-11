import type { AiExplanationBody, DriftEvent } from '@seismo/contracts';

/**
 * Deterministic template catalog (P6.6). Fixed text written in advance, filled with field names and statistics.
 * Used (1) as the fallback for every AI explanation and (2) as the ONLY source of "suggested change" text on review
 * cards. Nothing here is generated, and nothing here is executed: these are instructions for a human.
 */

const ev = (e: DriftEvent) => (e.after && typeof e.after === 'object' ? (e.after as Record<string, unknown>) : {});
const where = (e: DriftEvent) => (e.usages.length ? e.usages.slice(0, 3).map((u) => `${u.file}:${u.line}`).join(', ') + (e.usages.length > 3 ? ` (+${e.usages.length - 3} more)` : '') : 'no code reads it');
const svc = (e: DriftEvent) => `${e.service} ${e.endpoint}`;

/** What a human should change. Keyed by detector. */
export function suggestionFor(e: DriftEvent): string {
  const f = e.field ?? 'the response';
  switch (e.detector) {
    case 'D3': {
      const r = e.fix?.rule;
      return r ? `Merge the Seismo PR that adds one alias rule (${r.target} ← ${r.source}) to seismo/aliases.json. No code changes.` : `Add an alias rule for ${f} in seismo/aliases.json, or update the code to read the new name.`;
    }
    case 'D1': return `The provider stopped sending ${f}. Handle its absence where it is read (${where(e)}) or ask the provider whether it moved.`;
    case 'D2': return `The provider added ${f}. No action needed unless you want to use it.`;
    case 'D4': return `${f} changed type. Convert it explicitly where it is read (${where(e)}), e.g. Number(${leaf(f)}), and add a test with the new type. Seismo never converts types automatically.`;
    case 'D5': {
      const factor = factorFromTitle(e.title);
      const op = factor >= 1 ? `divide ${leaf(f)} by ${factor}` : `multiply ${leaf(f)} by ${1 / factor}`;
      return `Every ${f} is now ${factor >= 1 ? factor : `1/${1 / factor}`} times what it was (a unit change). In the payments adapter, ${op} before using it (${where(e)}), or confirm the new unit with the provider. Money fields are never fixed automatically.`;
    }
    case 'D6': return `${f} values shifted without a clean unit factor. Check the provider's changelog and the code that computes with it (${where(e)}).`;
    case 'D7': return `${f} has a value your code has never seen. Add an explicit case for it in every if/switch that reads ${leaf(f)} (${where(e)}); do not let it fall into a default branch silently.`;
    case 'D8': return `A ${f} value your code may rely on is no longer sent. Check branches that test for it (${where(e)}).`;
    case 'D9': {
      const a = ev(e);
      const max = Number(a['maxLength'] ?? 0) || 'the new maximum';
      return `The provider now returns at most ${max} items per request. Request pages until a page comes back with fewer than ${max} items (or an empty page) and merge them, at the call site (${where(e)}). Until then, totals and lists are silently incomplete.`;
    }
    case 'D10': return `Pagination changed (${e.title}). Switch the client loop to the new style (follow the cursor until it is empty) at ${where(e)}.`;
    case 'D11': return `Error responses have a new shape. Update error parsing at ${where(e)} so failures are not misread as success.`;
    case 'D12': return `Rate limiting changed. Add backoff on 429 (respect Retry-After) and lower request concurrency at ${where(e)}.`;
    case 'D13': return `The provider announced deprecation (${e.title}). Plan the migration before the date; the radar tracks the deadline.`;
    case 'D14': return `Successful responses now contain empty lists. Check whether a filter or parameter changed meaning; do not treat empty as "no data" without a check.`;
    case 'D16': return `Both the old and new field are sent but differ. The alias keeps reading the old one; switch the code to the new field once confirmed.`;
    case 'D17': return `The endpoint now answers 404/410. Find the replacement endpoint in the provider's docs and update ${where(e)}.`;
    default: return `Review the change and the code that uses it (${where(e)}).`;
  }
}

const leaf = (p: string) => p.slice(p.lastIndexOf('.') + 1).replace(/\[\]$/, '');
const factorFromTitle = (t: string) => { const m = t.match(/×(1\/)?([\d.]+)/); return m ? (m[1] ? 1 / Number(m[2]) : Number(m[2])) : 1; };

const RISK: Record<string, AiExplanationBody['risk']> = { breaking: 'high', warning: 'medium', info: 'low' };

/** Template explanation: the AI's fallback, and the immediate text alerts can always send. */
export function templateExplanation(e: DriftEvent): AiExplanationBody {
  const rec = suggestionFor(e);
  const used = e.usages.length ? `Used in ${e.usages.length} place${e.usages.length > 1 ? 's' : ''}: ${where(e)}.` : 'No code reads it, so nothing breaks today.';
  const auto = e.fix?.rule ? ' Seismo opened a safe fix PR (data only).' : ' This needs a human decision; Seismo will not change it automatically.';
  const summary = `${e.title} on ${svc(e)} (detector ${e.detector}, confidence ${Math.round(e.confidence * 100)}%).`;
  const short = `Seismo [${e.severity}] ${e.service}: ${e.title}. ${e.usages.length ? `Affects ${where(e)}.` : ''}`.slice(0, 290);
  return {
    title: e.title.slice(0, 120),
    summary: summary.slice(0, 600),
    impact: used.slice(0, 400),
    recommendation: rec.slice(0, 400),
    risk: RISK[e.severity] ?? 'medium',
    channels: {
      whatsapp: short.length >= 10 ? short : `Seismo: ${e.title}`.padEnd(10, '.'),
      slack: `*${e.title}* (${e.severity})\n${summary}\n${used}${auto}\n> ${rec}`.slice(0, 1500),
      emailSubject: `[Seismo ${e.severity}] ${e.service}: ${e.title}`.slice(0, 140),
      emailBody: `${summary}\n\n${used}${auto}\n\nWhat to do: ${rec}`.slice(0, 3000),
    },
  };
}
