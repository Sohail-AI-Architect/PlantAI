/*
 * DETERMINISTIC OFFLINE FIXTURES — Stage D (2026-11-13).
 *
 * PROVENANCE LABEL (important — TESTING_PLAN.md §12 fixture policy):
 * Every fixture in this file is SYNTHETIC and DOCUMENTATION-DERIVED:
 * field shapes mirror the VERIFIED Stage A1 upstream contract
 * (docs/VERIFIED_FACTS.md + the official identify output example), but the
 * VALUES (species names, scores, authors, URLs, quota numbers) are invented
 * offline placeholders. NO fixture here is a real recorded Pl@ntNet API
 * response, and none may ever be presented as one. The only real-world
 * fragments are the documented header formats (`RateLimit`, `RateLimit-Policy`)
 * and the documented attribution form, quoted verbatim from the official docs.
 *
 * Rules encoded by these fixtures:
 * - `species.{scientificNameWithoutAuthor, scientificNameAuthorship,
 *   scientificName, genus, family, commonNames}` nesting + top-level
 *   `gbif: {id}` / `powo: {id}` result siblings (string ids per the official
 *   example) — never invented beyond this.
 * - `results[].score` ∈ [0,1]; absent/invalid ⇒ the normalizer skips.
 * - Image metadata: `author`/`license`/`citation` + `url {o,m,s}`; URLs point
 *   at `.invalid` (RFC 2606 reserved) so they can NEVER resolve anywhere.
 * - No undocumented fields are added; unknown-field tolerance is tested
 *   separately in the suites that consume these fixtures.
 */

/** Marker repeated in exports for provenance clarity. */
export const FIXTURE_PROVENANCE =
  "SYNTHETIC documentation-derived fixture — NOT a real recorded Pl@ntNet response";

/* ------------------------------------------------------------------ */
/* A valid single plant identification (documentation-derived shape)    */
/* ------------------------------------------------------------------ */

export const SINGLE_PLANT_RESULT = {
  score: 0.91,
  species: {
    scientificNameWithoutAuthor: "Ficus lyrata",
    scientificNameAuthorship: "Warb.",
    scientificName: "Ficus lyrata Warb.",
    commonNames: ["fiddle-leaf fig"],
    family: { scientificNameWithoutAuthor: "Moraceae" },
    genus: { scientificNameWithoutAuthor: "Ficus" },
  },
  gbif: { id: "2870168" }, // digits-string form per the official example
  powo: { id: "5543396-1" },
  images: [
    {
      author: "Fabrice Rubio",
      license: "cc-by-sa",
      citation: "Fabrice Rubio / Pl@ntNet, cc-by-sa", // documented citation form
      url: {
        o: "https://fixture.invalid/img-o.jpg",
        m: "https://fixture.invalid/img-m.jpg",
        s: "https://fixture.invalid/img-s.jpg",
      },
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Multiple plant candidates (mixed completeness)                       */
/* ------------------------------------------------------------------ */

export const MULTIPLE_CANDIDATES_RESULTS = [
  SINGLE_PLANT_RESULT,
  {
    score: 0.55,
    species: {
      scientificNameWithoutAuthor: "Ficus elastica",
      commonNames: ["rubber plant"],
      genus: { scientificNameWithoutAuthor: "Ficus" },
    },
  }, // no authorship, no family, no ids, no images
  {
    score: 0.2,
    species: { scientificName: "Monstera deliciosa" },
  }, // full-name-only, everything else absent
];

/* ------------------------------------------------------------------ */
/* Missing common names / missing optional taxonomy identifiers         */
/* ------------------------------------------------------------------ */

export const NO_COMMON_NAMES_RESULT = {
  score: 0.66,
  species: {
    scientificNameWithoutAuthor: "Aloe vera",
    scientificNameAuthorship: "(L.) Burm.f.",
    family: { scientificNameWithoutAuthor: "Asphodelaceae" },
  },
};

export const NO_TAXONOMY_IDS_RESULT = {
  score: 0.7,
  species: { scientificNameWithoutAuthor: "Zamioculcas zamiifolia" },
  // gbif/powo absent entirely — must map to null, never guessed
};

/** Odd-but-defensive id variants (value preservation, never guessed). */
export const ODD_TAXONOMY_ID_VARIANTS = [
  { gbif: { id: 2870168 }, powo: { id: "5543396-1" } }, // numeric gbif
  { gbif: { id: "not-a-number" }, powo: { id: 42 } }, // non-digit string / numeric powo
];

/* ------------------------------------------------------------------ */
/* Empty results (route maps to HTTP 404 no_match_found)                */
/* ------------------------------------------------------------------ */

export const EMPTY_RESULTS_BODY = { results: [] };

/* ------------------------------------------------------------------ */
/* Invalid upstream structures (must never crash anything)              */
/* ------------------------------------------------------------------ */

export const INVALID_STRUCTURE_ENTRIES: unknown[] = [
  null,
  "a string",
  42,
  [],
  {}, // no score/name
  { score: "0.5", species: { scientificNameWithoutAuthor: "X" } }, // non-numeric score
  { score: Number.NaN, species: { scientificNameWithoutAuthor: "X" } },
  { score: 1.2, species: { scientificNameWithoutAuthor: "X" } }, // out of 0–1
  { score: -0.1, species: { scientificNameWithoutAuthor: "X" } },
  { score: 0.5 }, // no species object
  { score: 0.5, species: {} }, // no name at all
  { score: 0.5, species: { scientificNameWithoutAuthor: "   " } }, // blank name
];

/** A 200-shaped body whose results contain BOTH valid and invalid entries. */
export const MIXED_VALID_INVALID_BODY = {
  results: [null, SINGLE_PLANT_RESULT, { score: "bad" }, NO_TAXONOMY_IDS_RESULT],
  remainingIdentificationRequests: 431,
};

/* ------------------------------------------------------------------ */
/* Image metadata cases (license/attribution display rule)              */
/* ------------------------------------------------------------------ */

export interface FixtureImageCase {
  name: string;
  image: unknown;
  renderable: boolean;
}

/** Author URL entries point at `.invalid` (RFC 2606) — never resolvable. */
export const IMAGE_METADATA_CASES: FixtureImageCase[] = [
  {
    name: "valid CC BY-SA with citation",
    image: {
      author: "Fabrice Rubio",
      license: "cc-by-sa",
      citation: "Fabrice Rubio / Pl@ntNet, cc-by-sa",
      url: { m: "https://fixture.invalid/with-citation.jpg" },
    },
    renderable: true,
  },
  {
    name: "valid CC BY-SA without citation",
    image: {
      author: "Jane Doe",
      license: "CC BY-SA", // documented variant spelling
      url: { s: "https://fixture.invalid/no-citation.jpg" },
    },
    renderable: true,
  },
  { name: "author missing", image: { license: "cc-by-sa", url: { m: "https://fixture.invalid/x.jpg" } }, renderable: false },
  { name: "author blank", image: { author: "   ", license: "cc-by-sa", url: { m: "https://fixture.invalid/x.jpg" } }, renderable: false },
  { name: "license missing", image: { author: "A", url: { m: "https://fixture.invalid/x.jpg" } }, renderable: false },
  { name: "license unsupported (CC-BY-NC)", image: { author: "A", license: "CC-BY-NC", url: { m: "https://fixture.invalid/x.jpg" } }, renderable: false },
  { name: "license malformed", image: { author: "A", license: 42, url: { m: "https://fixture.invalid/x.jpg" } }, renderable: false },
  { name: "url object missing", image: { author: "A", license: "cc-by-sa" }, renderable: false },
  { name: "url object without usable sizes", image: { author: "A", license: "cc-by-sa", url: {} }, renderable: false },
  { name: "image entry not an object", image: "not-an-image", renderable: false },
];

/* ------------------------------------------------------------------ */
/* Organ values (V6 contract)                                           */
/* ------------------------------------------------------------------ */

export const VALID_ORGAN_VALUES = ["leaf", "flower", "fruit", "bark", "auto"] as const;

/** Values that MUST be rejected with HTTP 400 before any upstream call. */
export const INVALID_ORGAN_VALUES = ["lateral", "root", "stem", "LATERAL", "0", "flower;drop"] as const;

/* ------------------------------------------------------------------ */
/* Quota signals (documented header formats + synthetic values)         */
/* ------------------------------------------------------------------ */

/** Documented header FORMAT with synthetic values; `pk=` must never leak. */
export const QUOTA_HEADERS = {
  rateLimitPolicy: '"dailyQuota";q=500;w=86400;pk=user1-identify',
  rateLimit: '"dailyQuota";r=431;t=3600;pk=user1-identify',
  retryAfter: null as string | null,
};

/** Synthetic remaining-quota body field values. */
export const REMAINING_BODY_VALUES = [431, 0, null] as const;

/** A partition-key-bearing header — asserts below prove `pk` never surfaces. */
export const RATE_LIMIT_HEADER_WITH_PK = '"dailyQuota";r=123;t=3600;pk=user1-identify';
