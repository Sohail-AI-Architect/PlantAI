"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { authLinkErrorMessage } from "@/lib/auth/login-messages";

/**
 * /auth/link — PKCE email-link landing for MAGIC LINK and SIGN-UP
 * CONFIRMATION (F9, Phase 6 report).
 *
 * Why this page exists: the browser Supabase client is PKCE by default
 * (@supabase/ssr `createBrowserClient` hard-codes flowType "pkce"), so
 * `signInWithOtp`, `signUp`, and `resend` all send a code_challenge and
 * GoTrue turns the emailed link into `{emailRedirectTo}?code=…`. A PKCE
 * code can ONLY be exchanged by the browser client holding the matching
 * code_verifier (stored locally when the email was requested) — the
 * server-side `/auth/confirm` route is structurally unable to consume it,
 * and every PKCE magic-link/confirmation click previously dead-ended at
 * /login?error=link (same class of defect as F8 recovery).
 *
 * token_hash-style links (a customized template) still go to
 * `/auth/confirm` and are verified server-side exactly as before; this
 * page never sees them.
 *
 * Security properties:
 * - the exchange runs EXACTLY once (ref-guarded against re-mounts);
 * - the one-time code is stripped from the address bar immediately, so a
 *   consumed code is never re-submitted or left in a shareable URL;
 * - invalid, expired, and already-used codes are indistinguishable (one
 *   neutral message, no account-state leak) with a way back to request a
 *   fresh link;
 * - the session is only established by GoTrue's own code exchange — no
 *   confirmation or authentication is bypassed.
 */
export function AuthLinkHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [failed, setFailed] = useState(() => !searchParams.get("code"));
  const exchangedRef = useRef(false);

  useEffect(() => {
    const code = searchParams.get("code");
    // No code = nothing this page can consume (e.g. a bookmark or a
    // token_hash link that belongs to /auth/confirm): neutral failure.
    if (!code || exchangedRef.current) return;
    exchangedRef.current = true;
    // Defensive: if search params arrive after the first render, the initial
    // "no code" failure state must not stick while a valid code is exchanged.
    setFailed(false);

    // Strip the one-time code from the address bar immediately: it can only
    // be used once, and a leftover ?code= is both useless and shareable.
    window.history.replaceState(null, "", "/auth/link");

    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    void supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (cancelled) return;
        if (error) {
          setFailed(true);
          return;
        }
        // Code exchange only succeeds against GoTrue's live one-time token,
        // and it establishes the session in this browser's cookies.
        router.replace("/dashboard");
        router.refresh();
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  if (failed) {
    return (
      <div className="mt-6" aria-live="polite">
        <p role="alert" className="text-error bg-error/10 rounded-md px-3 py-2 text-sm">
          {authLinkErrorMessage()}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link
            href="/login"
            className="text-brand-700 font-medium underline"
          >
            Request a new sign-in link →
          </Link>
          <Link
            href="/signup"
            className="text-foreground-muted hover:text-foreground underline"
          >
            Create an account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6" aria-live="polite">
      <p className="text-foreground-muted text-sm">
        Verifying your one-time link…
      </p>
    </div>
  );
}
