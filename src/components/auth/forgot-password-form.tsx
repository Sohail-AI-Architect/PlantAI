"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { safeAuthPath, withAuthNext } from "@/lib/auth/auth-contracts";

/**
 * The password-recovery UI is obsolete: Google accounts sign in with their
 * Google identity. This component redirects to the shared Google sign-in
 * experience while preserving a validated `?next=` destination.
 */
export function ForgotPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeAuthPath(searchParams.get("next"));
  const loginPath = withAuthNext("/login?notice=password-obsolete", nextPath);

  useEffect(() => {
    router.replace(loginPath);
  }, [router, loginPath]);

  return (
    <div className="mt-6" aria-live="polite">
      <p role="status" className="text-foreground-muted text-sm">
        Taking you to Google sign-in…
      </p>
      <Link
        href={loginPath}
        className="text-brand-700 hover:text-brand-800 mt-2 inline-block text-sm font-medium underline"
      >
        Continue now →
      </Link>
    </div>
  );
}
