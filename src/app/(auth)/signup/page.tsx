import { Suspense } from "react";
import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};

/*
 * /signup — Phase 2 auth (roadmap task 2.5). Username metadata feeds the
 * existing `handle_new_user()` trigger (DATABASE_SCHEMA.md §3.1/§5.2) — no
 * profile write from app code, and no role can ever be set from the client.
 * Suspense: SignupForm reads search params (Cache Components — Next.js 16).
 */
export default function SignupPage() {
  return (
    <section className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
      <div className="border-border-muted bg-surface rounded-xl border p-6 shadow-sm sm:p-8">
        <p
          aria-hidden="true"
          className="bg-brand-600 mx-auto mb-4 h-10 w-10 rounded-full"
        />
        <h1 className="text-2xl font-bold tracking-tight">Create an account</h1>
        <p className="text-foreground-muted mt-1 text-sm">
          Free forever — confirm your email to activate the account.
        </p>
        <Suspense fallback={<div className="text-foreground-muted mt-6 text-sm">Loading sign-up…</div>}>
          <SignupForm />
        </Suspense>
      </div>
    </section>
  );
}
