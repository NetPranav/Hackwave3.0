import type { ReviewSuggestion } from "@/lib/mock/review";

/** Pretty-print the rule so it reads as a small block of data, never a long scrolling line. */
function formatRule(rule: string): string {
  try {
    return JSON.stringify(JSON.parse(rule), null, 2);
  } catch {
    return rule;
  }
}

/** The suggested change as data. Always review-only: transforms and behaviour changes are never auto-applied. */
export default function SuggestionPanel({ suggestion }: { suggestion: ReviewSuggestion }) {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50 dark:text-white/45">
          Suggested change
        </h4>
        <span className="rounded border border-box-outline px-2 py-0.5 font-aeonik-mono text-[10px] uppercase tracking-wider text-text-primary/60 dark:border-dark-border dark:text-white/60">
          {suggestion.kind === "alias" ? "Automatic fix · you merge" : suggestion.kind === "transform" ? "Convert values · needs review" : "Code change · needs review"}
        </span>
      </div>

      <p className="mt-3 font-aeonik text-sm font-medium text-text-primary dark:text-white">{suggestion.summary}</p>

      <pre className="mt-2 whitespace-pre-wrap break-words rounded border border-box-outline/70 bg-inset px-3 py-2.5 font-aeonik-mono text-[11px] leading-relaxed text-text-primary/85 dark:border-dark-border dark:bg-dark-inset dark:text-white/85">
        <code>{formatRule(suggestion.rule)}</code>
      </pre>

      <p className="mt-2 font-aeonik-light text-xs leading-relaxed text-text-primary/60 dark:text-white/60">
        {suggestion.note}
      </p>
    </section>
  );
}
