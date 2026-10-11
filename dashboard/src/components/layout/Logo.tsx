import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The seismo wordmark: a small ray mark with an orange centre, then the name in the regular weight.
 * (The font has no bold file, so a bold class would only be faked by the browser and look smeared.)
 */
export default function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} aria-label="Seismo home" className={cn("group flex items-center gap-2.5", className)}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="text-text-primary dark:text-white">
        <g
          className="origin-center transition-transform duration-500 ease-out group-hover:rotate-45"
          style={{ transformBox: "fill-box" }}
        >
          <path
            d="M12 2.5V6.5M12 17.5V21.5M2.5 12H6.5M17.5 12H21.5M5.3 5.3L8.1 8.1M15.9 15.9L18.7 18.7M5.3 18.7L8.1 15.9M15.9 8.1L18.7 5.3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </g>
        <circle cx="12" cy="12" r="3" className="fill-accent" />
      </svg>
      <span className="font-aeonik text-[19px] leading-none tracking-[-0.035em] text-text-primary dark:text-white">seismo</span>
    </Link>
  );
}
