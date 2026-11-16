import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAuthRedirect } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RemoveSavedPlantButton } from "@/components/user/remove-saved-plant-button";
import { PlantImage } from "@/components/plants/plant-image";
import { getPlantImageAsset } from "@/lib/plant-images";

export const metadata: Metadata = {
  title: "Saved Plants",
  robots: { index: false, follow: false },
};

/*
 * /saved-plants — completed MVP slice (saved-plant management view).
 *
 * Identity is verified server-side (`requireAuthRedirect` → getClaims(),
 * never client state); RLS `p_saved_plants_owner_all` bounds the read to the
 * owner's rows. Plant data is embedded from plant_library; rows whose
 * species is unpublished/removed are shown honestly as "no longer
 * available" (with a remove option) rather than hidden silently.
 *
 * The cookie read streams inside Suspense (Cache Components — Next.js 16).
 */

interface SavedCard {
  plantId: string;
  slug: string | null;
  scientificName: string | null;
  commonNames: string[];
  category: string | null;
  difficulty: string | null;
  available: boolean;
}

async function loadSavedPlants(): Promise<{
  cards: SavedCard[];
  failed: boolean;
}> {
  const auth = await requireAuthRedirect("/saved-plants");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("saved_plants")
    .select(
      "plant_id, plant_library ( slug, scientific_name, common_names, category, difficulty, is_published )"
    )
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(`[saved-plants] load failed (${error.code})`);
    return { cards: [], failed: true };
  }

  type JoinedRow = {
    plant_id: string;
    plant_library: {
      slug: string;
      scientific_name: string;
      common_names: string[] | null;
      category: string;
      difficulty: string | null;
      is_published: boolean;
    } | null;
  };

  const cards: SavedCard[] = ((data ?? []) as unknown as JoinedRow[]).map((row) => {
    const p = row.plant_library;
    const available = p !== null && p.is_published;
    return {
      plantId: row.plant_id,
      slug: available ? p.slug : null,
      scientificName: p ? p.scientific_name : null,
      commonNames: p?.common_names ?? [],
      category: p?.category ?? null,
      difficulty: p?.difficulty ?? null,
      available,
    };
  });

  return { cards, failed: false };
}

async function SavedPlantsList() {
  const { cards, failed } = await loadSavedPlants();

  if (failed) {
    return (
      <p
        role="alert"
        className="border-border-muted bg-surface-muted mt-8 rounded-lg border px-4 py-6 text-sm"
      >
        Your saved plants couldn’t be loaded — please try again shortly.
      </p>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="border-border-muted bg-surface-muted mt-8 rounded-lg border px-4 py-10 text-center">
        {/* Decorative placeholder artwork (original, no third-party license)
            — clearly an illustration, not a species photo. */}
        <PlantImage
          asset={null}
          alt=""
          aspect="aspect-[16/9]"
          sizes="320px"
          className="mx-auto max-w-xs rounded-lg"
        />
        <p className="mt-4 text-sm font-medium">Nothing saved yet</p>
        <p className="text-foreground-muted mt-2 text-sm">
          Identify a plant or open a library guide, then use “Save this plant”
          to keep it here.
        </p>
        <div className="mt-4 flex justify-center gap-3 text-sm font-semibold">
          <Link href="/identify" className="text-brand-700 hover:underline">
            Identify a plant
          </Link>
          <Link href="/library" className="text-brand-700 hover:underline">
            Browse the library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2">
      {cards.map((card) => (
        <li
          key={card.plantId}
          className="border-border-muted bg-surface overflow-hidden rounded-xl border"
        >
          {card.available ? (
            <Link href={`/plant/${card.slug}`} className="group block">
              <PlantImage asset={getPlantImageAsset(card.slug)} aspect="aspect-[16/10]" />
              <div className="p-5">
                <h2 className="font-semibold italic group-hover:underline">
                  {card.scientificName}
                </h2>
                {card.commonNames.length > 0 && (
                  <p className="text-foreground-muted mt-0.5 text-sm">
                    {card.commonNames.join(", ")}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {card.category && (
                    <span className="border-border-muted bg-surface-muted rounded-full border px-2.5 py-1 capitalize">
                      {card.category}
                    </span>
                  )}
                  {card.difficulty && (
                    <span className="border-border-muted bg-surface-muted rounded-full border px-2.5 py-1 capitalize">
                      {card.difficulty} care
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ) : (
            <div className="p-5">
              <h2 className="text-foreground-muted font-semibold italic">
                No longer available
              </h2>
              <p className="text-foreground-muted mt-1 text-sm">
                This species isn’t published in the library right now.
              </p>
            </div>
          )}
          <div className="px-5 pb-5">
            <RemoveSavedPlantButton plantId={card.plantId} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ListSkeleton() {
  return (
    <ul className="mt-6 grid animate-pulse gap-4 sm:grid-cols-2" aria-hidden="true">
      {[0, 1].map((i) => (
        <li key={i} className="border-border-muted bg-surface-muted h-40 rounded-xl border" />
      ))}
    </ul>
  );
}

export default function SavedPlantsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Saved plants</h1>
      <p className="text-foreground-muted mt-2 text-sm leading-relaxed">
        Species you’ve bookmarked from identification results and library
        guides.
      </p>
      <Suspense fallback={<ListSkeleton />}>
        <SavedPlantsList />
      </Suspense>
    </div>
  );
}
