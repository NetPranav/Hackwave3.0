"use client";

import { useEffect, useState } from "react";

export const STAGE_W = 1920;
export const STAGE_H = 1080;

/**
 * A fixed 1920x1080 canvas, scaled to fit any screen and centred. Everything inside is laid out in stage pixels,
 * so the deck looks the same on a laptop and on a projector.
 */
export default function Stage({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-page-bg">
      <div
        className="absolute left-1/2 top-1/2 h-[1080px] w-[1920px] origin-center overflow-hidden bg-page-bg transition-opacity duration-300"
        style={{ transform: `translate(-50%, -50%) scale(${scale})`, opacity: scale ? 1 : 0 }}
      >
        {children}
      </div>
    </div>
  );
}
