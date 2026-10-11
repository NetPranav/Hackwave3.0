import type { Metadata } from "next";
import LandingNav from "@/components/landing/LandingNav";
import Hero from "@/components/landing/Hero";
import ProductTabs from "@/components/landing/ProductTabs";
import Problem from "@/components/landing/Problem";
import Catch from "@/components/landing/Catch";
import LiveDemo from "@/components/landing/LiveDemo";
import Approach from "@/components/landing/Approach";
import Safety from "@/components/landing/Safety";
import Compare from "@/components/landing/Compare";
import Faq from "@/components/landing/Faq";
import FinalCta from "@/components/landing/FinalCta";

export const metadata: Metadata = {
  title: "Seismo · Dependabot for the APIs you depend on",
  description: "Seismo catches silent changes in the APIs you depend on, shows which of your code breaks, and opens a safe fix pull request.",
};

export default function LandingPage() {
  return (
    <>
      <LandingNav />
      <main>
        <Hero />
        <ProductTabs />
        <Problem />
        <Catch />
        <LiveDemo />
        <Approach />
        <Safety />
        <Compare />
        <Faq />
      </main>
      <FinalCta />
    </>
  );
}
