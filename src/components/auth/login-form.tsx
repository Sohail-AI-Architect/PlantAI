"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  authLinkRedirectUrl,
  buildPasswordSignInPayload,
  normalizeAuthEmail,
  safeAuthPath,
  withAuthNext,
} from "@/lib/auth/auth-contracts";
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
 * OAuth explicitly deferred). Uses the existing browser Supabase client so
 * the SSR cookies and PKCE flows stay under Supabase's control.
 *
 * User-facing behavior:
 * - password, one-time link and resend actions each have their own pending
 *   label; a ref guard drops duplicate submissions before React re-renders;
 * - all failures use existence-neutral wording (no account-state leaks),
 *   with honest wait guidance for rate limits;
 * - `?next=` is validated as a same-origin path and carried through emailed
 *   links so "sign in to save this plant" returns to the right page;
 * - the normalized email is the only account identity; no display name is
 *   accepted, and browser password managers see it as the username;
 * - the temporary one-click anonymous sign-in flow has been removed — every
 *   session is a normal Supabase email/password or magic-link session.
 */

type PendingAction = "password" | "magic" | "resend" | null;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeAuthPath(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const pendingRef = useRef<PendingAction>(null);
  const busy = pendingAction !== null;

  const [info, setInfo] = useState<string | null>(
    searchParams.get("reset") === "1"
      ? // Post-password-reset landing: set only after a successful update.
        PASSWORD_UPDATED_MESSAGE
      : searchParams.get("confirmed") === "1"
        ? "Email confirmed — sign in below to continue."
        : null
  );
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "link"
      ? "That sign-in or reset link is invalid or has expired. Request a new one below."
      : null
  );
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [signInFailed, setSignInFailed] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  function begin(action: Exclude<PendingAction, null>): boolean {
    if (pendingRef.current) return false;
    pendingRef.current = action;
    setPendingAction(action);
    return true;
  }

  function finish(): void {
    pendingRef.current = null;
    setPendingAction(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!begin("password")) return;
    setError(null);
    setInfo(null);

    const normalizedEmail = normalizeAuthEmail(email);
    if (!isValidEmail(normalizedEmail) || password.length < 8) {
      setError("Enter a valid email address and an 8+ character password.");
      finish();
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword(
        buildPasswordSignInPayload({ email: normalizedEmail, password })
      );
      if (signInError) {
        // Deliberately vague for credential failures: wrong password,
        // unknown address and unconfirmed email are indistinguishable.
        setError(passwordSignInErrorMessage(signInError));
        setSignInFailed(true);
        return;
      }
      // Full navigation so the proxy + server components see the new session.
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("We couldn't sign you in right now. Please try again.");
    } finally {
      finish();
    }
  }

  async function handleMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!begin("magic")) return;
    setError(null);
    setInfo(null);

    const normalizedEmail = normalizeAuthEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address to receive a sign-in link.");
      finish();
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          // The PKCE code_verifier lives in this browser, so the emailed link
          // must land on the client-side exchange page, never /auth/confirm.
          emailRedirectTo: authLinkRedirectUrl(
            window.location.origin,
            nextPath
          ),
          // Login never creates an account for a mistyped address.
          shouldCreateUser: false,
        },
      });
      if (otpError) {
        setError(magicLinkErrorMessage(otpError));
        return;
      }
      setMagicLinkSent(true);
      setInfo("Sign-in link sent — check your inbox.");
    } catch {
      setError(magicLinkErrorMessage(null));
    } finally {
      finish();
    }
  }

  async function handleResendConfirmation() {
    if (!begin("resend")) return;
    setError(null);
    setInfo(null);

    const normalizedEmail = normalizeAuthEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address to resend a confirmation email.");
      finish();
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
        options: {
          emailRedirectTo: authLinkRedirectUrl(
            window.location.origin,
            nextPath
          ),
        },
      });
      if (resendError) {
        setError(resendConfirmationErrorMessage(resendError));
        return;
      }
      setResendSent(true);
      setInfo(RESEND_CONFIRMATION_SENT_MESSAGE);
    } catch {
      setError(resendConfirmationErrorMessage(null));
    } finally {
      finish();
    }
  }

  if (magicLinkSent) {
    return (
      <div className="mt-6" aria-live="polite">
        <p className="text-success text-sm">
          A one-time sign-in link is on its way. Open it on this device to sign
          in.
        </p>
        <Link
          href="/identify"
          className="text-brand-700 mt-4 inline-block text-sm font-medium underline"
        >
          Continue without signing in →
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {info && (
        <p
          role="status"
          className="text-success bg-success/10 rounded-md px-3 py-2 text-sm"
        >
          {info}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="text-error bg-error/10 rounded-md px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        noValidate
        aria-busy={busy}
        className="space-y-4"
      >
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          {/* Email is the authentication username for browser password managers. */}
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
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
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              aria-controls="password"
              className="text-foreground-muted absolute inset-y-0 right-2 mt-1 flex items-center text-xs font-medium"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={busy}
          aria-busy={pendingAction === "password"}
          className="bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-600 w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60"
        >
          {pendingAction === "password" ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {signInFailed && !magicLinkSent && (
        <p className="text-foreground-muted text-sm">
          Or sign in without a password — we can email you a one-time link
          instead:
        </p>
      )}
      <form onSubmit={handleMagicLink} noValidate aria-busy={busy}>
        <button
          type="submit"
          disabled={busy}
          aria-busy={pendingAction === "magic"}
          className="text-brand-700 hover:text-brand-800 w-full text-center text-sm font-medium underline disabled:opacity-60"
        >
          {pendingAction === "magic"
            ? "Sending link…"
            : "Email me a one-time sign-in link instead"}
        </button>
      </form>

      {signInFailed && !resendSent && (
        <div className="border-border-muted bg-surface-muted rounded-lg border p-4 text-sm">
          <p className="font-medium">
            Did your sign-up email still need confirming?
          </p>
          <p className="text-foreground-muted mt-1">
            We can send a fresh confirmation link to the address above. If your
            account is already confirmed, use Forgot password below instead.
          </p>
          <button
            type="button"
            onClick={handleResendConfirmation}
            disabled={busy}
            aria-busy={pendingAction === "resend"}
            className="text-brand-700 hover:text-brand-800 mt-2 text-sm font-medium underline disabled:opacity-60"
          >
            {pendingAction === "resend"
              ? "Sending…"
              : "Resend confirmation email"}
          </button>
        </div>
      )}

      <div className="text-foreground-muted flex items-center justify-between text-sm">
        <Link
          href={withAuthNext("/forgot-password", nextPath)}
          className="hover:text-foreground underline"
        >
          Forgot password?
        </Link>
        <Link
          href={withAuthNext("/signup", nextPath)}
          className="hover:text-foreground underline"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}
