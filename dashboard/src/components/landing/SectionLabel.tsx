/** The numbered orange tag that opens each section: a boxed number, then the name in mono capitals. */
export default function SectionLabel({ n, label }: { n: string; label: string }) {
  return (
    <p className="flex items-center gap-3 font-aeonik-mono text-sm uppercase tracking-[0.15em] text-accent">
      <span className="flex h-7 w-7 items-center justify-center rounded border border-accent text-xs">{n}</span>
      {label}
    </p>
  );
}
