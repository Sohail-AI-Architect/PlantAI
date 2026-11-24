import { Suspense } from "react";
import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Sign in with Google",
  robots: { index: false, follow: false },
};

/*
 * /forgot-password — retired password flow. Redirects to the Google sign-in
 * experience with a validated `?next=`; kept as a bookmark-safe route.
 * Suspense: the redirect component reads runtime search params (Next.js 16).
 */
export default function ForgotPasswordPage() {
  return (
    <section className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
      <div className="border-border-muted bg-surface rounded-xl border p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">Google sign-in</h1>
        <p className="text-foreground-muted mt-1 text-sm">
          Password reset is obsolete — continue with Google instead.
        </p>
        <Suspense fallback={<div className="text-foreground-muted mt-6 text-sm">Loading…</div>}>
          <ForgotPasswordForm />
        </Suspense>
      </div>
    </section>
  );
}
