import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAuthRedirect } from "@/lib/auth/session";
import { PlantImage } from "@/components/plants/plant-image";

export const metadata: Metadata = {
  title: "Care reminders",
  robots: { index: false, follow: false },
};

/*
 * /reminders — TRUTHFUL pending state (Phase 4 scope, FR-REM-001/002).
 *
 * care_reminders is fully designed at the database level (types, repeat
 * intervals, auto-advance trigger §5.4) but has no UI yet. This page never
 * pretends reminders exist, shows no fake "upcoming" list, and points to
 * the working care guides instead.
 */
async function RemindersContent() {
  await requireAuthRedirect("/reminders");
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
        <p className="text-sm font-medium">Reminders are on the way</p>
        <p className="text-foreground-muted mt-2 text-sm leading-relaxed">
          Watering, fertilizing, pruning and repotting reminders — with sensible
          repeat intervals and a due-today view — are the next personal-plant
          feature. They’ll attach to your own plants once the My Plants
          collection ships, so there’s nothing to configure here yet.
        </p>
        <p className="text-foreground-muted mt-3 text-sm leading-relaxed">
          Meanwhile, every{" "}
          <Link href="/library" className="underline hover:text-foreground">
            library guide
          </Link>{" "}
          lists watering frequency and feeding basics you can act on today.
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

export default function RemindersPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Care reminders</h1>
      <Suspense fallback={<PanelSkeleton />}>
        <RemindersContent />
      </Suspense>
    </div>
  );
}
