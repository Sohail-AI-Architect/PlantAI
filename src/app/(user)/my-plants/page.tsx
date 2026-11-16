import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAuthRedirect } from "@/lib/auth/session";
import { PlantImage } from "@/components/plants/plant-image";

export const metadata: Metadata = {
  title: "My Plants",
  robots: { index: false, follow: false },
};

/*
 * /my-plants — TRUTHFUL pending state (Phase 4 scope, FR-MP-001).
 *
 * The user_plants table exists (schema ready: nickname, location, notes,
 * photos), but the personal-collection UI is Phase 4 work and is NOT
 * presented as done. Rather than a bare stub, this page states exactly
 * what exists today and routes users to the working alternative
 * (saved plants), so no visitor mistakes a placeholder for a feature.
 */
async function MyPlantsContent() {
  await requireAuthRedirect("/my-plants");
  return (
    <div className="border-border-muted bg-surface-muted mt-8 overflow-hidden rounded-lg border">
      {/* Decorative placeholder artwork (original illustration, no
          third-party license) — clearly not a species photo. */}
      <PlantImage
        asset={null}
        alt=""
        aspect="aspect-[16/9]"
        sizes="(min-width: 640px) 672px, 100vw"
      />
      <div className="px-4 py-8">
        <p className="text-sm font-medium">Your plant collection is coming</p>
        <p className="text-foreground-muted mt-2 text-sm leading-relaxed">
          My Plants will let you keep a personal list of the plants you own —
          nicknames, locations, notes and photos — built on your account. The
          database foundation is ready; the interface ships in the next
          personal-plant update, so there’s nothing to set up here yet.
        </p>
        <p className="text-foreground-muted mt-3 text-sm leading-relaxed">
          Already useful today: species you bookmark are in{" "}
          <Link href="/saved-plants" className="underline hover:text-foreground">
            Saved Plants
          </Link>
          , and every{" "}
          <Link href="/library" className="underline hover:text-foreground">
            library guide
          </Link>{" "}
          has full care basics.
        </p>
      </div>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div
      className="border-border-muted bg-surface-muted mt-8 h-40 animate-pulse rounded-lg border"
      aria-hidden="true"
    />
  );
}

export default function MyPlantsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">My Plants</h1>
      <Suspense fallback={<PanelSkeleton />}>
        <MyPlantsContent />
      </Suspense>
    </div>
  );
}
