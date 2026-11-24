"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  authLinkRedirectUrl,
  safeAuthPath,
  signUpErrorMessage,
  validateSignupFields,
  withAuthNext,
  type SignupFieldErrors,
} from "@/lib/auth/auth-contracts";
import { useSubmitGate } from "@/lib/auth/use-submit-gate";

/**
 * Create-account form (FR-AUTH-001..003).
 *
 * Username, email, password and confirmation are validated before any
 * network call. Account creation is reported as successful ONLY when
 * Supabase returns success; the expected confirmation-required response
 * says exactly what the user must do next. Duplicate email and username
 * conflicts share one privacy-safe message. The temporary one-click
 * anonymous sign-in feature is not part of this flow.
 */
export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeAuthPath(searchParams.get("next"));

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const { busy, begin, finish } = useSubmitGate();

  function clearField(field: keyof SignupFieldErrors): void {
    setFieldErrors((previous) =>
      previous[field] ? { ...previous, [field]: undefined } : previous
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!begin()) return;
    setError(null);

    const errors = validateSignupFields({ username, email, password, confirm });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      finish();
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // The browser client is PKCE by default; the emailed link must be
          // exchanged by this browser on /auth/link. `next` is carried so
          // "sign up to save this plant" returns to the right page.
          emailRedirectTo: authLinkRedirectUrl(
            window.location.origin,
            nextPath
          ),
          data: { username: username.trim() },
        },
      });

      if (signUpError) {
        setError(signUpErrorMessage(signUpError));
        return;
      }

      if (data.session) {
        // Confirmation-disabled projects: Supabase explicitly returned a
        // session, so this is a real successful sign-up.
        router.replace(nextPath);
        router.refresh();
        return;
      }

      // Expected path: confirmation email sent; no session until confirmed.
      setPendingConfirmation(true);
    } catch (signUpException) {
      setError(signUpErrorMessage(signUpException));
    } finally {
      finish();
    }
  }

  if (pendingConfirmation) {
    return (
      <div className="mt-6" aria-live="polite">
        <div className="bg-success/10 text-success rounded-md px-3 py-2 text-sm">
          <p className="font-semibold">Confirm your email</p>
          <p className="mt-1">
            We sent a confirmation link to <strong>{email.trim()}</strong>.
            Open it on this device to activate your account — you&apos;ll be
            signed in automatically.
          </p>
        </div>
        <Link
          href={withAuthNext("/login?confirmed=1", nextPath)}
          className="text-brand-700 mt-4 inline-block text-sm font-medium underline"
        >
          I&apos;ve confirmed — go to sign in →
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
          <label htmlFor="username" className="block text-sm font-medium">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            minLength={3}
            maxLength={24}
            aria-describedby={
              fieldErrors.username ? "username-hint username-error" : "username-hint"
            }
            aria-invalid={Boolean(fieldErrors.username)}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              clearField("username");
            }}
            className="border-border-muted focus:border-brand-600 mt-1 block w-full rounded-md border px-3 py-2 text-sm"
          />
          <p id="username-hint" className="text-foreground-muted mt-1 text-xs">
            3–24 characters; letters, numbers and underscores. This is the
            name shown in the navigation bar.
          </p>
          {fieldErrors.username && (
            <p id="username-error" className="text-error mt-1 text-xs">
              {fieldErrors.username}
            </p>
          )}
        </div>

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
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "signup-email-error" : undefined}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearField("email");
            }}
            className="border-border-muted focus:border-brand-600 mt-1 block w-full rounded-md border px-3 py-2 text-sm"
          />
          {fieldErrors.email && (
            <p id="signup-email-error" className="text-error mt-1 text-xs">
              {fieldErrors.email}
            </p>
          )}
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
              autoComplete="new-password"
              required
              minLength={8}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                fieldErrors.password ? "signup-password-error" : undefined
              }
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearField("password");
              }}
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
          {fieldErrors.password && (
            <p id="signup-password-error" className="text-error mt-1 text-xs">
              {fieldErrors.password}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium">
            Confirm password
          </label>
          <div className="relative">
            <input
              id="confirm-password"
              name="confirm-password"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              aria-invalid={Boolean(fieldErrors.confirm)}
              aria-describedby={
                fieldErrors.confirm ? "confirm-password-error" : undefined
              }
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                clearField("confirm");
              }}
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
              aria-controls="confirm-password"
              className="text-foreground-muted absolute inset-y-0 right-2 mt-1 flex items-center text-xs font-medium"
            >
              {showConfirm ? "Hide" : "Show"}
            </button>
          </div>
          {fieldErrors.confirm && (
            <p id="confirm-password-error" className="text-error mt-1 text-xs">
              {fieldErrors.confirm}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={busy}
          aria-busy={busy}
          className="bg-brand-600 hover:bg-brand-700 w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60"
        >
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="text-foreground-muted text-center text-sm">
        Already have an account?{" "}
        <Link
          href={withAuthNext("/login", nextPath)}
          className="text-brand-700 hover:text-brand-800 underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
