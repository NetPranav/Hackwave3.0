"use client";

import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

/** On/off switch. Dark track when on, quiet outline when off. `label` is read by screen readers. */
export default function Switch({ checked, onChange, label, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        checked
          ? "border-btn-primary bg-btn-primary dark:border-dark-btn-primary dark:bg-dark-btn-primary"
          : "border-box-outline bg-dash-bg dark:border-dark-border dark:bg-white/[0.04]",
        className
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all",
          checked ? "left-[18px] bg-white" : "left-0.5 bg-text-primary/40 dark:bg-white/40"
        )}
      />
    </button>
  );
}
