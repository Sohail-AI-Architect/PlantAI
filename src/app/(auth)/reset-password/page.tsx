import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Set a new password",
  robots: { index: false, follow: false },
};

/*
 * /reset-password — Phase 2 auth (FR-AUTH-006). Reached only after
 * /auth/confirm verified the recovery token (session established in the
 * cookie). Not in the proxy's guest-only list: a signed-in visitor may also
 * reach it, which is harmless — updateUser requires a session either way.
 */
export default function ResetPasswordPage() {
  return (
    <section className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
      <div className="border-border-muted bg-surface rounded-xl border p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">Set a new password</h1>
        <p className="text-foreground-muted mt-1 text-sm">
          Choose a new password of at least 8 characters.
        </p>
        <ResetPasswordForm />
      </div>
    </section>
  );
}
