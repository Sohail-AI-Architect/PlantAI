import type { Metadata } from "next";
import type { Viewport } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { BottomNav } from "@/components/layout/bottom-nav";

/*
 * Root layout — PlantAI Phase 1 skeleton.
 *
 * Phase 1 decisions:
 * - Inter via next/font/google (self-hosted at build; zero-cost per
 *   ENVIRONMENT_SETUP.md). Article serif (UI_UX_DESIGN.md §2.2) is deferred
 *   to Phase 3 when blog typography ships.
 * - Metadata title/template follows SEO_STRATEGY.md §4; per-page overrides
 *   land with real content in Phase 3.
 * - NEXT_PUBLIC_SITE_URL is optional locally; set it in production so
 *   canonical/metadataAbsolute URLs resolve (ENVIRONMENT_SETUP.md §5).
 */

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "PlantAI — Identify and Care for Your Plants",
    template: "%s | PlantAI",
  },
  description:
    "Identify plants from photos with AI-powered plant identification, then learn watering, sunlight, soil and fertilizer basics from a growing, human-written plant library.",
};

export const viewport: Viewport = {
  themeColor: "#059669",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="bg-background text-foreground flex min-h-dvh flex-col">
        <SiteHeader />
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
        <SiteFooter />
        <Suspense
          fallback={
            <div
              aria-hidden="true"
              className="border-border-muted bg-surface fixed inset-x-0 bottom-0 z-40 h-16 border-t md:hidden"
            />
          }
        >
          <BottomNav />
        </Suspense>
      </body>
    </html>
  );
}
