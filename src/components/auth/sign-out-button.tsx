"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { SIGN_OUT_ERROR_MESSAGE } from "@/lib/auth/auth-contracts";
import { clearBrowserSession } from "@/lib/auth/session-cleanup";
import { useSubmitGate } from "@/lib/auth/use-submit-gate";

/**
 * Sign-out control (FR-AUTH-003). Available in the authenticated header
 * account menu and on /account. Global sign-out is attempted first; an
 * offline/server failure falls back to a local sign-out so this browser's
 * cookies are always cleared. A full navigation + refresh makes the proxy
 * and every server component observe the cleared session.
 */
export function SignOutButton({
  className = "",
  label = "Sign out",
}: {
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const { busy, begin, finish } = useSubmitGate();
  const [error, setError] = useState<string | null>(null);
  const errorId = `sign-out-error-${useId()}`;

  async function handleSignOut() {
    if (!begin()) return;
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const result = await clearBrowserSession(supabase);
      if (!result.ok) {
        setError(SIGN_OUT_ERROR_MESSAGE);
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setError(SIGN_OUT_ERROR_MESSAGE);
    } finally {
      finish();
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleSignOut}
        disabled={busy}
        aria-busy={busy}
        aria-describedby={error ? errorId : undefined}
        className={
          className ||
          "hover:bg-brand-50 hover:text-brand-800 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60"
        }
      >
        {busy ? "Signing out…" : label}
      </button>
      {error && (
        <span id={errorId} role="alert" className="text-error text-xs">
          {error}
        </span>
      )}
    </span>
  );
}
