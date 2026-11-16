import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isIdentificationPersistenceEnabled } from "@/lib/env";
import { PlantImage } from "@/components/plants/plant-image";
import { PLANT_LIBRARY_IMAGES } from "@/lib/plant-images";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

/*
 * /dashboard — completed MVP slice (personal overview).
 *
 * Real data only: the saved-plants count is a live RLS-bounded query.
 * Identification history is shown TRUTHFULLY: writes to `identifications`
 * are owner-gated (`PLANTAI_PERSISTENCE_ENABLED`, default OFF), so when the
 * gate is off we say exactly that — no fabricated history, no fake counters.
 * Reminders/user-plant features are honest Phase 4 states.
 */

interface Overview {
  email: string | null;
  savedCount: number | null;
  failed: boolean;
}

async function loadOverview(): Promise<Overview> {
  const auth = await getAuthContext();
  if (!auth.userId) return { email: null, savedCount: null, failed: false };

  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("saved_plants")
    .select("plant_id", { count: "exact", head: true })
    .eq("user_id", auth.userId);

  if (error) {
    console.error(`[dashboard] saved count failed (${error.code})`);
    return { email: auth.email, savedCount: null, failed: true };
  }
  return { email: auth.email, savedCount: count ?? 0, failed: false };
}

function StatCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border-muted bg-surface rounded-xl border p-5">
      <h2 className="text-foreground-muted text-xs font-semibold uppercase tracking-wide">
        {label}
      </h2>
      <div className="mt-2 text-sm">{children}</div>
    </div>
  );
}

async function DashboardContent() {
  const { email, savedCount, failed } = await loadOverview();
  const persistenceOn = isIdentificationPersistenceEnabled();

  return (
    <div>
      <p className="text-foreground-muted text-sm">
        {email ? <>Signed in as {email}</> : "Your PlantAI overview"}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="Saved plants">
          {failed ? (
            <p role="alert">Couldn’t load — try again shortly.</p>
          ) : (savedCount ?? 0) === 0 ? (
            <>
              <p className="text-foreground-muted">
                Nothing saved yet.
              </p>
              <Link
                href="/identify"
                className="text-brand-700 mt-2 inline-block font-semibold hover:underline"
              >
                Identify a plant →
              </Link>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold">{savedCount}</p>
              <Link
                href="/saved-plants"
                className="text-brand-700 mt-1 inline-block font-semibold hover:underline"
              >
                View saved plants →
              </Link>
            </>
          )}
        </StatCard>

        <StatCard label="Identification history">
          {persistenceOn ? (
            <p className="text-foreground-muted">
              History recording is enabled. A full history view ships with the
              Phase 4 personal-plant work.
            </p>
          ) : (
            <p className="text-foreground-muted">
              Not being recorded yet. Identification results are shown
              immediately but not stored — storing them requires the owner to
              enable database persistence
              (<code className="text-xs">PLANTAI_PERSISTENCE_ENABLED</code>).
              Nothing is lost from demo use: the identify flow itself works.
            </p>
          )}
        </StatCard>

        <StatCard label="My plants">
          <p className="text-foreground-muted">
            Your personal plant collection (nicknames, notes, photos) is the
            next personal-management feature. It will use your account — no
            action needed from you now.
          </p>
        </StatCard>

        <StatCard label="Care reminders">
          <p className="text-foreground-muted">
            Watering and feeding reminders arrive with the personal-plant
            features. The database foundation is already in place; the UI is
            being built.
          </p>
        </StatCard>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-6">
        {/* Decorative species photo (license-verified, docs/IMAGE_CREDITS.md). */}
        <PlantImage
          asset={PLANT_LIBRARY_IMAGES["crassula-ovata"]}
          alt=""
          aspect="aspect-[16/10]"
          sizes="(min-width: 640px) 240px, 100vw"
          className="w-40 shrink-0 rounded-xl sm:w-56"
        />
        <div className="flex flex-wrap gap-3">
          <Link
            href="/identify"
            className="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            Identify a plant
          </Link>
          <Link
            href="/library"
            className="border-border-muted hover:bg-surface rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors"
          >
            Browse plant guides
          </Link>
        </div>
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div
      className="mt-6 grid animate-pulse gap-4 sm:grid-cols-2"
      aria-hidden="true"
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="border-border-muted bg-surface-muted h-32 rounded-xl border"
        />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <Suspense fallback={<OverviewSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
