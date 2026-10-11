"use client";

import { useDeck } from "./Deck";

/** A link to another slide. In deck mode it moves the deck; on phones it is a normal in-page link. */
export default function DeckLink({ to, className, children }: { to: string; className?: string; children: React.ReactNode }) {
  const { enabled, go } = useDeck();
  return (
    <a
      href={"#" + to}
      className={className}
      onClick={(e) => {
        if (!enabled) return;
        e.preventDefault();
        go(to);
      }}
    >
      {children}
    </a>
  );
}
