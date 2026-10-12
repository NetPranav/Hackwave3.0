"use client";

import { useEffect, useRef } from "react";
import { STAGE_W } from "./Stage";

/**
 * The live signal the scenes steer with GSAP. Every value is 0..1 unless noted.
 * reveal: how much of the line is drawn, left to right. calm: the idle wobble. quake: the tremor in the middle.
 * heat: line colour, ink to accent. y: where the line sits on the stage (stage pixels).
 * s1..s3: three smaller local tremors at SHOCK_X, each turning its own stretch of the line orange.
 */
export interface Signal {
  reveal: number;
  calm: number;
  quake: number;
  heat: number;
  y: number;
  s1: number;
  s2: number;
  s3: number;
}

export const createSignal = (): Signal => ({ reveal: 0, calm: 1, quake: 0, heat: 0, y: 790, s1: 0, s2: 0, s3: 0 });

/** Stage x of the three local tremors (slide 3 pins its cards to these). */
export const SHOCK_X = [400, 960, 1520];
const SHOCK_W = 120;

const LEFT = 96;
const RIGHT = STAGE_W - 96;
const HEIGHT = 520;
const INK: [number, number, number] = [26, 25, 24];
const ACCENT: [number, number, number] = [255, 110, 62];

/** Smooth 1-D value noise in -1..1, so the trace looks like a real pen, not a sine wave. */
function noise(x: number) {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n: number) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

const mix = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
const bell = (x: number, centre: number, width: number) => Math.exp(-(((x - centre) / width) ** 2));
const shocksOf = (s: Signal) => [s.s1, s.s2, s.s3];

/** How orange the line is at x: the global heat, or the local heat of any tremor there. */
function heatAt(s: Signal, x: number) {
  let h = Math.max(s.heat, s.quake * bell(x, STAGE_W / 2, 420));
  shocksOf(s).forEach((v, i) => (h = Math.max(h, Math.min(1, v * bell(x, SHOCK_X[i], SHOCK_W * 1.6) * 1.4))));
  return h;
}

/** A seismograph trace across the stage. It scrolls like paper under a pen and ripples where the cursor is. */
export default function Seismograph({ signal }: { signal: React.RefObject<Signal> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = STAGE_W * dpr;
    canvas.height = HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    const mouse = { x: -9999, energy: 0 };
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * STAGE_W;
      mouse.energy = 1;
    };
    window.addEventListener("pointermove", onMove);

    let raf = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const s = signal.current;
      const mid = HEIGHT / 2;
      ctx.clearRect(0, 0, STAGE_W, HEIGHT);
      mouse.energy *= 0.96;

      const end = LEFT + (RIGHT - LEFT) * s.reveal;

      // Faint baseline the trace rides on.
      ctx.strokeStyle = "rgba(26, 25, 24, 0.12)";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 10]);
      ctx.beginPath();
      ctx.moveTo(LEFT, mid);
      ctx.lineTo(RIGHT, mid);
      ctx.stroke();
      ctx.setLineDash([]);

      if (s.reveal > 0.001) {
        const gradient = ctx.createLinearGradient(LEFT, 0, RIGHT, 0);
        for (let i = 0; i <= 64; i++) {
          const h = heatAt(s, LEFT + ((RIGHT - LEFT) * i) / 64);
          gradient.addColorStop(i / 64, `rgb(${mix(INK[0], ACCENT[0], h)}, ${mix(INK[1], ACCENT[1], h)}, ${mix(INK[2], ACCENT[2], h)})`);
        }
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.beginPath();
        let penY = mid;
        for (let x = LEFT; x <= end; x += 3) {
          const paper = x * 0.018 + t * 2.2;
          const calm = s.calm * (noise(paper) * 9 + noise(paper * 3.1) * 4);
          const env = bell(x, STAGE_W / 2, 340);
          const quake = s.quake * env * (noise(x * 0.09 + t * 16) * 190 + Math.sin(x * 0.11 - t * 22) * 40);
          const shocks = shocksOf(s).reduce(
            (sum, v, i) => sum + (v ? v * bell(x, SHOCK_X[i], SHOCK_W) * (noise(x * 0.11 + t * 15 + i * 40) * 80 + Math.sin(x * 0.14 - t * 20) * 20) : 0),
            0
          );
          const ripple = mouse.energy * Math.exp(-(((x - mouse.x) / 110) ** 2)) * Math.sin(x * 0.12 - t * 12) * 26;
          const y = mid + calm + quake + shocks + ripple;
          if (x === LEFT) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          penY = y;
        }
        ctx.stroke();

        // The pen at the leading edge.
        ctx.fillStyle = `rgba(255, 110, 62, ${0.18 + 0.12 * Math.sin(t * 4)})`;
        ctx.beginPath();
        ctx.arc(end, penY, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgb(255, 110, 62)";
        ctx.beginPath();
        ctx.arc(end, penY, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      canvas.style.transform = `translateY(${s.y - HEIGHT / 2}px)`;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, [signal]);

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute left-0 top-0 h-[520px] w-[1920px]" />;
}
