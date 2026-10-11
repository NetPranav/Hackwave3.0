import type { Metadata } from "next";
import OnboardingView from "@/components/onboarding/OnboardingView";

export const metadata: Metadata = { title: "Set up · Seismo" };

// v2-P2: GitHub sends users here after installing the app (setup_url, ?installation_id=…). Visual design: Adarsh (v2-A0).
export default function OnboardingPage() {
  return <OnboardingView />;
}
