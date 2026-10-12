"use client";

import { useEffect, useState } from "react";

export const STAGE_W = 1920;
export const STAGE_H = 1080;

/** Share of the screen the slide uses, so it never touches the edges of a projector. */
const FILL = 0.94;
/** Grid cell of the graph-paper background, in stage pixels. */
const CELL = 96;

/**
 * A fixed 1920x1080 canvas, scaled to fit any screen and centred. Everything inside is laid out in stage pixels,
 * so the deck looks the same on a laptop and on a projector. The graph-paper grid covers the whole screen and lines
 * up with the slide, so on a 4:3 projector the bands above and below the slide look like part of the page.
 */
export default function Stage({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState({ scale: 0, left: 0, top: 0 });

  useEffect(() => {
    const fit = () => {
      const scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H) * FILL;
      setView({ scale, left: (window.innerWidth - STAGE_W * scale) / 2, top: (window.innerHeight - STAGE_H * scale) / 2 });
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const cell = CELL * view.scale;
  return (
    <div
      className="fixed inset-0 overflow-hidden bg-page-bg"
      style={{
        backgroundImage:
          "linear-gradient(to right, color-mix(in srgb, var(--color-graph-stroke) 50%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--color-graph-stroke) 50%, transparent) 1px, transparent 1px)",
        backgroundSize: cell ? `${cell}px ${cell}px` : undefined,
        backgroundPosition: `${view.left}px ${view.top}px`,
      }}
    >
      <div
        className="absolute left-0 top-0 h-[1080px] w-[1920px] origin-top-left transition-opacity duration-300"
        style={{ transform: `translate(${view.left}px, ${view.top}px) scale(${view.scale})`, opacity: view.scale ? 1 : 0 }}
      >
        {children}
      </div>
    </div>
  );
}
