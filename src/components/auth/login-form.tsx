"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  PASSWORD_SIGN_IN_ERROR_MESSAGE,
  RESEND_CONFIRMATION_SENT_MESSAGE,
  isValidEmail,
  magicLinkErrorMessage,
  resendConfirmationErrorMessage,
} from "@/lib/auth/login-messages";

/**
 * Sign-in form (Phase 2 auth). Email + password per REQUIREMENTS (Google
 * OAuth explicitly deferred). Uses the existing browser Supabase client
 * (API_DOCUMENTATION.md §3.4 — auth is not a Server Action).
 *
 * Privacy standard (UI_UX_DESIGN.md §6.6): error messages never reveal
 * whether an email exists. A `?next=` param returns the user to the page
 * that sent them here (validated against same-origin relative paths only).
 *
 * Hardening (F1–F5, docs/PLANTAI_AUTH_MAGIC_LINK_PHASE3_REPORT.md):
 * - F1: `?error=link` (expired/invalid emailed link) is surfaced instead of
 *   landing silently.
 * - F2/F5: email-format validation on BOTH the password and magic-link
 *   submissions (a username typed into the field is rejected before any
 *   network call instead of becoming a generic GoTrue failure).
 * - F3: after a failed password sign-in, an existence-neutral
 *   "resend confirmation email" affordance (supabase.auth.resend, part of
 *   the already-used client — no new dependency).
 * - F4: after a failed password sign-in, the passwordless path is surfaced
 *   explicitly as the self-recovery route.
 * - F5: `shouldCreateUser: false` — the magic-link form is strictly a
 *   sign-in affordance; it can no longer implicitly create an unconfirmed
 *   account for an arbitrarily typed address. GoTrue's 429 email rate limit
 *   (built-in sender = 2 emails/hour, project-wide) gets an honest
 *   wait-and-retry message; all other OTP failures keep the generic,
 *   account-existence-neutral message.
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
  const [info, setInfo] = useState<string | null>(
    // Post-email-confirmation landing (auth/confirm redirects here).
    searchParams.get("confirmed") === "1"
      ? "Email confirmed — you can sign in now."
      : null
  );
  // F1: an emailed confirmation/recovery link that arrived expired, already
  // used, or tampered lands here as /login?error=link (auth/confirm route).
  // Same neutral wording as the forgot-password form.
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "link"
      ? "That sign-in or reset link is invalid or has expired. Request a new one below."
      : null
  );
  const [busy, setBusy] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  // F3/F4: true after a failed password attempt — unlocks the resend
  // confirmation affordance and the passwordless recovery hint.
  const [signInFailed, setSignInFailed] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    if (!isValidEmail(email.trim()) || password.length < 8) {
      setError("Enter a valid email address and an 8+ character password.");
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
        setError(PASSWORD_SIGN_IN_ERROR_MESSAGE);
        setSignInFailed(true); // F3/F4 recovery affordances
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
    if (!isValidEmail(email.trim())) {
      setError("Enter a valid email address to receive a sign-in link.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
          // F5: sign-in ONLY — never implicitly create an account for a
          // mistyped address (the login page is not a signup surface).
          shouldCreateUser: false,
        },
      });
      if (otpError) {
        // F5: 429 (project's hourly email budget spent) gets an honest
        // wait-and-retry message; every other failure — including GoTrue's
        // 422 for an unknown address — keeps the SAME existence-neutral
        // message (privacy standard).
        setError(magicLinkErrorMessage(otpError));
        return;
      }
      setMagicLinkSent(true);
      setInfo("Sign-in link sent — check your inbox.");
    } finally {
      setBusy(false);
    }
  }

  // F3: existence-neutral resend. Shows the SAME success line whether or
  // not the address has an account (forgot-password pattern); failures map
  // via resendConfirmationErrorMessage (rate-limit-aware, never leaking
  // account state).
  async function handleResendConfirmation() {
    setError(null);
    setInfo(null);
    if (!isValidEmail(email.trim())) {
      setError("Enter a valid email address to resend a confirmation email.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
      });
      if (resendError) {
        setError(resendConfirmationErrorMessage(resendError));
        return;
      }
      setResendSent(true);
      setInfo(RESEND_CONFIRMATION_SENT_MESSAGE);
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

      {/* F4: after a failed password sign-in, surface the passwordless
          path explicitly as the self-recovery route. */}
      {signInFailed && !magicLinkSent && (
        <p className="text-foreground-muted text-sm">
          Or sign in without a password — we can email you a one-time link
          instead:
        </p>
      )}
      <form onSubmit={handleMagicLink} noValidate>
        <button
          type="submit"
          disabled={busy}
          className="text-brand-700 hover:text-brand-800 w-full text-center text-sm font-medium underline disabled:opacity-60"
        >
          Email me a one-time sign-in link instead
        </button>
      </form>

      {/* F3: existence-neutral resend affordance. Only appears after a
          failed password sign-in (that is the one state where a pending
          confirmation is plausible); the success line is identical whether
          or not the address has an account. */}
      {signInFailed && !resendSent && (
        <div className="border-border-muted bg-surface-muted rounded-lg border p-4 text-sm">
          <p className="font-medium">Just signed up and still waiting on the confirmation email?</p>
          <p className="text-foreground-muted mt-1">
            We can send a fresh confirmation link to the address above.
          </p>
          <button
            type="button"
            onClick={handleResendConfirmation}
            disabled={busy}
            className="text-brand-700 hover:text-brand-800 mt-2 text-sm font-medium underline disabled:opacity-60"
          >
            {busy ? "Sending…" : "Resend confirmation email"}
          </button>
        </div>
      )}

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
