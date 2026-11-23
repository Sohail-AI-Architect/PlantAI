"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Sign-out button (Phase 2 auth, FR-AUTH-003). Uses the existing browser
 * Supabase client; a full navigation + refresh ensures every server
 * component (and the proxy) observes the cleared session cookie.
 */
export function SignOutButton({
  className = "",
  label = "Sign out",
}: {
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        setError("Couldn't sign out — please try again.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Couldn't sign out — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleSignOut}
        disabled={busy}
        className={
          className ||
          "hover:bg-brand-50 hover:text-brand-800 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60"
        }
      >
        {busy ? "Signing out…" : label}
      </button>
      {error && (
        <span role="alert" className="text-error text-xs">
          {error}
        </span>
      )}
    </span>
  );
}
