"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  PASSWORD_UPDATED_MESSAGE,
  RESEND_CONFIRMATION_SENT_MESSAGE,
  isValidEmail,
  magicLinkErrorMessage,
  passwordSignInErrorMessage,
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
 * - F6/F7 (Phase 4 root-cause report): the PASSWORD path now also handles
 *   the endpoint throttle (429 `over_request_rate_limit`) honestly, and the
 *   resend success line states GoTrue's designed no-op for
 *   already-confirmed addresses truthfully (no email is sent for those —
 *   proven from supabase/auth internal/api/resend.go), so "no email
 *   arrived" is no longer misread as a failure.
 * - F8 (Phase 5 recovery-callback report): PASSWORD RECOVERY now uses the
 *   correct PKCE flow end-to-end — the reset link goes directly to
 *   /reset-password, which exchanges the one-time `?code=` CLIENT-SIDE
 *   (the code_verifier lives in this browser's storage, so no server-side
 *   exchange is possible), then the password update runs on the recovery
 *   session and lands on /login?reset=1. The token_hash callback route
 *   (/auth/confirm) is untouched for sign-up confirmations.
 * - F9 (Phase 6 report): MAGIC LINK and RESEND-CONFIRMATION emails now land
 *   on /auth/link, a client-capable page that exchanges the PKCE `?code=`
 *   exactly once (same structural reason as F8: the code_verifier lives in
 *   this browser). Pointing `emailRedirectTo` at /auth/confirm could never
 *   work for PKCE links — that route only understands token_hash.
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
    searchParams.get("reset") === "1"
      ? // F8: post-password-reset landing (reset-password form redirects
        // here only after a SUCCESSFUL update).
        PASSWORD_UPDATED_MESSAGE
      : searchParams.get("confirmed") === "1"
        ? // Post-email-confirmation landing (auth/confirm redirects here).
          "Email confirmed — you can sign in now."
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
        // Deliberately vague for credential failures (privacy standard):
        // invalid credentials vs unconfirmed email are indistinguishable to
        // the caller. F6: the endpoint throttle (429) gets an honest
        // wait-and-retry message instead of misleading credential advice.
        setError(passwordSignInErrorMessage(signInError));
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
          // F9: the emailed PKCE link is `{redirectTo}?code=…`; only the
          // browser that requested it holds the code_verifier, so it must
          // land on the client-side exchange page (/auth/link), never the
          // token_hash-only /auth/confirm route.
          emailRedirectTo: `${window.location.origin}/auth/link`,
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
        // F9: `resend` also sends a PKCE code_challenge under the ssr
        // client's default flow, so its link needs the client-side
        // exchange page too (verified in @supabase/auth-js GoTrueClient).
        options: { emailRedirectTo: `${window.location.origin}/auth/link` },
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

  // 1-click demo: Supabase anonymous sign-in creates a real, RLS-bounded
  // session with no email/password, so reviewers can test the logged-in
  // features immediately. The username metadata satisfies the profile
  // trigger (which requires a non-null username).
  async function handleDemoSignIn() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const suffix = (
        globalThis.crypto?.randomUUID?.() ?? String(Date.now())
      )
        .replace(/-/g, "")
        .slice(0, 8);
      const { error: demoError } = await supabase.auth.signInAnonymously({
        options: {
          data: { username: `demo_${suffix}`, full_name: "Demo Guest" },
        },
      });
      if (demoError) {
        setError(
          "Demo sign-in is unavailable right now. Please create a free account instead."
        );
        return;
      }
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Unexpected error — demo sign-in failed. Please try again.");
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

      <div className="border-border-muted bg-surface-muted rounded-lg border p-4">
        <p className="text-sm font-semibold">Just exploring PlantAI?</p>
        <p className="text-foreground-muted mt-1 text-sm leading-relaxed">
          Open a temporary demo session instantly — no email, password or
          signup needed. It works for the signed-in features and clears when
          you sign out.
        </p>
        <button
          type="button"
          onClick={handleDemoSignIn}
          disabled={busy}
          className="border-brand-600 text-brand-700 hover:bg-brand-50 mt-3 w-full rounded-md border bg-white px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {busy ? "Opening demo…" : "Try Demo Account"}
        </button>
      </div>

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="bg-border-muted h-px flex-1" />
        <span className="text-foreground-muted text-xs font-medium uppercase tracking-wide">
          or sign in
        </span>
        <span className="bg-border-muted h-px flex-1" />
      </div>

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
