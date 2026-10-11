import Logo from "@/components/layout/Logo";

/**
 * Shared page for sign in and onboarding: one container, so the logo and the content share the same left edge.
 * On large screens it is exactly one screen tall and never scrolls. On phones it grows and scrolls as normal.
 */
export default function AuthPage({ children, logo = true }: { children: React.ReactNode; logo?: boolean }) {
  return (
    <div className="min-h-dvh lg:h-dvh lg:overflow-hidden">
      <div className="mx-auto flex min-h-dvh w-full max-w-[1440px] flex-col px-6 py-5 md:px-10 lg:h-full lg:min-h-0 lg:px-16">
        {logo && <Logo className="w-fit shrink-0" />}
        {children}
      </div>
    </div>
  );
}
