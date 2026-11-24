import { Suspense } from "react";
import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};

/*
 * /signup — same verified Supabase Google OAuth flow as /login. Supabase Auth
 * creates the UUID user and the existing profile trigger creates the profile;
 * no role or identity data is set by the client. Suspense: the form reads
 * runtime search params (Cache Components — Next.js 16).
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
          Free forever — your first Google sign-in creates the account.
        </p>
        <Suspense fallback={<div className="text-foreground-muted mt-6 text-sm">Loading sign-up…</div>}>
          <SignupForm />
        </Suspense>
      </div>
    </section>
  );
}
