import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

/*
 * /login — single Google OAuth entry point. Server wrapper keeps the existing
 * botanical card; the client component starts Supabase's official PKCE flow
 * (auth is NOT a Server Action by design). Suspense: it reads runtime
 * `?next`/status search params under Next.js 16 Cache Components.
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
          Continue with Google to save plants and get more identifications.
        </p>
        <Suspense fallback={<div className="text-foreground-muted mt-6 text-sm">Loading sign-in…</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </section>
  );
}
