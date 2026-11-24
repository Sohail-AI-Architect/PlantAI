"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  SIGN_OUT_ERROR_MESSAGE,
  canUpdatePassword,
  isVerifiedRecoveryCodeExchange,
  isVerifiedRecoveryOtp,
  passwordUpdateErrorMessage,
  safeAuthPath,
  withAuthNext,
  type ResetLinkState,
} from "@/lib/auth/auth-contracts";
import { clearBrowserSession } from "@/lib/auth/session-cleanup";
import { useSubmitGate } from "@/lib/auth/use-submit-gate";
import { recoveryLinkErrorMessage } from "@/lib/auth/login-messages";

/**
 * Set-a-new-password form (FR-AUTH-006).
 *
 * Two safe entry paths establish a VERIFIED recovery authorization before
 * this form is usable:
 * 1. PKCE link → `exchangeCodeForSession()` returns the SDK's
 *    `redirectType: "recovery"` marker (stored by `resetPasswordForEmail()`);
 * 2. token_hash link → this browser calls `verifyOtp({ type: "recovery" })`
 *    and only a successful Supabase response unlocks the form.
 *
 * A direct visit with neither signal — including an already signed-in user —
 * shows the same neutral invalid-link state. After a successful update we
 * clear the local session before landing on guest-only /login, so the
 * "password updated — sign in with your new password" message is actually
 * visible instead of being bounced straight to /dashboard.
 */

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeAuthPath(searchParams.get("next"));
  const redirectPath = withAuthNext("/reset-password", nextPath);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkState, setLinkState] = useState<ResetLinkState>("verifying");
  const linkCheckedRef = useRef(false);
  const { busy, begin, finish } = useSubmitGate();

  useEffect(() => {
    if (linkCheckedRef.current) return;
    linkCheckedRef.current = true;

    const code = searchParams.get("code");
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type");
    let cancelled = false;

    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      // Keep the failure state update out of the effect body (React 19 lint).
      queueMicrotask(() => {
        if (!cancelled) setLinkState("failed");
      });
      return () => {
        cancelled = true;
      };
    }

    const removeSensitiveParams = () => {
      // One-time recovery params must not stay in the address bar/shareable
      // history. Remove them only after the exchange/verification settles.
      window.history.replaceState(null, "", redirectPath);
    };

    if (code) {
      // PKCE recovery: the verifier was stored by resetPasswordForEmail().
      // Supabase returns redirectType "recovery" for that verifier; any other
      // result (including an ordinary sign-in code) must not unlock password
      // update.
      void supabase.auth
        .exchangeCodeForSession(code)
        .then((result) => {
          if (cancelled) return;
          removeSensitiveParams();
          setLinkState(isVerifiedRecoveryCodeExchange(result) ? "ready" : "failed");
        })
        .catch(() => {
          if (cancelled) return;
          removeSensitiveParams();
          setLinkState("failed");
        });
      return () => {
        cancelled = true;
      };
    }

    if (tokenHash && type === "recovery") {
      // token_hash recovery: verifyOtp must succeed for the recovery type.
      // A failure, expired token, or non-recovery type never enables the form.
      void supabase.auth
        .verifyOtp({ type: "recovery", token_hash: tokenHash })
        .then((result) => {
          if (cancelled) return;
          removeSensitiveParams();
          setLinkState(isVerifiedRecoveryOtp("recovery", result) ? "ready" : "failed");
        })
        .catch(() => {
          if (cancelled) return;
          removeSensitiveParams();
          setLinkState("failed");
        });
      return () => {
        cancelled = true;
      };
    }

    // No recovery code or recovery token_hash: an ordinary signed-in session is
    // intentionally NOT enough. This prevents a normal dashboard session from
    // being repurposed into a password-reset flow by direct navigation.
    queueMicrotask(() => {
      if (!cancelled) setLinkState("failed");
    });
    return () => {
      cancelled = true;
    };
  }, [redirectPath, searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Disabled buttons are a UI hint only; the handler must reject any submit
    // that arrives while the recovery link is not verified/ready.
    if (!canUpdatePassword(linkState)) {
      setError(recoveryLinkErrorMessage());
      return;
    }
    if (!begin()) return;
    setError(null);

    if (password.length < 8) {
      setError("Use at least 8 characters.");
      finish();
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      finish();
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) {
        setError(passwordUpdateErrorMessage(updateError));
        return;
      }

      // Guest-only /login would bounce an active recovery session to the
      // dashboard and hide the success message. Clear local cookies first;
      // global revocation is best-effort with a guaranteed local fallback.
      const cleanup = await clearBrowserSession(supabase);
      if (!cleanup.ok) {
        setError(SIGN_OUT_ERROR_MESSAGE);
        return;
      }

      router.replace(withAuthNext("/login?reset=1", nextPath));
      router.refresh();
    } catch (updateException) {
      setError(passwordUpdateErrorMessage(updateException));
    } finally {
      finish();
    }
  }

  if (linkState === "verifying") {
    return (
      <div className="mt-6" aria-live="polite">
        <p className="text-foreground-muted text-sm">
          Checking your reset link…
        </p>
      </div>
    );
  }

  if (linkState === "failed") {
    return (
      <div className="mt-6" aria-live="polite">
        <p
          role="alert"
          className="text-error bg-error/10 rounded-md px-3 py-2 text-sm"
        >
          {recoveryLinkErrorMessage()}
        </p>
        <Link
          href={withAuthNext("/forgot-password", nextPath)}
          className="text-brand-700 mt-4 inline-block text-sm font-medium underline"
        >
          Request a new reset email →
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
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
          <label htmlFor="new-password" className="block text-sm font-medium">
            New password
          </label>
          <div className="relative">
            <input
              id="new-password"
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
              aria-label={showPassword ? "Hide new password" : "Show new password"}
              aria-pressed={showPassword}
              aria-controls="new-password"
              className="text-foreground-muted absolute inset-y-0 right-2 mt-1 flex items-center text-xs font-medium"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <div>
          <label
            htmlFor="confirm-new-password"
            className="block text-sm font-medium"
          >
            Confirm new password
          </label>
          <div className="relative">
            <input
              id="confirm-new-password"
              name="confirm-password"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="border-border-muted focus:border-brand-600 mt-1 block w-full rounded-md border px-3 py-2 pr-16 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={
                showConfirm
                  ? "Hide confirmation password"
                  : "Show confirmation password"
              }
              aria-pressed={showConfirm}
              aria-controls="confirm-new-password"
              className="text-foreground-muted absolute inset-y-0 right-2 mt-1 flex items-center text-xs font-medium"
            >
              {showConfirm ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={busy || !canUpdatePassword(linkState)}
          aria-busy={busy}
          className="bg-brand-600 hover:bg-brand-700 w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60"
        >
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
      <p className="text-foreground-muted text-center text-sm">
        Need a new link?{" "}
        <Link
          href={withAuthNext("/forgot-password", nextPath)}
          className="text-brand-700 hover:text-brand-800 underline"
        >
          Forgot password
        </Link>
      </p>
    </div>
  );
}
