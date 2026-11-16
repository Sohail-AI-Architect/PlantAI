"use client";

import { useState } from "react";
import Link from "next/link";
import { savePlant } from "@/actions/saved-plants";

/**
 * Auth-gated save button for plant pages (UI_UX_DESIGN.md §6.4 action row).
 * Sign-out state renders the graceful sign-in CTA; signed-in state calls
 * the verified Server Action.
 */
export function SavePlantButton({
  plantId,
  plantSlug,
  isAuthenticated,
}: {
  plantId: string;
  plantSlug: string;
  isAuthenticated: boolean;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isAuthenticated) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/plant/${plantSlug}`)}`}
        className="bg-brand-600 hover:bg-brand-700 inline-block rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors"
      >
        Sign in to save this plant
      </Link>
    );
  }

  async function handleSave() {
    setBusy(true);
    setStatus(null);
    const result = await savePlant(plantId);
    setStatus(result.message);
    setBusy(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleSave}
        disabled={busy}
        className="bg-brand-600 hover:bg-brand-700 rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save to My Plants"}
      </button>
      {status && (
        <p role="status" aria-live="polite" className="text-foreground-muted mt-1 text-xs">
          {status}
        </p>
      )}
    </div>
  );
}
