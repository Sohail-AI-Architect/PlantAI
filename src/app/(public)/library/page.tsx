import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PlantImage } from "@/components/plants/plant-image";
import { getPlantImageAsset } from "@/lib/plant-images";

export const metadata: Metadata = {
  title: "Plant library",
  description:
    "Human-written care guides for common houseplants and garden plants: watering, sunlight, soil and fertilizer basics, searchable by name or keyword.",
  alternates: { canonical: "/library" },
};

/*
 * BLOCKING route (`instant = false`): the page awaits `searchParams` (?q=)
 * and reads cookies via the session client — runtime data, so it renders
 * on demand. DB failure renders the explicit error state, never a fake
 * "no results" baked into a prerendered shell.
 */
export const instant = false;

/*
 * /library — completed MVP slice (FR-LIB-001/002).
 *
 * Lists PUBLISHED plant_library rows via the session client (public read of
 * published rows only — RLS `p_plant_library_*`). `?q=` filters across every
 * catalog text field, including the common_names ARRAY (PostgREST cannot
 * ilike across text[], so filtering happens server-side in JS over the
 * fetched catalog — the library is intentionally small at MVP scale, and the
 * query is capped). Static metadata keeps `?q=` variants canonicalized to
 * the clean /library URL (SEO_STRATEGY.md §6 intent).
 *
 * Honest states: a real DB failure renders an explicit "temporarily
 * unavailable" error state — never a fake "no results".
 */

interface LibraryRow {
  id: string;
  slug: string;
  scientific_name: string;
  common_names: string[];
  family: string | null;
  genus: string | null;
  category: string;
  description: string | null;
  difficulty: string | null;
}

const LIBRARY_LIMIT = 200;

function matchesQuery(row: LibraryRow, q: string): boolean {
  const haystack = [
    row.scientific_name,
    row.family,
    row.genus,
    row.description,
    ...row.common_names,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim().slice(0, 100);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plant_library")
    .select(
      "id, slug, scientific_name, common_names, family, genus, category, description, difficulty"
    )
    .eq("is_published", true)
    .order("scientific_name")
    .limit(LIBRARY_LIMIT);

  const rows = (data ?? []) as LibraryRow[];
  const results = query
    ? rows.filter((row) => matchesQuery(row, query.toLowerCase()))
    : rows;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Plant library</h1>
      <p className="text-foreground-muted mt-2 max-w-2xl text-sm leading-relaxed">
        Practical care guides written by people, not scraped: how much water
        and light each plant needs, what soil it likes, and how to feed it. New
        to houseplants? Start with the{" "}
        <Link href="/#care-basics" className="underline hover:text-foreground">
          indoor plant care basics
        </Link>{" "}
        on the home page.
      </p>

      <form
        action="/library"
        method="get"
        role="search"
        className="border-border-muted mt-6 flex max-w-xl gap-2"
      >
        <input
          type="search"
          name="q"
          defaultValue={query}
          maxLength={100}
          placeholder="Search by name or keyword…"
          aria-label="Search the plant library"
          className="border-border-muted bg-surface focus:border-brand-600 w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-200"
        />
        <button
          type="submit"
          className="bg-brand-600 hover:bg-brand-700 shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          Search
        </button>
      </form>

      {error ? (
        <p
          role="alert"
          className="border-border-muted bg-surface-muted mt-8 rounded-lg border px-4 py-6 text-sm"
        >
          Plant guides are temporarily unavailable — please try again shortly.
        </p>
      ) : results.length === 0 ? (
        <div className="mt-8">
          {query ? (
            <p className="text-foreground-muted border-border-muted bg-surface-muted rounded-lg border px-4 py-6 text-sm">
              No guides match “{query}”. Try a shorter keyword, or{" "}
              <Link href="/library" className="underline hover:text-foreground">
                browse everything
              </Link>
              .
            </p>
          ) : (
            <p className="text-foreground-muted border-border-muted bg-surface-muted rounded-lg border px-4 py-6 text-sm">
              The library is just getting started — new guides are being
              written and fact-checked. In the meantime, you can{" "}
              <Link href="/identify" className="underline hover:text-foreground">
                identify a plant
              </Link>{" "}
              and get care basics from its result page.
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="text-foreground-muted mt-6 text-xs" aria-live="polite">
            {results.length} guide{results.length === 1 ? "" : "s"}
            {query ? ` matching “${query}”` : ""}
          </p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {results.map((row) => (
              <li
                key={row.id}
                className="border-border-muted bg-surface flex flex-col overflow-hidden rounded-xl border"
              >
                <Link href={`/plant/${row.slug}`} className="group block">
                  {/* Species-matched photo where one is verified in the
                      registry; the fallback is an illustration placeholder —
                      never a random or wrong-species photo. */}
                  <PlantImage asset={getPlantImageAsset(row.slug)} aspect="aspect-[16/10]" />
                  <div className="p-5">
                    <h2 className="font-semibold italic group-hover:underline">
                      {row.scientific_name}
                    </h2>
                    {row.common_names.length > 0 && (
                      <p className="text-foreground-muted mt-0.5 text-sm">
                        {row.common_names.join(", ")}
                      </p>
                    )}
                    {row.description && (
                      <p className="text-foreground-muted mt-2 line-clamp-2 text-sm leading-relaxed">
                        {row.description}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="border-border-muted bg-surface-muted rounded-full border px-2.5 py-1 capitalize">
                        {row.category}
                      </span>
                      {row.difficulty && (
                        <span className="border-border-muted bg-surface-muted rounded-full border px-2.5 py-1 capitalize">
                          {row.difficulty} care
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
