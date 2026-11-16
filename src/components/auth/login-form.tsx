"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Sign-in form (Phase 2 auth). Email + password per REQUIREMENTS (Google
 * OAuth explicitly deferred). Uses the existing browser Supabase client
 * (API_DOCUMENTATION.md §3.4 — auth is not a Server Action).
 *
 * Privacy standard (UI_UX_DESIGN.md §6.6): error messages never reveal
 * whether an email exists. A `?next=` param returns the user to the page
 * that sent them here (validated against same-origin relative paths only).
 */

function safeNextPath(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(
    // Post-email-confirmation landing (auth/confirm redirects here).
    searchParams.get("confirmed") === "1"
      ? "Email confirmed — you can sign in now."
      : null
  );
  const [busy, setBusy] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim() || password.length < 8) {
      setError("Enter your email and an 8+ character password.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        // Deliberately vague (privacy standard): invalid credentials vs
        // unconfirmed email are indistinguishable to the caller.
        setError(
          "Couldn't sign in. Check your email and password — if you just signed up, confirm your email first (the link may be in your inbox)."
        );
        return;
      }
      // Full navigation so the proxy + server components see the new session.
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Unexpected error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError("Enter your email to receive a sign-in link.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
      });
      if (otpError) {
        setError("Couldn't send a sign-in link — check the address and try again.");
        return;
      }
      setMagicLinkSent(true);
      setInfo("Sign-in link sent — check your inbox.");
    } finally {
      setBusy(false);
    }
  }

  if (magicLinkSent) {
    return (
      <div className="mt-6" aria-live="polite">
        <p className="text-success text-sm">
          A one-time sign-in link is on its way. Open it on this device to sign in.
        </p>
        <Link href="/identify" className="text-brand-700 mt-4 inline-block text-sm font-medium underline">
          Continue without signing in →
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {info && (
        <p role="status" className="text-success bg-success/10 rounded-md px-3 py-2 text-sm">
          {info}
        </p>
      )}
      {error && (
        <p role="alert" className="text-error bg-error/10 rounded-md px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-border-muted focus:border-brand-600 mt-1 block w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-border-muted focus:border-brand-600 mt-1 block w-full rounded-md border px-3 py-2 pr-16 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-foreground-muted absolute inset-y-0 right-2 mt-1 flex items-center text-xs font-medium"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-600 w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <form onSubmit={handleMagicLink} noValidate>
        <button
          type="submit"
          disabled={busy}
          className="text-brand-700 hover:text-brand-800 w-full text-center text-sm font-medium underline disabled:opacity-60"
        >
          Email me a one-time sign-in link instead
        </button>
      </form>

      <div className="text-foreground-muted flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="hover:text-foreground underline">
          Forgot password?
        </Link>
        <Link href="/signup" className="hover:text-foreground underline">
          Create account
        </Link>
      </div>
    </div>
  );
}
