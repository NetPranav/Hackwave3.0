import { SETUP_PR } from "@/lib/mock/onboarding";

const PRIMARY =
  "rounded-md bg-btn-primary px-5 py-2.5 font-aeonik-mono text-xs uppercase tracking-wider text-white transition-transform hover:scale-[1.02]";
const QUIET =
  "font-aeonik-mono text-xs uppercase tracking-wider text-text-primary/60 underline-offset-4 hover:text-text-primary hover:underline";

interface PrStepProps {
  onNext: () => void;
  onSkip: () => void;
}

/** The one-time setup PR. It only adds files, and a person merges it. */
export default function PrStep({ onNext, onSkip }: PrStepProps) {
  return (
    <div className="rounded-md border border-box-outline bg-section p-5">
      <p className="font-aeonik-mono text-[11px] uppercase tracking-[0.2em] text-text-primary/50">Pull request #{SETUP_PR.number}</p>
      <p className="mt-2 font-aeonik text-base">{SETUP_PR.title}</p>
      <p className="mt-2 font-aeonik-light text-sm text-text-primary/60">
        This prepares the one file that later fixes use, <code className="font-aeonik-mono text-[0.9em]">seismo/aliases.json</code>. It does not change how your app behaves.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <a href={SETUP_PR.url} target="_blank" rel="noopener noreferrer" className={PRIMARY}>
          Open on GitHub ↗
        </a>
        <button type="button" onClick={onNext} className={QUIET}>
          I merged it
        </button>
        <button type="button" onClick={onSkip} className={QUIET}>
          Skip for now
        </button>
      </div>
    </div>
  );
}
