import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth/session";
import { SavePlantButton } from "@/components/identify/save-plant-button";
import { PlanteNetAttribution } from "@/components/identify/attribution";
import { JsonLd } from "@/components/seo/json-ld";
import { PlantImage } from "@/components/plants/plant-image";
import { getPlantImageAsset } from "@/lib/plant-images";

/*
 * /plant/[slug] — completed MVP slice.
 *
 * Next 16 (Cache Components): deliberately a BLOCKING route
 * (`instant = false`, documented option for dynamic slugs) — the slug's DB
 * lookup + notFound() must run before the response starts so unknown slugs
 * return a real 404 status. The only runtime-cookie read (auth state for
 * the save button) streams inside its own <Suspense>.
 *
 * SEO: per-species generateMetadata (title/description/canonical/OG built
 * from THIS plant's real record — never a shared generic title), a
 * BreadcrumbList JSON-LD that mirrors the visible breadcrumb, and
 * mandatory image-credit rendering whenever an image is present
 * (DATABASE_SCHEMA.md §3.2 attribution rule).
 */
export const instant = false;

interface PlantRow {
  id: string;
  slug: string;
  scientific_name: string;
  common_names: string[];
  family: string | null;
  genus: string | null;
  category: string;
  description: string | null;
  watering: string | null;
  sunlight: string | null;
  soil: string | null;
  fertilizer: string | null;
  difficulty: string | null;
  image_url: string | null;
  image_credit: string | null;
  is_published: boolean;
}

async function loadPlant(slug: string): Promise<PlantRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("plant_library")
    .select(
      "id, slug, scientific_name, common_names, family, genus, category, description, watering, sunlight, soil, fertilizer, difficulty, image_url, image_credit, is_published"
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  return (data as PlantRow) ?? null;
}

/** Title ≤ ~60 chars: primary common name + scientific name (SEO_STRATEGY §4). */
function plantTitle(p: PlantRow): string {
  const common = p.common_names[0];
  const base = common ? `${common} (${p.scientific_name})` : p.scientific_name;
  return base.length > 60 ? p.scientific_name : base;
}

function plantDescription(p: PlantRow): string | undefined {
  if (p.description && p.description.length > 0) {
    return p.description.length > 158
      ? `${p.description.slice(0, 155).trimEnd()}…`
      : p.description;
  }
  const bits = [p.watering, p.sunlight].filter(Boolean);
  return bits.length > 0
    ? `Care basics for ${p.scientific_name}: ${bits.join(" · ")}.` // derived from the record, never invented
    : undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const plant = await loadPlant(slug);
  if (!plant) return { title: "Plant not found" };

  const title = plantTitle(plant);
  const description = plantDescription(plant);
  return {
    title,
    description,
    alternates: { canonical: `/plant/${plant.slug}` },
    openGraph: {
      title,
      description,
      type: "article",
      url: `/plant/${plant.slug}`,
    },
  };
}

const CARE_ROWS: { key: keyof PlantRow; label: string; icon: string }[] = [
  { key: "watering", label: "Watering", icon: "💧" },
  { key: "sunlight", label: "Sunlight", icon: "☀️" },
  { key: "soil", label: "Soil", icon: "🪱" },
  { key: "fertilizer", label: "Fertilizer", icon: "🌱" },
];

async function SavePlantSection({ plant: p }: { plant: PlantRow }) {
  // Cookie-dependent auth check streams inside Suspense (Cache Components).
  const auth = await getAuthContext();
  return (
    <SavePlantButton
      plantId={p.id}
      plantSlug={p.slug}
      isAuthenticated={auth.userId !== null}
    />
  );
}

export default async function PlantDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  /*
   * Slug resolution + the DB fetch + notFound() run BLOCKING in the page
   * body (no Suspense above) so unknown slugs produce a real 404 status —
   * a notFound() inside a Suspense boundary streams after the 200 shell.
   * Awaiting `params` makes this dynamic route request-time rendered
   * (ƒ), which cacheComponents permits.
   */
  const { slug } = await params;
  const plant = await loadPlant(slug);
  if (!plant) notFound();
  const p = plant;
  const registryImage = getPlantImageAsset(p.slug);

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "/" },
            { "@type": "ListItem", position: 2, name: "Plant library", item: "/library" },
            { "@type": "ListItem", position: 3, name: p.scientific_name },
          ],
        }}
      />

      <nav aria-label="Breadcrumb" className="text-foreground-muted text-xs">
        <Link href="/" className="hover:text-foreground underline">
          Home
        </Link>{" "}
        ›{" "}
        <Link href="/library" className="hover:text-foreground underline">
          Library
        </Link>{" "}
        › <span aria-current="page">{p.scientific_name}</span>
      </nav>

      <header className="mt-4">
        <h1 className="text-3xl font-bold tracking-tight italic">
          {p.scientific_name}
        </h1>
        {p.common_names.length > 0 && (
          <p className="text-foreground-muted mt-1 text-sm">
            {p.common_names.join(", ")}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {p.family && (
            <span className="border-border-muted bg-surface-muted rounded-full border px-2.5 py-1">
              {p.family}
            </span>
          )}
          <span className="border-border-muted bg-surface-muted rounded-full border px-2.5 py-1 capitalize">
            {p.category}
          </span>
          {p.difficulty && (
            <span className="border-border-muted bg-surface-muted rounded-full border px-2.5 py-1 capitalize">
              {p.difficulty} care
            </span>
          )}
        </div>
      </header>

      {/* Imagery precedence (task §7): a DB `image_url` is the canonical,
          owner-managed photo and always wins. Otherwise the license-verified
          registry photo is DISPLAYED as a fallback (never written to the DB),
          with its CC attribution rendered. Last resort: the original
          placeholder illustration. */}
      {p.image_url ? (
        <figure className="mt-6">
          <div className="border-border-muted bg-surface-muted relative aspect-[16/9] overflow-hidden rounded-xl border">
            <Image
              src={p.image_url}
              alt={
                p.common_names[0]
                  ? `${p.common_names[0]} (${p.scientific_name})`
                  : p.scientific_name
              }
              fill
              className="object-cover"
              sizes="(min-width: 768px) 768px, 100vw"
            />
          </div>
          {/* Attribution is mandatory whenever an image is shown
              (DATABASE_SCHEMA.md §3.2). */}
          {p.image_credit && (
            <figcaption className="text-foreground-muted mt-2 text-xs">
              {p.image_credit}
            </figcaption>
          )}
        </figure>
      ) : registryImage ? (
        <figure className="mt-6">
          <div className="border-border-muted bg-surface-muted relative aspect-[16/9] overflow-hidden rounded-xl border">
            <Image
              src={registryImage.src}
              alt={registryImage.alt}
              fill
              priority
              className="object-cover"
              sizes="(min-width: 768px) 768px, 100vw"
            />
          </div>
          <figcaption className="text-foreground-muted mt-2 text-xs leading-relaxed">
            Photo: {registryImage.credit} ·{" "}
            <a
              href={registryImage.creditUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              {registryImage.license}
            </a>{" "}
            via Wikimedia Commons ({registryImage.creditUrl})
          </figcaption>
        </figure>
      ) : (
        <figure className="mt-6">
          <PlantImage
            asset={null}
            alt={`${p.scientific_name} photo coming soon`}
            aspect="aspect-[16/9]"
            sizes="(min-width: 768px) 768px, 100vw"
          />
          <figcaption className="text-foreground-muted mt-2 text-xs">
            A verified photograph for this species is being sourced — the
            illustration above is a placeholder, not a photo.
          </figcaption>
        </figure>
      )}

      {p.description && (
        <p className="text-foreground mt-6 leading-relaxed">{p.description}</p>
      )}

      <section aria-labelledby="care-table-heading" className="mt-8">
        <h2 id="care-table-heading" className="text-base font-semibold">
          Care
        </h2>
        <dl className="border-border-muted divide-border-muted mt-3 divide-y rounded-lg border">
          {CARE_ROWS.map(({ key, label, icon }) => (
            <div key={key} className="flex gap-3 px-4 py-3">
              <dt className="w-28 shrink-0 text-sm font-medium">
                <span aria-hidden="true">{icon}</span> {label}
              </dt>
              <dd className="text-foreground-muted text-sm leading-relaxed">
                {p[key] ? String(p[key]) : "Care guide coming soon"}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-8">
        <Suspense fallback={<div className="h-10" aria-hidden="true" />}>
          <SavePlantSection plant={p} />
        </Suspense>
      </div>

      <div className="border-border-muted mt-10 border-t pt-4">
        <PlanteNetAttribution />
      </div>
    </article>
  );
}
