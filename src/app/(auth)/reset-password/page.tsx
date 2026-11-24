import { Suspense } from "react";
import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Sign in with Google",
  robots: { index: false, follow: false },
};

/*
 * /reset-password — retired password flow. Redirects to Google sign-in with a
 * validated `?next=` and a clear obsolete-flow notice. Kept bookmark-safe;
 * Suspense covers runtime search params (Next.js 16 Cache Components).
 */
export default function ResetPasswordPage() {
  return (
    <section className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
      <div className="border-border-muted bg-surface rounded-xl border p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">Google sign-in</h1>
        <p className="text-foreground-muted mt-1 text-sm">
          Password reset is obsolete — continue with Google instead.
        </p>
        <Suspense fallback={<div className="text-foreground-muted mt-6 text-sm">Loading…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </section>
  );
}
