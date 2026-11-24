"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { safeAuthPath, withAuthNext } from "@/lib/auth/auth-contracts";

/**
 * Create-account UI after the Google OAuth cutover.
 *
 * Supabase Auth creates the canonical UUID user and profile on the first
 * verified Google sign-in; later sign-ins with the same Google account return
 * to that account. This page deliberately asks for no password and performs no
 * client-side identity mapping.
 */
export function SignupForm() {
  const searchParams = useSearchParams();
  const nextPath = safeAuthPath(searchParams.get("next"));

  return (
    <div className="mt-6 space-y-6">
      <p className="text-foreground-muted text-sm">
        Your first Google sign-in creates your free PlantAI account automatically.
        No separate PlantAI password is needed.
      </p>

      <GoogleSignInButton />

      <p className="text-foreground-muted text-center text-sm">
        Already have an account?{" "}
        <Link
          href={withAuthNext("/login", nextPath)}
          className="text-brand-700 hover:text-brand-800 underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
