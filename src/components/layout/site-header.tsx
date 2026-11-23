import Link from "next/link";
import { Suspense } from "react";
import { AuthNav } from "@/components/auth/auth-nav";

/*
 * Global header — Phase 2 update (UI_UX_DESIGN.md §5 navigation).
 * The auth slot streams inside Suspense (verified claims + cookies are
 * runtime data under Cache Components — Next.js 16). Marketing claim
 * discipline unchanged: copy describes the demo/mock status of the
 * identify flow honestly.
 */

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/identify", label: "Identify" },
  { href: "/library", label: "Library" },
  { href: "/#care-basics", label: "Care basics" },
  { href: "/about", label: "About" },
] as const;

export function SiteHeader() {
  return (
    <header className="border-border-muted bg-surface border-b">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold tracking-tight"
        >
          <span
            aria-hidden="true"
            className="bg-brand-600 inline-block h-6 w-6 rounded-full"
          />
          <span>
            Plant<span className="text-brand-700">AI</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Main links are desktop-only: on mobile the bottom nav covers
              them (single navigation, no duplication). */}
          <nav
            aria-label="Main navigation"
            className="hidden md:block"
          >
            <ul className="flex items-center gap-1 sm:gap-3">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:bg-brand-50 hover:text-brand-800 rounded-md px-3 py-2 text-sm font-medium transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <Suspense
            fallback={<div className="w-40" aria-hidden="true" />}
          >
            <AuthNav />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
