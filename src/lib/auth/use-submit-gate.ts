"use client";

import { useRef, useState } from "react";

/**
 * Re-entrancy guard for auth forms.
 *
 * `disabled={busy}` is only a UI hint: two Enter presses in the same tick can
 * both reach an async handler before React re-renders. The ref gate makes the
 * first submission win and drops every duplicate while it is in flight.
 */
export function useSubmitGate() {
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  function begin(): boolean {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    return true;
  }

  function finish(): void {
    inFlight.current = false;
    setBusy(false);
  }

  return { busy, begin, finish };
}
