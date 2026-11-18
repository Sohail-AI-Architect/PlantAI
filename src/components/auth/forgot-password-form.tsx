"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Forgot-password form (FR-AUTH-006). Always shows the same neutral success
 * message whether or not the email exists (privacy standard — UI_UX_DESIGN
 * §6.6: never reveal account existence).
 *
 * F8 (Phase 5): the reset email's redirect target is the /reset-password
 * PAGE itself. The browser Supabase client uses the PKCE auth flow
 * (@supabase/ssr default), so GoTrue turns the emailed link into
 * `{redirectTo}?code=…`, and the one-time code can ONLY be exchanged by the
 * browser client that holds the matching code_verifier (stored locally at
 * request time). Pointing redirectTo at /auth/confirm was therefore broken:
 * that Route Handler only understands token_hash links, so every recovery
 * click bounced to /login?error=link (the exact production incident). The
 * token_hash-style callback remains in /auth/confirm for sign-up links.
 */
export function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "link"
      ? "That sign-in or reset link is invalid or has expired. Request a new one below."
      : null
  );
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        // F8: link lands DIRECTLY on the reset-password page, where the
        // PKCE one-time `?code=` is exchanged client-side (the code
        // verifier lives in THIS browser's storage). Never /auth/confirm —
        // that route only handles token_hash-style links.
        { redirectTo: `${window.location.origin}/reset-password` }
      );
      if (resetError) {
        setError("Couldn't send the reset email — check the address and try again.");
        return;
      }
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-6" aria-live="polite">
        <div className="bg-success/10 text-success rounded-md px-3 py-2 text-sm">
          <p className="font-semibold">Check your inbox</p>
          <p className="mt-1">
            If an account exists for <strong>{email.trim()}</strong>, a password
            reset link is on its way. The link works once and expires after a
            short time.
          </p>
        </div>
        <Link href="/login" className="text-brand-700 mt-4 inline-block text-sm font-medium underline">
          Back to sign in →
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
        <button
          type="submit"
          disabled={busy}
          className="bg-brand-600 hover:bg-brand-700 w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="text-foreground-muted text-center text-sm">
        Remembered it?{" "}
        <Link href="/login" className="text-brand-700 hover:text-brand-800 underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
