import Link from "next/link";
import Image from "next/image";
import { JsonLd } from "@/components/seo/json-ld";
import { PlantImage } from "@/components/plants/plant-image";
import { HERO_IMAGE, PLANT_LIBRARY_IMAGES } from "@/lib/plant-images";

/*
 * Homepage — completed MVP slice (FR-HOME-001/002/003).
 *
 * A visitor can now start the core journey from here: the primary CTA is
 * /identify (mock/demo mode — the MockDemoBanner on that page states this
 * honestly). Copy never overclaims: identification results are AI-assisted,
 * not a disease diagnosis, and the library grows with human-written guides.
 */

const FEATURES = [
  {
    title: "Identify a plant",
    href: "/identify",
    body: "Upload or take 1–3 photos and get likely species matches with honest confidence scores — powered by the Pl@ntNet recognition engine.",
    cta: "Start identifying",
    image: PLANT_LIBRARY_IMAGES["aloe-vera"],
  },
  {
    title: "Plant library",
    href: "/library",
    body: "Human-written care guides — watering, sunlight, soil and fertilizer basics — for common houseplants and garden species.",
    cta: "Browse the library",
    image: PLANT_LIBRARY_IMAGES["spathiphyllum-wallisii"],
  },
  {
    title: "Save and revisit",
    href: "/library",
    body: "Sign in to bookmark species you care about, then find them again any time in your saved plants.",
    cta: "Sign in to save plants",
    image: PLANT_LIBRARY_IMAGES["epipremnum-aureum"],
  },
] as const;

export default function HomePage() {
  return (
    <div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "PlantAI",
          url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
        }}
      />
      <section className="border-border-muted bg-surface-muted border-b">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                Identify your plants — and learn how to keep them healthy
              </h1>
              <p className="text-foreground-muted mt-4 text-lg leading-relaxed">
                PlantAI helps you put a name to an unknown plant from a photo,
                then gives you practical care guidance: how much water and
                light it needs, what soil it likes, and how to feed it.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/identify"
                  className="bg-brand-600 hover:bg-brand-700 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-colors"
                >
                  <span aria-hidden="true" className="mr-1.5">📷</span>
                  Identify a plant
                </Link>
                <Link
                  href="/library"
                  className="border-border-muted hover:bg-surface rounded-lg border px-6 py-3 text-sm font-semibold transition-colors"
                >
                  Browse plant guides
                </Link>
              </div>
              <p className="text-foreground-muted mt-4 text-xs">
                Identification is AI-assisted and may be incorrect. It is not a
                plant-disease diagnosis.
              </p>
            </div>
            {/* Hero photograph — species-matched, license-verified
                (docs/IMAGE_CREDITS.md). Cropped, never distorted. */}
            <div>
              <div className="border-border-muted relative aspect-[4/3] overflow-hidden rounded-2xl border shadow-sm">
                <Image
                  src={HERO_IMAGE.src}
                  alt={HERO_IMAGE.alt}
                  fill
                  priority
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <p className="text-foreground-muted mt-2 text-right text-[10px]">
                Monstera deliciosa ·{" "}
                <a
                  href={HERO_IMAGE.creditUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  {HERO_IMAGE.license}
                </a>{" "}
                via Wikimedia Commons
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        className="mx-auto max-w-5xl px-4 py-16 sm:px-6"
        aria-label="What PlantAI offers"
      >
        <h2 className="text-2xl font-bold tracking-tight">What you can do</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <li
              key={feature.title}
              className="border-border-muted bg-surface flex flex-col overflow-hidden rounded-xl border"
            >
              <PlantImage asset={feature.image} aspect="aspect-[3/2]" />
              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="text-foreground-muted mt-2 flex-1 text-sm leading-relaxed">
                  {feature.body}
                </p>
                <Link
                  href={feature.href}
                  className="text-brand-700 hover:text-brand-800 mt-4 text-sm font-semibold"
                >
                  {feature.cta} →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
