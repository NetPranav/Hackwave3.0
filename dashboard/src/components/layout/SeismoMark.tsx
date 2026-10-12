import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Arms of the mark as [angle in degrees clockwise from up, length], from the centre of a 100 x 100 box.
 * Uneven lengths, like one burst on a seismograph.
 */
const ARMS: [number, number][] = [
  [0, 40],
  [55, 26],
  [100, 35],
  [150, 21],
  [200, 38],
  [250, 30],
  [300, 33],
];

const end = ([deg, len]: [number, number]) => {
  const a = (deg * Math.PI) / 180;
  return [50 + len * Math.sin(a), 50 - len * Math.cos(a)].map((n) => Math.round(n * 10) / 10);
};

const PATH = ARMS.map((arm) => {
  const [x, y] = end(arm);
  return "M50 50L" + x + " " + y;
}).join("");

/**
 * The Seismo mark: a hand-stamped asterisk. The filter roughens the edges and speckles the ink like a rubber stamp.
 * Colour comes from `currentColor`, so it follows the text colour (ink in light mode, white in dark mode).
 */
export default function SeismoMark({ size = 22, className }: { size?: number; className?: string }) {
  const id = "seismo-ink-" + useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden className={cn("shrink-0", className)}>
      <defs>
        <filter id={id} x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="edge" />
          <feDisplacementMap in="SourceGraphic" in2="edge" scale="3" xChannelSelector="R" yChannelSelector="G" result="rough" />
          <feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="1" seed="3" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -4 0 0 0 3.3" result="specks" />
          <feComposite in="rough" in2="specks" operator="in" />
        </filter>
      </defs>
      <path d={PATH} stroke="currentColor" strokeWidth="11" strokeLinecap="square" filter={"url(#" + id + ")"} />
    </svg>
  );
}
