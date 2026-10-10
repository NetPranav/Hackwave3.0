import type { Metadata } from "next";
import localFont from "next/font/local";
import { SmoothScroll } from "@/components/layout/SmoothScroll";
import "./globals.css";

const aeonik = localFont({
  src: "../../fonts/aeonik-regular.woff2",
  variable: "--font-aeonik-regular",
});

const aeonikLight = localFont({
  src: "../../fonts/aeonik-light.woff2",
  variable: "--font-aeonik-light-face",
});

const aeonikMono = localFont({
  src: "../../fonts/aeonikmono-regular.woff2",
  variable: "--font-aeonik-mono-face",
});

export const metadata: Metadata = {
  title: "Seismo",
  description: "Dependabot for the APIs you depend on.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${aeonik.variable} ${aeonikLight.variable} ${aeonikMono.variable} antialiased`}
    >
      <body className="min-h-full">
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
