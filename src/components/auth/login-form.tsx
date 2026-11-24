"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { safeAuthPath, withAuthNext } from "@/lib/auth/auth-contracts";

/**
 * Sign-in UI after the Google OAuth cutover.
 *
 * One verified Supabase Google flow handles both first-time account creation
 * and returning sign-in. No email, password, magic-link, confirmation or
 * recovery form is shown here. Any validated `?next=` destination is carried
 * through the OAuth callback by the shared button.
 */
export function LoginForm() {
  const searchParams = useSearchParams();
  const nextPath = safeAuthPath(searchParams.get("next"));
  const obsoletePasswordFlow = searchParams.get("notice") === "password-obsolete";

  return (
    <div className="mt-6 space-y-6">
      {obsoletePasswordFlow && (
        <p role="status" className="text-foreground-muted text-sm">
          Password reset is no longer needed — continue with the same Google
          account to sign in.
        </p>
      )}

      <GoogleSignInButton />

      <div className="text-foreground-muted flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={withAuthNext("/signup", nextPath)}
          className="text-brand-700 hover:text-brand-800 underline"
        >
          New here? Create an account
        </Link>
        <Link href="/identify" className="hover:text-foreground underline">
          Continue without signing in →
        </Link>
      </div>
    </div>
  );
}
