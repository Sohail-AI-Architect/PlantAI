"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { safeAuthPath, withAuthNext } from "@/lib/auth/auth-contracts";

/**
 * Reset-password links are retired with the password UI. Send the visitor to
 * the Google sign-in experience with a clear obsolete-flow notice; any valid
 * `?next=` destination is preserved and re-validated on the login page.
 */
export function ResetPasswordForm() {
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
        Passwords are no longer used to sign in. Taking you to Google sign-in…
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
