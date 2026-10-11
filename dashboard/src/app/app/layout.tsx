import { Suspense } from "react";
import AppNavbar from "@/components/layout/AppNavbar";
import { SeismoDataProvider } from "@/lib/api/data";
import { LiveProvider } from "@/lib/api/live";

export default function DashboardLayout({ children }: LayoutProps<"/app">) {
  return (
    <LiveProvider>
    <SeismoDataProvider>
    <div className="min-h-screen bg-dash-bg text-text-primary transition-colors duration-150 antialiased selection:bg-accent selection:text-white dark:bg-dark-dash-bg dark:text-white">
      <Suspense
        fallback={
          <div className="h-11 w-full border-b border-box-outline bg-section transition-colors dark:border-dark-border dark:bg-dark-dash-section" />
        }
      >
        <AppNavbar />
      </Suspense>
      {children}
    </div>
    </SeismoDataProvider>
    </LiveProvider>
  );
}
