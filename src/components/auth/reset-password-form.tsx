"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * New-password form (FR-AUTH-006). Calls `updateUser` with the existing
 * browser client — requires the session established by /auth/confirm.
 * If the session is missing (expired/unused link), Supabase returns an
 * auth error and we point the user back to the reset request form.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      router.replace("/login?confirmed=1");
      router.refresh();
    } catch {
      setError("Unexpected error — please try again.");
    } finally {
      setBusy(false);
    }
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
