"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  safeAuthPath,
  withAuthNext,
} from "@/lib/auth/auth-contracts";
import { authLinkErrorMessage } from "@/lib/auth/login-messages";

/**
 * /auth/link — client-side PKCE exchange for magic links, sign-up
 * confirmations and confirmation resends.
 *
 * The code_verifier lives in this browser, so a server route cannot consume
 * the emailed `?code=`. The exchange runs exactly once, the consumed code is
 * stripped only after the exchange settles, and a validated `?next=` value
 * is carried through to the page the user originally wanted.
 */
export function AuthLinkHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeAuthPath(searchParams.get("next"));
  const cleanupPath = withAuthNext("/auth/link", nextPath);

  const [failed, setFailed] = useState(() => !searchParams.get("code"));
  const exchangedRef = useRef(false);

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code || exchangedRef.current) return;
    exchangedRef.current = true;

    let cancelled = false;
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      // Keep the failure state update out of the effect body (React 19 lint).
      queueMicrotask(() => {
        if (!cancelled) setFailed(true);
      });
      return () => {
        cancelled = true;
      };
    }

    const removeCodeFromUrl = () => {
      // The code is one-time; remove it after the exchange attempt settles,
      // but before navigating so the cleaned URL cannot race the redirect.
      window.history.replaceState(null, "", cleanupPath);
    };

    void supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (cancelled) return;
        removeCodeFromUrl();
        if (error) {
          setFailed(true);
          return;
        }
        router.replace(nextPath);
        router.refresh();
      })
      .catch(() => {
        if (cancelled) return;
        removeCodeFromUrl();
        setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [cleanupPath, nextPath, router, searchParams]);

  if (failed) {
    return (
      <div className="mt-6" aria-live="polite">
        <p
          role="alert"
          className="text-error bg-error/10 rounded-md px-3 py-2 text-sm"
        >
          {authLinkErrorMessage()}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link
            href={withAuthNext("/login", nextPath)}
            className="text-brand-700 font-medium underline"
          >
            Request a new sign-in link →
          </Link>
          <Link
            href={withAuthNext("/signup", nextPath)}
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
