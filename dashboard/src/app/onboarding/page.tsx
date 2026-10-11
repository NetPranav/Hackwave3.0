import type { Metadata } from "next";
import AuthPage from "@/components/auth/AuthPage";
import OnboardingView from "@/components/onboarding/OnboardingView";

export const metadata: Metadata = { title: "Get started · Seismo" };

export default function OnboardingPage() {
  return (
    <AuthPage logo={false}>
      <OnboardingView />
    </AuthPage>
  );
}
