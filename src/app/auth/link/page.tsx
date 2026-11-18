import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthLinkHandler } from "@/components/auth/auth-link-handler";

export const metadata: Metadata = {
  title: "Signing you in",
  robots: { index: false, follow: false },
};

/*
 * /auth/link — PKCE email-link landing for magic-link sign-in and sign-up
 * confirmation (F9). The interactive handler exchanges the one-time `?code=`
 * CLIENT-SIDE (the PKCE code_verifier lives in this browser's storage, so a
 * server route cannot perform the exchange — see F8 report for the same
 * structural constraint).
 *
 * Not in the proxy's guest-only list on purpose: the link must still be
 * consumed if a session already exists in this browser (the exchange then
 * replaces it with the addressed account, which is exactly what a magic
 * link / confirmation means). robots.txt already disallows /auth/.
 *
 * Suspense: the handler reads `?code` search params at runtime under
 * Next.js 16 Cache Components (same pattern as /login and /reset-password).
 */
export default function AuthLinkPage() {
  return (
    <section className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
      <div className="border-border-muted bg-surface rounded-xl border p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">Signing you in</h1>
        <p className="text-foreground-muted mt-1 text-sm">
          One moment — we&apos;re verifying your one-time link.
        </p>
        <Suspense
          fallback={
            <div className="text-foreground-muted mt-6 text-sm">Loading…</div>
          }
        >
          <AuthLinkHandler />
        </Suspense>
      </div>
    </section>
  );
}
