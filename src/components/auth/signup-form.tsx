"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Sign-up form (Phase 2 auth, FR-AUTH-001..003).
 *
 * - Username (3–24 chars, letters/numbers/underscore) is sent as signup
 *   metadata; the existing `handle_new_user()` trigger writes the profile.
 *   Duplicate usernames collide on the DB UNIQUE constraint — handled
 *   gracefully below with a privacy-safe message (never reveals whether an
 *   email exists; UI_UX_DESIGN.md §6.6).
 * - No role field exists anywhere: the DB CHECK + `trg_guard_profile_role`
 *   make client-side role injection impossible (SECURITY.md §8).
 * - Email confirmation is required: the response session is null until the
 *   owner clicks the emailed link (Supabase confirm-signup setting).
 */

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,24}$/;

interface FieldErrors {
  username?: string;
  email?: string;
  password?: string;
  confirm?: string;
}

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!USERNAME_PATTERN.test(username)) {
      errors.username =
        "3–24 characters; letters, numbers and underscores only.";
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      errors.email = "Enter a valid email address.";
    }
    if (password.length < 8) {
      errors.password = "Use at least 8 characters.";
    }
    if (password !== confirm) {
      errors.confirm = "Passwords don't match.";
    }
    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
          data: { username: username.trim() },
        },
      });

      if (signUpError) {
        // Privacy-safe: duplicate username (trigger UNIQUE violation) and
        // already-registered email produce the same class of message.
        setError(
          "We couldn't create the account — the username may already be taken, or the email may already be registered. Try a different username or sign in instead."
        );
        return;
      }

      if (data.session) {
        // Confirm-signup disabled case (not our config, but handled honestly).
        router.replace(nextPath?.startsWith("/") ? nextPath : "/dashboard");
        router.refresh();
        return;
      }
      // Expected path: confirmation email sent; no session until confirmed.
      setPendingConfirmation(true);
    } catch {
      setError("Unexpected error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (pendingConfirmation) {
    return (
      <div className="mt-6" aria-live="polite">
        <div className="bg-success/10 text-success rounded-md px-3 py-2 text-sm">
          <p className="font-semibold">Confirm your email</p>
          <p className="mt-1">
            We sent a confirmation link to <strong>{email.trim()}</strong>. Open
            it on this device to activate your account, then sign in.
          </p>
        </div>
        <Link
          href="/login?confirmed=1"
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
        <p role="alert" className="text-error bg-error/10 rounded-md px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
            aria-describedby="username-hint username-error"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-invalid={Boolean(fieldErrors.username)}
            className="border-border-muted focus:border-brand-600 mt-1 block w-full rounded-md border px-3 py-2 text-sm"
          />
          <p id="username-hint" className="text-foreground-muted mt-1 text-xs">
            3–24 characters; letters, numbers and underscores. This is your
            public handle.
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-border-muted focus:border-brand-600 mt-1 block w-full rounded-md border px-3 py-2 text-sm"
          />
          {fieldErrors.email && (
            <p className="text-error mt-1 text-xs">{fieldErrors.email}</p>
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
          {fieldErrors.password && (
            <p className="text-error mt-1 text-xs">{fieldErrors.password}</p>
          )}
        </div>
        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium">
            Confirm password
          </label>
          <input
            id="confirm-password"
            name="confirm-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            aria-invalid={Boolean(fieldErrors.confirm)}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="border-border-muted focus:border-brand-600 mt-1 block w-full rounded-md border px-3 py-2 text-sm"
          />
          {fieldErrors.confirm && (
            <p className="text-error mt-1 text-xs">{fieldErrors.confirm}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={busy}
          className="bg-brand-600 hover:bg-brand-700 w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60"
        >
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="text-foreground-muted text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-700 hover:text-brand-800 underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
