import type {
  ConfidenceBand,
  SpeciesCandidate,
  SpeciesImage,
  UpstreamIdentifyResponse,
} from "@/lib/plantnet/types";

/**
 * Confidence bands (API_DOCUMENTATION.md §2.6 field rules): a PlantAI product
 * choice, not upstream semantics. Thresholds: >=0.70 exact, >=0.35 likely,
 * else possible. Kept in one file so Phase 2 calibration touches exactly
 * this (AI_INTEGRATION_PLAN.md §3: never inflate confidence).
 */
export function confidenceBand(score: number): ConfidenceBand {
  if (score >= 0.7) return "exact";
  if (score >= 0.35) return "likely";
  return "possible";
}

/** Normalizes a species list: sorted score-desc, ranks assigned, bands applied. */
export function normalizeSpecies(
  input: Array<Omit<SpeciesCandidate, "rank" | "confidenceBand">>
): SpeciesCandidate[] {
  return [...input]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10) // zero-cardinality rule: max 10 entries (§2.6)
    .map((s, i) => ({
      ...s,
      rank: i + 1,
      confidenceBand: confidenceBand(s.score),
    }));
}

/* ------------------------------------------------------------------ */
/* Stage C (2026-11-13): upstream v2 → PlantAI candidate normalization   */
/*                                                                      */
/* Maps the VERIFIED Stage A1 upstream contract only                    */
/* (docs/VERIFIED_FACTS.md — results[] with 0–1 scores,                 */
/* species.scientificNameWithoutAuthor/Authorship/scientificName,       */
/* genus/family.scientificNameWithoutAuthor, commonNames, optional      */
/* gbif.id/powo.id, per-result images[] with author/license/citation    */
/* and url {o,m,s}). Anything else is treated as absent. Nothing is     */
/* invented: no names, scores, or taxonomy identifiers are ever         */
/* fabricated, and malformed entries/images are skipped defensively —   */
/* one bad optional field never invalidates an otherwise valid          */
/* candidate.                                                           */
/* ------------------------------------------------------------------ */

/**
 * The ONLY documented reusable license case (Stage A1, "Using images" doc):
 * CC BY-SA (Attribution + ShareAlike). Comparison is conservative and
 * case-insensitive; hyphen/underscore/space variants of the same license
 * identifier are accepted. Missing/unknown/unsupported values are NOT
 * renderable.
 */
const RENDERABLE_LICENSES = new Set(["cc-by-sa"]);

export function isRenderableLicense(license: unknown): license is string {
  if (typeof license !== "string") return false;
  const normalized = license.trim().toLowerCase().replace(/[\s_]+/g, "-");
  return RENDERABLE_LICENSES.has(normalized);
}

/** Required upstream name fields are read defensively from these shapes. */
function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Non-empty trimmed string, or null. */
function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Picks the scientific name strictly from documented upstream fields:
 * `species.scientificName` (full name with author), else composed from
 * `scientificNameWithoutAuthor` + `scientificNameAuthorship` (both
 * documented). Returns null when nothing documented is available — a name is
 * never invented.
 */
function resolveScientificName(species: Record<string, unknown>): string | null {
  const full = optionalString(species.scientificName);
  if (full) return full;
  const withoutAuthor = optionalString(species.scientificNameWithoutAuthor);
  if (!withoutAuthor) return null;
  const authorship = optionalString(species.scientificNameAuthorship);
  return authorship ? `${withoutAuthor} ${authorship}` : withoutAuthor;
}

/**
 * Maps ONE upstream image to a renderable SpeciesImage — or null. Rules
 * (LEGAL_AND_COMPLIANCE.md §7, API_DOCUMENTATION.md §2.8):
 * - a usable url (m → o → s fallback among the documented sizes) is required;
 * - the license MUST be the documented reusable case (conservative,
 *   case-insensitive) — missing/unknown/unsupported ⇒ image is NOT rendered;
 * - the contributor attribution (author) is REQUIRED — missing author ⇒ not
 *   rendered (attribution would be incomplete);
 * - `citation` is preserved verbatim when returned; `attribution` is composed
 *   from the ACTUAL author/license values per the documented pattern — never
 *   fabricated;
 * - any malformed optional field only drops THIS image, never the candidate.
 */
function mapImage(scientificName: string, image: unknown): SpeciesImage | null {
  const img = asRecord(image);
  if (!img) return null;

  const license = optionalString(img.license);
  if (!isRenderableLicense(license)) return null;

  const author = optionalString(img.author);
  if (!author) return null; // incomplete attribution → do not render

  const urlObj = asRecord(img.url);
  const url = urlObj
    ? (optionalString(urlObj.m) ?? optionalString(urlObj.o) ?? optionalString(urlObj.s))
    : null;
  if (!url) return null;

  const attribution = `${author} / Pl@ntNet, ${license}`;
  const citation = optionalString(img.citation) ?? attribution;

  return {
    url,
    alt: `Pl@ntNet illustration of ${scientificName}`,
    citation,
    license,
    attribution,
  };
}

/** Maps ONE upstream result entry to a candidate — or null when malformed. */
export function mapUpstreamResultEntry(entry: unknown): SpeciesCandidate | null {
  const rec = asRecord(entry);
  if (!rec) return null;

  // Score: documented 0–1 float. Non-numeric/out-of-range/malformed ⇒ skip
  // (a score is never invented or silently clamped).
  const score = rec.score;
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1) {
    return null;
  }

  const species = asRecord(rec.species);
  if (!species) return null; // species object is required for a documented name
  const scientificName = resolveScientificName(species);
  if (!scientificName) return null;

  const commonNamesRaw = Array.isArray(species.commonNames) ? species.commonNames : [];
  const commonNames = commonNamesRaw
    .map((n) => (typeof n === "string" ? n.trim() : ""))
    .filter((n) => n.length > 0);

  const family = asRecord(species.family);
  const genus = asRecord(species.genus);
  const familyName = family ? optionalString(family.scientificNameWithoutAuthor) : null;
  const genusName = genus ? optionalString(genus.scientificNameWithoutAuthor) : null;

  // Taxonomy identifiers: documented as TOP-LEVEL result siblings
  // (`gbif: { id }` / `powo: { id }`) — the official output example shows
  // string values ("2927079", "444576-1"). Read conservatively: gbifId keeps
  // numeric values, and digits-only strings are converted to the SAME number
  // (value preserved, type normalized); anything else stays null — never
  // guessed. POWO ids are kept verbatim as strings.
  const gbif = asRecord(rec.gbif);
  const powo = asRecord(rec.powo);
  let gbifId: number | null = null;
  if (gbif && typeof gbif.id === "number" && Number.isFinite(gbif.id)) {
    gbifId = gbif.id;
  } else if (gbif && typeof gbif.id === "string" && /^\d+$/.test(gbif.id.trim())) {
    gbifId = Number(gbif.id.trim());
  }
  let powoId: string | null = null;
  if (powo && typeof powo.id === "string" && powo.id.trim().length > 0) {
    powoId = powo.id.trim();
  } else if (powo && typeof powo.id === "number" && Number.isFinite(powo.id)) {
    powoId = String(powo.id);
  }

  // Images: rendered set only; malformed entries dropped individually.
  const imagesRaw = Array.isArray(rec.images) ? rec.images : [];
  const images: SpeciesImage[] = [];
  for (const image of imagesRaw) {
    const mapped = mapImage(scientificName, image);
    if (mapped) images.push(mapped);
  }

  return {
    rank: 0, // assigned by normalizeSpecies in the route
    scientificName,
    commonNames,
    family: familyName,
    genus: genusName,
    gbifId,
    powoId,
    score,
    confidenceBand: "possible", // assigned by normalizeSpecies in the route
    sources: ["pl@ntnet-v2"],
    images,
  };
}

/**
 * Stage C normalizer (the Stage B `UpstreamNormalizer` boundary, now
 * implemented): maps a parsed, verified upstream 200 response into PlantAI
 * candidates. Empty/fully-malformed results produce an empty list — the
 * route maps that to HTTP 404 `no_match_found`. The route's
 * `normalizeSpecies` then applies ranking, confidence bands, and the
 * max-10 candidate limit.
 */
export function normalizeUpstreamResponse(
  response: UpstreamIdentifyResponse
): { topResult: { species: SpeciesCandidate[] } } {
  const species: SpeciesCandidate[] = [];
  for (const entry of response.results) {
    const candidate = mapUpstreamResultEntry(entry);
    if (candidate) species.push(candidate);
  }
  return { topResult: { species } };
}
