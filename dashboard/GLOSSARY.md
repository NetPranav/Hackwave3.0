# Plain-words glossary

The dashboard speaks plain English. The engine, the contracts and the docs use technical terms; **screens use the right-hand column**. Code, file names, JSON and API field names keep the technical term. A technical term may appear in a tooltip (`title`) or in a code box, never as a heading, button or sentence.

Helpers live in `src/lib/plain.ts` (`plainType`, `plainUsage`, `plainFixType`, `SAFETY_CHECKS`, `FIX_PROMISES`).

| Engine / docs word | Say this on screen |
|---|---|
| drift, mutation, drift event | change |
| endpoint | API call |
| baseline | before / how it normally looks |
| presence % | seen in (% of responses) |
| magnitude, p50 | typical size |
| p95 latency | response time (tooltip: 95 of 100 responses are faster) |
| 429 | rate-limited |
| SSE | LIVE |
| payload, synthetic | response, sample (no real data) |
| enum | list of values / new option |
| workflow | feature |
| call site, code read | place in your code |
| alias, alias rule | safe fix |
| fix ladder, rung 1 / 2 / 3 | fix type: automatic fix, or needs a person (convert the values / change the code) |
| C1–C8 | safety checks 1–8, each with a plain name (`SAFETY_CHECKS`) |
| G1–G4 | the four promises of a fix (`FIX_PROMISES`) |
| detector ID (D3, D5…), detector | the change's plain name ("Field rename"); the ID only in a tooltip |
| deterministic | fixed rules, no AI |
| transform | convert values |
| behaviour change | code change |
| persistence / branching | saved data / logic |
| Sunset header, RFC 8594 | shutdown date |
| nominal | normal |
| fail-open | never blocks your app |
| SDK | the small add-on / install guide |
| NIM, Nemotron | AI (model name in a tooltip) |

Words that stay as they are because they are already plain or are the product's own names: **breaking**, **suspected**, **PR / pull request**, **review queue**, **dashboard**, **API**, **field**, **response**, **provider**, **deploy**.
