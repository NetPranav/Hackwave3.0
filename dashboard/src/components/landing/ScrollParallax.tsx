"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

const depthOf = (el: Element) => Number((el as HTMLElement).dataset.depth ?? 1);

/**
 * Scroll-driven parallax for the landing page. Every [data-enter] element (see Reveal) gets one scrubbed timeline:
 * it rises and fades in as it enters, then keeps drifting up as it leaves. Deeper elements (data-depth) travel
 * further, so layers separate. Section backgrounds drift slower than their content. The hero plays in on load.
 */
export default function ScrollParallax({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const sections = gsap.utils.toArray<HTMLElement>("section", root.current);

        sections.forEach((section, index) => {
          const items = gsap.utils.toArray<HTMLElement>("[data-enter]", section);
          const backdrop = section.querySelector<HTMLElement>(":scope > [aria-hidden].absolute");

          if (backdrop) {
            gsap.fromTo(backdrop, { yPercent: -8 }, { yPercent: 8, ease: "none", scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: true } });
          }

          if (index === 0) {
            // Hero: play in on load, then drift away at different speeds as you scroll.
            gsap.from(items, { y: (_i: number, el: Element) => 70 * depthOf(el), opacity: 0, duration: 1.2, ease: "power3.out", stagger: 0.09, delay: 0.15 });
            items.forEach((el) =>
              gsap.to(el, { y: -90 * depthOf(el), ease: "none", scrollTrigger: { trigger: section, start: "top top", end: "bottom top", scrub: 0.8 } })
            );
            return;
          }

          items.forEach((el) => {
            const d = depthOf(el);
            const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.8 } });
            tl.fromTo(el, { y: 120 * d, opacity: 0 }, { y: 0, opacity: 1, ease: "power2.out", duration: 0.35 });
            tl.to(el, { y: -60 * d, ease: "none", duration: 0.65 });
          });
        });
      });
      return () => mm.revert();
    },
    { scope: root }
  );

  return <div ref={root}>{children}</div>;
}
