"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { recoveryLinkErrorMessage } from "@/lib/auth/login-messages";

/**
 * New-password form (FR-AUTH-006, hardened by F8 — Phase 5 report).
 *
 * Two safe paths reach this page with a recovery session:
 * 1. token_hash link → /auth/confirm verifies server-side → session cookie
 *    already established when this form mounts.
 * 2. PKCE link (the live flow: the browser Supabase client is PKCE by
 *    default, so GoTrue's emailed link is `{redirectTo}?code=…`) → the
 *    one-time code is exchanged HERE, client-side, because the matching
 *    code_verifier lives in THIS browser's local storage. A server route
 *    cannot perform this exchange — pointing the email at /auth/confirm
 *    was the production bug (every recovery click bounced to
 *    /login?error=link).
 *
 * The exchange runs exactly once (ref-guarded against re-mounts); the
 * `?code=` value is stripped from the URL afterwards so a consumed code is
 * never re-submitted or left in a shareable address bar. Invalid, expired,
 * and already-used codes all show the SAME neutral message —
 * indistinguishable by design (privacy standard) — with a link to request
 * a fresh reset email. The password update itself still runs on the
 * recovery session via `updateUser`.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // null = no ?code= in the URL (token_hash path — form shows immediately);
  // "verifying" | "ready" | "failed" = PKCE link state machine.
  const [linkState, setLinkState] = useState<"verifying" | "ready" | "failed">(
    () => (searchParams.get("code") ? "verifying" : "ready")
  );
  const exchangedRef = useRef(false);

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code || exchangedRef.current) return;
    exchangedRef.current = true;

    // Strip the one-time code from the address bar immediately: it can only
    // be used once, and a leftover ?code= is both useless and shareable.
    window.history.replaceState(null, "", "/reset-password");

    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    void supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (cancelled) return;
        setLinkState(error ? "failed" : "ready");
      })
      .catch(() => {
        if (cancelled) return;
        setLinkState("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(
          "The reset link may have expired. Request a fresh one from the forgot-password page."
        );
        return;
      }
      // F8: clear success landing — the previous ?confirmed=1 told a
      // password-reset user "Email confirmed" (off-label).
      router.replace("/login?reset=1");
      router.refresh();
    } catch {
      setError("Unexpected error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (linkState === "verifying") {
    return (
      <div className="mt-6" aria-live="polite">
        <p className="text-foreground-muted text-sm">Verifying your reset link…</p>
      </div>
    );
  }

  if (linkState === "failed") {
    return (
      <div className="mt-6" aria-live="polite">
        <p role="alert" className="text-error bg-error/10 rounded-md px-3 py-2 text-sm">
          {recoveryLinkErrorMessage()}
        </p>
        <Link href="/forgot-password" className="text-brand-700 mt-4 inline-block text-sm font-medium underline">
          Request a new reset email →
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {error && (
        <p role="alert" className="text-error bg-error/10 rounded-md px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            New password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
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
        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            name="confirm-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="border-border-muted focus:border-brand-600 mt-1 block w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="bg-brand-600 hover:bg-brand-700 w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60"
        >
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
      <p className="text-foreground-muted text-center text-sm">
        Need a new link?{" "}
        <Link href="/forgot-password" className="text-brand-700 hover:text-brand-800 underline">
          Forgot password
        </Link>
      </p>
    </div>
  );
}
