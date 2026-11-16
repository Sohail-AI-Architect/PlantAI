import type {
  IdentifyProviderRequest,
  IdentifyProviderResult,
  SpeciesCandidate,
} from "@/lib/plantnet/types";

/**
 * MOCK identification provider (Phase 2, PLANTNET_MODE=mock — default).
 *
 * Contract for this file:
 * - ZERO external/network calls. Ever. (Owner requirement; verified by the
 *   contract tests — the module contains no fetch/HTTP of any kind.)
 * - Deterministic: the same image set always yields the same result
 *   (seeded by the combined SHA-256 of the image bytes).
 * - Clearly identified as a mock: `sources: ["mock"]` on every candidate;
 *   the route adds `mode: "mock"` + a human `mockNotice`, and the UI shows
 *   a "Demo result — testing mode" banner. A mock result is never
 *   presented as a real AI identification (owner requirement).
 * - The result follows the API_DOCUMENTATION.md §2.6 normalized shape so a
 *   future approved Pl@ntNet provider can replace this file without any
 *   client redesign (PLANTNET_INTEGRATION_PLAN note below).
 *
 * Fixture species mirror the 10 seeded `plant_library` rows (migration 004),
 * so `careSummary` resolution succeeds for the top match.
 */

interface MockSpecies {
  slug: string;
  scientificName: string;
  commonNames: string[];
  family: string;
  genus: string;
  score: number;
}

/** Fixed fixture set — mirrors the seeded plant_library entries. */
const MOCK_SPECIES: MockSpecies[] = [
  { slug: "monstera-deliciosa", scientificName: "Monstera deliciosa", commonNames: ["swiss cheese plant", "ceriman"], family: "Araceae", genus: "Monstera", score: 0.87 },
  { slug: "epipremnum-aureum", scientificName: "Epipremnum aureum", commonNames: ["golden pothos", "devil's ivy"], family: "Araceae", genus: "Epipremnum", score: 0.81 },
  { slug: "dracaena-trifasciata", scientificName: "Dracaena trifasciata", commonNames: ["snake plant", "mother-in-law's tongue"], family: "Asparagaceae", genus: "Dracaena", score: 0.84 },
  { slug: "zamioculcas-zamiifolia", scientificName: "Zamioculcas zamiifolia", commonNames: ["ZZ plant", "eternity plant"], family: "Araceae", genus: "Zamioculcas", score: 0.79 },
  { slug: "spathiphyllum-wallisii", scientificName: "Spathiphyllum wallisii", commonNames: ["peace lily"], family: "Araceae", genus: "Spathiphyllum", score: 0.76 },
  { slug: "ficus-lyrata", scientificName: "Ficus lyrata", commonNames: ["fiddle-leaf fig"], family: "Moraceae", genus: "Ficus", score: 0.83 },
  { slug: "ficus-elastica", scientificName: "Ficus elastica", commonNames: ["rubber plant", "rubber fig"], family: "Moraceae", genus: "Ficus", score: 0.8 },
  { slug: "crassula-ovata", scientificName: "Crassula ovata", commonNames: ["jade plant", "money plant"], family: "Crassulaceae", genus: "Crassula", score: 0.82 },
  { slug: "aloe-vera", scientificName: "Aloe vera", commonNames: ["aloe vera", "medicinal aloe"], family: "Asphodelaceae", genus: "Aloe", score: 0.85 },
  { slug: "philodendron-hederaceum", scientificName: "Philodendron hederaceum", commonNames: ["heartleaf philodendron"], family: "Araceae", genus: "Philodendron", score: 0.74 },
];

/**
 * Deterministic fixture ordering from the image-hash bytes: rotates the
 * fixture list so different (but identical-always) inputs give stable,
 * *different* results — enough variety to exercise the UI state machine
 * honestly, without pretending to be a trained model.
 */
function rotateBy(hash: string): MockSpecies[] {
  const nibble = parseInt(hash[0], 16) || 0;
  const offset = nibble % MOCK_SPECIES.length;
  return [...MOCK_SPECIES.slice(offset), ...MOCK_SPECIES.slice(0, offset)];
}

/**
 * Deterministic score shaping: top candidates get the fixed fixture score,
 * lower ranks decay so the confidence bands (exact/likely/possible) are all
 * reachable in testing. No randomness anywhere.
 */
function shapedScores(): number[] {
  return [1.0, 0.52, 0.24, 0.15, 0.09];
}

/** Mock-only extension: the seeded library slug for careSummary resolution. */
export type MockSpeciesCandidate = SpeciesCandidate & { plantLibrarySlug: string };

export interface MockIdentifyProviderResult extends IdentifyProviderResult {
  topResult: { species: MockSpeciesCandidate[] };
}

export async function identifyMock(
  request: IdentifyProviderRequest
): Promise<MockIdentifyProviderResult> {
  // Deterministic; no await ever needed — kept async to match the provider
  // interface so the future live provider is a drop-in.
  const rotated = rotateBy(request.combinedHash);
  const scores = shapedScores();

  const species: MockSpeciesCandidate[] = rotated.slice(0, 5).map((s, i) => ({
    rank: 0, // assigned by normalizeSpecies in the route
    scientificName: s.scientificName,
    commonNames: s.commonNames,
    family: s.family,
    genus: s.genus,
    gbifId: null,
    powoId: null, // Stage D parity: same optional-identifier contract as live
    score: Math.min(0.99, s.score * scores[i]),
    confidenceBand: "possible",
    sources: ["mock"],
    images: [], // mock mode never fabricates botanical imagery/CC citations
    plantLibrarySlug: s.slug,
  }));

  return {
    topResult: { species },
    sourceLabel: "mock",
  };
}
