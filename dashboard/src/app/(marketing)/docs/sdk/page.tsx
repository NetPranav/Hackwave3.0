import type { Metadata } from "next";
import Link from "next/link";
import CodeBlock from "@/components/docs/CodeBlock";
import DocsHeader from "@/components/docs/DocsHeader";
import StepRail, { type Step } from "@/components/docs/StepRail";

export const metadata: Metadata = {
  title: "Install the SDK in 2 minutes · Seismo",
  description: "Add one line to your server code and Seismo starts watching the APIs you depend on. Read-only, fail-open, and no customer data leaves your server.",
};

const STEPS: Step[] = [
  { id: "install", label: "Install" },
  { id: "init", label: "Add one line" },
  { id: "allow-list", label: "Pick safe fields" },
  { id: "check", label: "Check it works" },
  { id: "fixes", label: "Fixes, later" },
];

const INSTALL = "npm install @seismo/sdk";

const INIT = `// server code only: your API route, server action, or app entry file
import { seismo } from "@seismo/sdk";

seismo.init({
  key: process.env.SEISMO_KEY, // from Settings → SDK keys
  sampleRate: 0.1,             // look at 1 in 10 calls (the default)
});`;

const ENV = `# .env.local (never commit this file)
SEISMO_KEY=sk_live_paste_your_key_here`;

const CONFIG = `{
  "enumAllowList": ["status", "currency"]
}`;

const ALIAS = `{
  "id": "a12",
  "kind": "alias",
  "endpoint": "GET /users/{id}",
  "path": "$",
  "target": "name",
  "source": "display_name"
}`;

const TRUST: { title: string; body: string }[] = [
  { title: "Read-only", body: "It looks at a copy of each response. Your app always gets the original, untouched." },
  { title: "Fail-open", body: "If Seismo is slow, down, or the SDK hits an error, your app does not notice. Errors are swallowed and the batch is dropped." },
  { title: "Off the request path", body: "All the work happens after the response is already handed back. No proxy, nothing in front of your traffic." },
  { title: "Shapes, never values", body: "It sends field names, types, lengths and rough sizes. Real values stay on your server, except the few fields you allow-list." },
];

const SAFETY: { code: string; title: string; body: string }[] = [
  { code: "G1", title: "Old data comes out unchanged", body: "If a response already looks like it used to, the fix does nothing at all." },
  { code: "G2", title: "It only adds, never replaces", body: "A fix can add a missing name. It can never remove or change something that is already there." },
  { code: "G3", title: "Safe names only", body: "Rules can only use plain field names. Anything that could tamper with objects is rejected." },
  { code: "G4", title: "It cannot crash your app", body: "If anything goes wrong, your original data is returned as it was." },
];

const FAQ: { q: string; a: string }[] = [
  { q: "What if Seismo is down?", a: "Your app keeps working exactly the same. The SDK sends data in the background and drops it if it cannot reach us." },
  { q: "Do you see my customers' data?", a: "No. We receive shapes: field names, types, lengths and rough sizes. The only plain values are the ones on the allow-list you choose, and the key that scrambles the rest never leaves your server." },
  { q: "How do I remove it?", a: "Delete the init lines and uninstall the package. Nothing else in your code depends on it, unless you merged a fix pull request. Those only touch seismo/aliases.json." },
  { q: "Can it slow my app down?", a: "It only looks at a sample of calls (1 in 10 by default) and does its work after the response is returned. We have not published a speed measurement yet, so we do not claim one." },
];

function Step({ id, index, title, children }: { id: string; index: number; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-box-outline pt-8 first:border-t-0 first:pt-0">
      <p className="font-aeonik-mono text-xs uppercase tracking-[0.2em] text-accent">{"Step 0" + index}</p>
      <h2 className="mt-3 font-aeonik text-3xl tracking-tight md:text-4xl">{title}</h2>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

const P = "max-w-2xl font-aeonik-light text-sm leading-relaxed text-text-primary/75 md:text-base";

export default function SdkDocsPage() {
  return (
    <div className="min-h-screen bg-page-bg text-text-primary selection:bg-accent selection:text-white">
      <DocsHeader />

      {/* Top: what this page does, and the promises up front. */}
      <section className="border-b border-box-outline bg-section">
        <div className="mx-auto max-w-[1440px] px-6 py-14 md:px-10 md:py-20 lg:px-16">
          <p className="font-aeonik-mono text-xs uppercase tracking-[0.2em] text-accent">SDK · Quickstart</p>
          <h1 className="mt-4 max-w-4xl font-aeonik text-5xl leading-[0.95] tracking-tight md:text-7xl">
            Install the SDK in 2 minutes
          </h1>
          <p className={P + " mt-6"}>
            One package, one line of code. After that Seismo watches the APIs your app calls and tells you when one of them
            quietly changes, before your users find out.
          </p>
          <ul className="mt-8 flex flex-wrap gap-2">
            {["Read-only", "Fail-open", "No values leave your server"].map((t) => (
              <li key={t} className="rounded border border-box-outline bg-dash-bg px-3 py-1.5 font-aeonik-mono text-[11px] uppercase tracking-wider text-text-primary/70">
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1440px] gap-12 px-6 py-14 md:px-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-16">
        <aside className="hidden lg:block">
          <StepRail steps={STEPS} />
        </aside>

        <div className="min-w-0 space-y-12">
          <Step id="install" index={1} title="Install the package">
            <p className={P}>Run this in the folder of the app that calls the APIs. It works with Node.js.</p>
            <CodeBlock title="terminal" code={INSTALL} />
          </Step>

          <Step id="init" index={2} title="Add one line to your server code">
            <p className={P}>
              Start it once, as early as you can, in server code only. It wraps <code className="font-aeonik-mono text-[0.9em]">fetch</code> and{" "}
              <code className="font-aeonik-mono text-[0.9em]">axios</code> so it can see the responses your app gets back from other companies&apos; APIs.
            </p>
            <CodeBlock title="server.ts" code={INIT} />
            <p className={P}>
              Your key is in the dashboard under <Link href="/app/settings" className="text-text-primary underline underline-offset-4 hover:text-accent">Settings → SDK keys</Link>.
              Keep it in an environment file. Never put it in a browser bundle or commit it.
            </p>
            <CodeBlock title=".env.local" code={ENV} />
          </Step>

          <Step id="allow-list" index={3} title="Pick the fields that are safe to read">
            <p className={P}>
              Seismo never needs the values in your data. The one exception is a short list you choose, for fields like
              <em> status</em> or <em>currency</em> where the possible values are not private. Seeing them lets us notice when a provider adds
              or renames one. Everything else is turned into scrambled fingerprints before it leaves your server.
            </p>
            <CodeBlock title="seismo.config.json" code={CONFIG} />
            <p className="max-w-2xl font-aeonik-mono text-[11px] uppercase tracking-wider text-text-primary/45">
              Assumption: the exact key name is confirmed when the SDK is published.
            </p>
          </Step>

          <Step id="check" index={4} title="Check that it works">
            <p className={P}>
              Make your app call one of its APIs, then open the <Link href="/app/status" className="text-text-primary underline underline-offset-4 hover:text-accent">API Status page</Link>.
              Calls, errors and response times should appear within about 10 seconds (our target for the demo).
            </p>
            <div className="grid gap-px overflow-hidden rounded-md border border-box-outline bg-box-outline md:grid-cols-3">
              {[
                ["Nothing shows up", "Check the key is set and the code runs on the server, not in the browser."],
                ["Only a few calls show", "That is the sample rate. Raise it while you test, then put it back."],
                ["Still stuck", "Restart the app. The SDK starts when the process starts."],
              ].map(([t, d]) => (
                <div key={t} className="bg-section p-5">
                  <p className="font-aeonik text-base">{t}</p>
                  <p className="mt-2 font-aeonik-light text-sm leading-relaxed text-text-primary/70">{d}</p>
                </div>
              ))}
            </div>
          </Step>

          <Step id="fixes" index={5} title="Fixes come later, and you do not write them">
            <p className={P}>
              When an API renames a field, Seismo opens a pull request. It changes one file, <code className="font-aeonik-mono text-[0.9em]">seismo/aliases.json</code>, by
              adding one line of data like this. A person on your team reads it and merges it. No code is written or run by an AI.
            </p>
            <CodeBlock title="seismo/aliases.json" code={ALIAS} />
            <p className={P}>
              A one-time setup pull request wraps your API clients with a small, tested function. It gives the old name back from the new
              one, only when the old one is missing. Four rules are checked by automated tests:
            </p>
            <div className="grid gap-px overflow-hidden rounded-md border border-box-outline bg-box-outline sm:grid-cols-2">
              {SAFETY.map((s) => (
                <div key={s.code} className="bg-section p-5">
                  <p className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-accent">{s.code}</p>
                  <p className="mt-2 font-aeonik text-base">{s.title}</p>
                  <p className="mt-1 font-aeonik-light text-sm leading-relaxed text-text-primary/70">{s.body}</p>
                </div>
              ))}
            </div>
          </Step>

          {/* Why it is safe to add. */}
          <section className="border-t border-box-outline pt-10">
            <p className="font-aeonik-mono text-xs uppercase tracking-[0.2em] text-accent">Why it is safe</p>
            <h2 className="mt-3 font-aeonik text-3xl tracking-tight md:text-4xl">What it does, and what it never does</h2>
            <div className="mt-6 grid gap-px overflow-hidden rounded-md border border-box-outline bg-box-outline md:grid-cols-2">
              {TRUST.map((t) => (
                <div key={t.title} className="bg-section p-6">
                  <p className="font-aeonik text-lg">{t.title}</p>
                  <p className="mt-2 font-aeonik-light text-sm leading-relaxed text-text-primary/70">{t.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="border-t border-box-outline pt-10">
            <p className="font-aeonik-mono text-xs uppercase tracking-[0.2em] text-accent">Questions</p>
            <dl className="mt-6 divide-y divide-box-outline rounded-md border border-box-outline bg-section">
              {FAQ.map((f) => (
                <div key={f.q} className="p-6">
                  <dt className="font-aeonik text-lg">{f.q}</dt>
                  <dd className="mt-2 max-w-2xl font-aeonik-light text-sm leading-relaxed text-text-primary/70">{f.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="flex flex-col items-start justify-between gap-6 rounded-md border border-box-outline bg-section p-8 md:flex-row md:items-center">
            <div>
              <p className="font-aeonik text-2xl tracking-tight">Ready to see your APIs?</p>
              <p className="mt-1 font-aeonik-light text-sm text-text-primary/70">Open the dashboard and watch the first calls arrive.</p>
            </div>
            <Link
              href="/app"
              className="rounded-md bg-btn-primary px-6 py-3 font-aeonik-mono text-sm uppercase tracking-wider text-white transition-transform hover:scale-[1.02]"
            >
              Open dashboard
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
