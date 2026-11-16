import { Suspense } from "react";
import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

/*
 * /forgot-password — Phase 2 auth (FR-AUTH-006). Sends a Supabase recovery
 * email pointing at /auth/confirm?type=recovery. Suspense: the form reads
 * search params (Cache Components — Next.js 16).
 */
export default function ForgotPasswordPage() {
  return (
    <section className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
      <div className="border-border-muted bg-surface rounded-xl border p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
        <p className="text-foreground-muted mt-1 text-sm">
          Enter your account email and we&apos;ll send a one-time reset link.
        </p>
        <Suspense fallback={<div className="text-foreground-muted mt-6 text-sm">Loading…</div>}>
          <ForgotPasswordForm />
        </Suspense>
      </div>
    </section>
  );
}
