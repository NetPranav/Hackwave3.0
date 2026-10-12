import Link from "next/link";
import { cn } from "@/lib/utils";
import SeismoMark from "./SeismoMark";

/**
 * The seismo wordmark: the stamped asterisk mark, then the name in the regular weight.
 * (The font has no bold file, so a bold class would only be faked by the browser and look smeared.)
 */
export default function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} aria-label="Seismo home" className={cn("group flex items-center gap-2.5", className)}>
      <SeismoMark size={28} className="text-text-primary transition-transform duration-500 ease-out group-hover:rotate-[25deg] dark:text-white" />
      <span className="font-aeonik text-[19px] leading-none tracking-[-0.035em] text-text-primary dark:text-white">seismo</span>
    </Link>
  );
}
