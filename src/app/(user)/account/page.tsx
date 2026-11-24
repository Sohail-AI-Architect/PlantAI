import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAuthRedirect } from "@/lib/auth/session";
import { SignOutButton } from "@/components/auth/sign-out-button";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

/*
 * /account — real session info + sign-out, protected both by the proxy and
 * by this server-side claims guard. Phase 4 items (profile editing and the
 * "Delete my data" flow) remain honestly listed as pending.
 */
async function AccountContent() {
  const auth = await requireAuthRedirect("/account");

  return (
    <div className="mt-8 space-y-6">
      <section className="border-border-muted bg-surface rounded-xl border p-5">
        <h2 className="text-sm font-semibold">Account</h2>
        <p className="text-foreground-muted mt-2 text-sm">
          Signed in as{" "}
          <span className="text-foreground font-medium">
            {auth.displayName ?? auth.email}
          </span>
        </p>
        {auth.email ? (
          <p className="text-foreground-muted mt-1 text-xs">{auth.email}</p>
        ) : null}
        <div className="mt-4">
          <SignOutButton />
        </div>
      </section>

      <section className="border-border-muted bg-surface rounded-xl border p-5">
        <h2 className="text-sm font-semibold">Coming to this page</h2>
        <ul className="text-foreground-muted mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>Profile display name (the profiles table is ready).</li>
          <li>
            “Delete my data” — a two-step erasure flow that removes your
            plants, reminders and saved species, per the documented data
            model.
          </li>
        </ul>
        <p className="text-foreground-muted mt-3 text-xs leading-relaxed">
          Meanwhile: species you bookmark live in{" "}
          <Link href="/saved-plants" className="underline hover:text-foreground">
            Saved Plants
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div
      className="border-border-muted bg-surface-muted mt-8 h-40 animate-pulse rounded-xl border"
      aria-hidden="true"
    />
  );
}

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Account</h1>
      <Suspense fallback={<PanelSkeleton />}>
        <AccountContent />
      </Suspense>
    </div>
  );
}
