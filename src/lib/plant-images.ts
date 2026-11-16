/*
 * Plant-library imagery registry (species-matched, license-verified).
 *
 * Sources: Wikimedia Commons lead photographs of each species' English
 * Wikipedia article — every file's license + author were verified via the
 * MediaWiki imageinfo API on 2026-11-15 (recorded in docs/IMAGE_CREDITS.md).
 * The registry is server-safe (no secrets, no client-only APIs) and drives:
 * home hero/features, library cards, plant detail fallback imagery,
 * saved-plant cards, and decorative accents.
 *
 * Honesty rules:
 * - Images genuinely depict the named species (Wikipedia lead images).
 * - CC BY-SA / CC BY attribution is REQUIRED — `credit` is rendered next to
 *   every image use (detail pages render it under the photo; cards expose it
 *   via title/aria + the detail page). Full credits: docs/IMAGE_CREDITS.md.
 * - The database `plant_library.image_url` ALWAYS wins when present (canonical
 *   imagery is owner-managed); this registry is the fallback display source,
 *   never an overwrite of DB data.
 * - `FALLBACK_PLANT_IMAGE` is original PlantAI artwork (SVG, no third-party
 *   license) for any species without a photo.
 */

export interface PlantImageAsset {
  /** Local, build-time bundled image (next/image optimized). */
  src: string;
  alt: string;
  /** Attribution line rendered wherever the image is displayed. */
  credit: string;
  /** Wikimedia Commons file page (full license + author record). */
  creditUrl: string;
  license: string;
}

export const FALLBACK_PLANT_IMAGE = "/plants/placeholder.svg";

export const PLANT_LIBRARY_IMAGES: Record<string, PlantImageAsset> = {
  "monstera-deliciosa": {
    src: "/plants/monstera-deliciosa.jpg",
    alt: "Monstera deliciosa leaves with characteristic split fenestrations",
    credit: "Wikimedia Commons contributor (see file page)",
    creditUrl: "https://commons.wikimedia.org/wiki/File:Monstera_deliciosa2.jpg",
    license: "CC BY-SA 3.0",
  },
  "epipremnum-aureum": {
    src: "/plants/epipremnum-aureum.jpg",
    alt: "Golden pothos (Epipremnum aureum) trailing vine with variegated leaves",
    credit: "Mokkie",
    creditUrl:
      "https://commons.wikimedia.org/wiki/File:Money_Plant_(Epipremnum_aureum)_4.jpg",
    license: "CC BY-SA 3.0",
  },
  "dracaena-trifasciata": {
    src: "/plants/dracaena-trifasciata.jpg",
    alt: "Snake plant (Dracaena trifasciata) upright banded leaves in a pot",
    credit: "Mokkie",
    creditUrl:
      "https://commons.wikimedia.org/wiki/File:Snake_Plant_(Sansevieria_trifasciata_%27Laurentii%27).jpg",
    license: "CC BY-SA 3.0",
  },
  "zamioculcas-zamiifolia": {
    src: "/plants/zamioculcas-zamiifolia.jpg",
    alt: "ZZ plant (Zamioculcas zamiifolia) glossy dark pinnate leaves",
    credit: "User:WeFt",
    creditUrl:
      "https://commons.wikimedia.org/wiki/File:Zamioculcas_zamiifolia_1.jpg",
    license: "CC BY-SA 3.0",
  },
  "spathiphyllum-wallisii": {
    src: "/plants/spathiphyllum-wallisii.jpg",
    alt: "Peace lily (Spathiphyllum) dark leaves with a white spathe flower",
    credit: "W.carter",
    creditUrl:
      "https://commons.wikimedia.org/wiki/File:Peace_lily_-_1_-_cropped.jpg",
    license: "CC BY-SA 4.0",
  },
  "philodendron-hederaceum": {
    src: "/plants/philodendron-hederaceum.jpg",
    alt: "Heartleaf philodendron (Philodendron hederaceum) heart-shaped leaves",
    credit: "KENPEI",
    creditUrl:
      "https://commons.wikimedia.org/wiki/File:Philodendron_scandens_subsp_oxycardium2.jpg",
    license: "CC BY-SA 3.0",
  },
  "ficus-lyrata": {
    src: "/plants/ficus-lyrata.jpg",
    alt: "Fiddle-leaf fig (Ficus lyrata) large violin-shaped leaves",
    credit: "Forest & Kim Starr",
    creditUrl:
      "https://commons.wikimedia.org/wiki/File:Starr_031108-0130_Ficus_lyrata.jpg",
    license: "CC BY 3.0",
  },
  "aloe-vera": {
    src: "/plants/aloe-vera.jpg",
    alt: "Aloe vera rosette of thick fleshy leaves in a pot",
    credit: "PilotChicago",
    creditUrl: "https://commons.wikimedia.org/wiki/File:Aloe_Vera_houseplant.jpg",
    license: "CC BY-SA 4.0",
  },
  "crassula-ovata": {
    src: "/plants/crassula-ovata.jpg",
    alt: "Jade plant (Crassula ovata) rounded fleshy leaves on woody stems",
    credit: "sannse",
    creditUrl: "https://commons.wikimedia.org/wiki/File:Crassula_ovata_700.jpg",
    license: "CC BY-SA 3.0",
  },
  "ficus-elastica": {
    src: "/plants/ficus-elastica.jpg",
    alt: "Rubber plant (Ficus elastica) bold glossy elliptic leaves",
    credit: "B.navez",
    creditUrl:
      "https://commons.wikimedia.org/wiki/File:Ficus_elastica_leaves_02.JPG",
    license: "CC BY-SA 3.0",
  },
};

/** DB imagery always wins; the registry is the display fallback. */
export function getPlantImageAsset(
  slug: string | null | undefined
): PlantImageAsset | null {
  if (!slug) return null;
  return PLANT_LIBRARY_IMAGES[slug] ?? null;
}

/** Home hero image (verified species photo, CC BY-SA 3.0 — see credits). */
export const HERO_IMAGE: PlantImageAsset =
  PLANT_LIBRARY_IMAGES["monstera-deliciosa"];
