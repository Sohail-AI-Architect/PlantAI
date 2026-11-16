import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

/*
 * /login — Phase 2 auth (roadmap task 2.5, FR-AUTH-*). Minimal centered
 * card per UI_UX_DESIGN.md §6.6. Server wrapper: the interactive form is a
 * client component using the existing browser Supabase client
 * (API_DOCUMENTATION.md §3.4 — auth is NOT a Server Action by design).
 * Suspense: LoginForm reads `?next`/`?confirmed` search params (runtime
 * data under Cache Components — Next.js 16).
 */
export default function LoginPage() {
  return (
    <section className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
      <div className="border-border-muted bg-surface rounded-xl border p-6 shadow-sm sm:p-8">
        <p
          aria-hidden="true"
          className="bg-brand-600 mx-auto mb-4 h-10 w-10 rounded-full"
        />
        <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="text-foreground-muted mt-1 text-sm">
          Welcome back — sign in to save plants and get more identifications.
        </p>
        <Suspense fallback={<div className="text-foreground-muted mt-6 text-sm">Loading sign-in…</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </section>
  );
}
