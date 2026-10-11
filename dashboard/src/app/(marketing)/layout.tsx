import { SmoothScroll } from "@/components/layout/SmoothScroll";

// Public landing side: smooth scroll + scroll-driven GSAP. The dashboard (/app) doesn't use Lenis.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <SmoothScroll>{children}</SmoothScroll>;
}
