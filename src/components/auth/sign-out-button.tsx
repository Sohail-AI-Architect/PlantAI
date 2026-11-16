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

  async function handleSignOut() {
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.replace("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
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
  );
}
