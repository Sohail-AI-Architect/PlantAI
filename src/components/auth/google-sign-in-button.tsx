"use client";

import { useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  buildGoogleOAuthRequest,
  googleOAuthErrorMessage,
} from "@/lib/auth/google-oauth";
import { safeAuthPath } from "@/lib/auth/auth-contracts";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useSubmitGate } from "@/lib/auth/use-submit-gate";

/**
 * The single normal-use auth action: Supabase Google OAuth with PKCE.
 *
 * Supabase creates a PlantAI user on first verified Google sign-in and signs
 * an existing user back in on later visits, including Supabase's verified
 * automatic identity linking. This component never collects an email or
 * password and never handles identity data; it only starts the official
 * browser redirect. The server callback exchanges the PKCE code and lets
 * Supabase SSR write the session cookies.
 */
export function GoogleSignInButton({
  label = "Continue with Google",
}: {
  label?: string;
}) {
  const searchParams = useSearchParams();
  const nextPath = safeAuthPath(searchParams.get("next"));
  const { busy, begin, finish } = useSubmitGate();
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "oauth"
      ? "Google sign-in couldn't be completed. Please try again."
      : null
  );
  const errorId = `google-sign-in-error-${useId()}`;

  async function handleGoogleSignIn() {
    // `disabled` is only a UI hint; the ref gate drops same-tick double clicks.
    if (!begin()) return;
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth(
        buildGoogleOAuthRequest(window.location.origin, nextPath)
      );

      if (oauthError) {
        setError(googleOAuthErrorMessage(oauthError));
        finish();
        return;
      }
      // The SDK redirects this browser to Google. Keep the busy state until
      // navigation so a second click cannot start another OAuth flow.
    } catch {
      setError(googleOAuthErrorMessage());
      finish();
    }
  }

  return (
    <div className="mt-6" aria-live="polite">
      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-error bg-error/10 mb-3 rounded-md px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={busy}
        aria-busy={busy}
        aria-describedby={error ? errorId : undefined}
        className="border-border-muted bg-surface hover:bg-surface-muted focus-visible:ring-brand-600 flex w-full items-center justify-center gap-3 rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60"
      >
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 24 24"
          className="h-5 w-5 shrink-0"
        >
          <path
            fill="#4285F4"
            d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.98-4.32 2.98-7.36Z"
          />
          <path
            fill="#34A853"
            d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.24-2.5c-.9.6-2.05.96-3.37.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.58A10 10 0 0 0 12 22Z"
          />
          <path
            fill="#FBBC05"
            d="M6.41 13.93A6 6 0 0 1 6.09 12c0-.67.11-1.32.32-1.93V7.49H3.06A10 10 0 0 0 2 12c0 1.61.39 3.14 1.06 4.51l3.35-2.58Z"
          />
          <path
            fill="#EA4335"
            d="M12 5.98c1.47 0 2.79.51 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.94 5.49l3.35 2.58C7.2 7.74 9.4 5.98 12 5.98Z"
          />
        </svg>
        <span>{busy ? "Continuing with Google…" : label}</span>
      </button>
      {busy && (
        <p className="text-foreground-muted mt-2 text-center text-xs">
          You&apos;ll be redirected to Google to continue.
        </p>
      )}
    </div>
  );
}
