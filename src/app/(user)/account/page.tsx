import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getAuthContext } from "@/lib/auth/session";
import { SignOutButton } from "@/components/auth/sign-out-button";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

/*
 * /account — completed MVP slice: real session info + sign-out, with the
 * Phase 4 items (profile editing, "Delete my data" erasure flow) stated
 * honestly as pending. The erasure flow has a documented DB design
 * (ON DELETE CASCADE, DATABASE_SCHEMA.md §9) — the UI is Phase 4 work.
 */
async function AccountContent() {
  const auth = await getAuthContext();
  if (!auth.userId) {
    return (
      <div className="border-border-muted bg-surface-muted mt-8 rounded-lg border px-4 py-8 text-sm">
        <p className="font-medium">Not signed in</p>
        <p className="text-foreground-muted mt-2">
          <Link href="/login" className="underline hover:text-foreground">
            Sign in
          </Link>{" "}
          to manage your account.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <section className="border-border-muted bg-surface rounded-xl border p-5">
        <h2 className="text-sm font-semibold">Account</h2>
        <p className="text-foreground-muted mt-2 text-sm">
          Signed in as <span className="font-medium">{auth.email}</span>
        </p>
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
