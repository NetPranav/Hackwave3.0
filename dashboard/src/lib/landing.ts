// Landing page copy. Every number carries its evidence label (docs/PS/evidence.md); competitor cells are per their public material.

export const NAV_LINKS = [
  { label: "How it works", href: "#how" },
  { label: "What we catch", href: "#catch" },
  { label: "Try it", href: "#demo" },
  { label: "Compare", href: "#compare" },
  { label: "Docs", href: "/docs/sdk" },
];

export const EVIDENCE = [
  { value: "1,970 of 3,075", text: "web APIs did not always flag breaking changes in minor or patch releases. Only 517 used major versions consistently.", tag: "Confirmed", source: "ICWE 2024, Serbout and Pautasso" },
  { value: "500 to 100", text: "Pipedrive, 15 Jan 2025: asking for 500 items now returns at most 100. No error.", tag: "Confirmed", source: "Official changelog" },
  { value: "1,000", text: "Lightspeed, Feb 2020: asking for more returns the first 1,000. The request is not rejected.", tag: "Confirmed", source: "Official changelog" },
  { value: "= became phrase search", text: "Jira Cloud, 6 Oct 2026: a text search now matches any text containing the phrase. Same syntax, wider results.", tag: "Confirmed", source: "Announced change, not an incident" },
  { value: "84% to 51%", text: "Same model name, different behaviour on one prime-number benchmark, Mar 2023 to Jun 2023.", tag: "Peer-reviewed", source: "HDSR 2024. Behaviour drift only" },
];

export const CATCHES = [
  { title: "Renamed field", text: "A field got a new name. Old code reads nothing.", before: "customer_id", after: "customerId", family: "Shape" },
  { title: "Lower limit", text: "Same request, fewer results. No error.", before: "limit 500 gives 500", after: "limit 500 gives 100", family: "Behaviour" },
  { title: "New error format", text: "Errors arrive in a different body.", before: "text message", after: "JSON object", family: "Shape" },
  { title: "Pagination change", text: "Pages overlap or end early.", before: "page=2", after: "cursor token", family: "Behaviour" },
  { title: "Rate limit change", text: "New limits and new 429 responses.", before: "1000 per minute", after: "100 per minute", family: "Behaviour" },
  { title: "Meaning change", text: "Same name, same type, different unit or enum meaning.", before: "amount in rupees", after: "amount in paise", family: "Meaning" },
];

export const STEPS = [
  { n: "01", title: "Install the GitHub App", text: "We read your repo and build a code map: which functions call which API fields." },
  { n: "02", title: "Add one line of SDK", text: "A read-only, fail-open SDK sends shape fingerprints of the responses your app already gets." },
  { n: "03", title: "Get alerts and safe PRs", text: "When a baseline changes, you see the exact code at risk and get a small fix pull request." },
];

export const PIPELINE = [
  { name: "Your app + SDK", detail: "Reads a copy of each response. Never changes it, never blocks." },
  { name: "Fingerprint", detail: "Types, lengths, magnitudes, percentiles. No record values." },
  { name: "Detectors", detail: "Plain code compares today with the learned baseline. No AI decides." },
  { name: "Code map", detail: "Finds every file and line that reads the field." },
  { name: "Severity", detail: "A changed field in checkout outranks one nobody reads." },
  { name: "Alert + fix PR", detail: "Tells you where you look, and opens a one-file pull request." },
];

export const GUARANTEES = [
  { id: "G1", title: "Identity on the old shape", text: "Responses that look like before come out exactly as before." },
  { id: "G2", title: "Additive only", text: "It can add a name. It can never remove or change anything." },
  { id: "G3", title: "No prototype tricks", text: "A hostile or buggy rule cannot pollute objects." },
  { id: "G4", title: "Never throws", text: "Errors are caught and the input is returned unchanged." },
];

export const LADDER = [
  { step: "Alias", text: "A rename. Automatic pull request.", who: "A person merges" },
  { step: "Transform", text: "A unit or format change. Review only.", who: "A person asks for it" },
  { step: "Behaviour change", text: "Limits, pagination, meaning. Review only.", who: "A person decides" },
];

export const PROMISES = [
  { title: "Read-only", text: "The SDK never changes a response." },
  { title: "Fails open", text: "If Seismo is down, your app does not notice." },
  { title: "Not in the path", text: "No proxy. Nothing sits between you and the provider." },
  { title: "Shapes, not values", text: "Types, lengths, magnitudes and batch percentiles. Hashes use a salt that stays on your server." },
];

export type Cell = "yes" | "partial" | "no";

/** Named tools, from docs/PS/competitors.md section 2. Cells are our reading of their public material (vendor claims). */
export const COMPARE_COLUMNS = [
  { name: "FlareCanary", kind: "Drift poller" },
  { name: "DriftGuard", kind: "Drift poller" },
  { name: "oasdiff", kind: "Spec diff" },
  { name: "Pact", kind: "Contract tests" },
  { name: "Postman Insights", kind: "Observability" },
  { name: "Datadog APM", kind: "Observability" },
  { name: "Seismo", kind: "Us" },
];

export const COMPARE_ROWS: { label: string; cells: Cell[]; seismoNote?: string }[] = [
  { label: "Watches third-party APIs you call", cells: ["yes", "yes", "no", "partial", "no", "partial", "yes"] },
  { label: "Uses real production traffic", cells: ["no", "no", "no", "no", "yes", "yes", "yes"] },
  { label: "Needs no spec or provider help", cells: ["yes", "yes", "no", "partial", "yes", "yes", "yes"] },
  { label: "Shape changes", cells: ["yes", "yes", "yes", "yes", "partial", "no", "yes"] },
  { label: "Behaviour changes (limits, pagination)", cells: ["no", "no", "no", "no", "no", "partial", "yes"] },
  { label: "Meaning changes (units, enums)", cells: ["no", "no", "no", "no", "no", "no", "yes"] },
  { label: "Knows which of your code is hit", cells: ["no", "no", "no", "partial", "no", "no", "yes"] },
  { label: "Opens a safe fix pull request", cells: ["no", "no", "no", "no", "no", "no", "yes"] },
  { label: "Zero install in the app", cells: ["yes", "yes", "yes", "no", "partial", "no", "no"], seismoNote: "One-line SDK" },
];

export const FAQ = [
  { q: "Is this a proxy?", a: "No. Nothing sits in your request path." },
  { q: "What if Seismo goes down?", a: "Your app does not notice. The SDK fails open and never throws into your code." },
  { q: "Do you see my customer data?", a: "No. We receive shapes: types, lengths, magnitudes and percentiles. Plain values only for fields on your own allow-list." },
  { q: "Does the AI change my code?", a: "No. The AI only explains and classifies. A fix is one data rule that you review and merge." },
  { q: "What if the rename guess is wrong?", a: "The rule only adds a field when it is missing, and your old field always wins. A wrong guess cannot overwrite anything." },
  { q: "Why not just use a drift poller?", a: "Pollers are cheap and good for structure. They cannot see your real traffic, your values or your code. Use both if you like." },
];
