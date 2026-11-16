"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { unsavePlant } from "@/actions/saved-plants";

/*
 * Remove button for a saved-plant card (saved-plants view).
 * Calls the RLS-bounded `unsavePlant` Server Action, then refreshes the
 * server-rendered list. Errors surface as inline text — never as a fake
 * success.
 */
export function RemoveSavedPlantButton({ plantId }: { plantId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await unsavePlant(plantId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleRemove}
        disabled={pending}
        className="border-border-muted hover:bg-surface rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </span>
  );
}
