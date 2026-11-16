"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Forgot-password form (FR-AUTH-006). Always shows the same neutral success
 * message whether or not the email exists (privacy standard — UI_UX_DESIGN
 * §6.6: never reveal account existence).
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
        { redirectTo: `${window.location.origin}/auth/confirm?type=recovery` }
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
