/*
 * Stage D (2026-11-13) — MOCK/LIVE RESPONSE PARITY + mock regression locks.
 *
 * Proves that BOTH providers satisfy the SAME normalized response contract
 * (API_DOCUMENTATION.md §2.6 / types.ts IdentifyProviderResult +
 * SpeciesCandidate), so the route/UI need no per-provider branches:
 * - MockProvider (identifyMock) — deterministic, never fabricates imagery.
 * - Live provider (PlantnetLiveProvider) exercised through the Stage C
 *   normalizer with SYNTHETIC documentation-derived fixtures (see
 *   tests/fixtures/plantnet/upstream-fixtures.ts for the provenance label).
 *
 * Zero network: the live provider runs against a stubbed fetch and a dummy
 * key; the mock provider is pure. Fixtures are synthetic — never claimed to
 * be real recorded Pl@ntNet responses.
 */
import { describe, expect, it, vi } from "vitest";

import { identifyMock } from "@/lib/plantnet/mock-provider";
import { PlantnetLiveProvider } from "@/lib/plantnet/live-provider";
import { normalizeSpecies } from "@/lib/plantnet/normalize";
import {
  MULTIPLE_CANDIDATES_RESULTS,
  EMPTY_RESULTS_BODY,
  FIXTURE_PROVENANCE,
  NO_COMMON_NAMES_RESULT,
  NO_TAXONOMY_IDS_RESULT,
  ODD_TAXONOMY_ID_VARIANTS,
  QUOTA_HEADERS,
  REMAINING_BODY_VALUES,
  SINGLE_PLANT_RESULT,
} from "./fixtures/plantnet/upstream-fixtures";
import type {
  IdentifyProviderResult,
  SpeciesCandidate,
  UpstreamIdentifyResponse,
} from "@/lib/plantnet/types";

const DUMMY_KEY = "test-dummy-key-not-a-real-credential";
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

/* ------------------------------------------------------------------ */
/* Shared contract checker — the parity definition                      */
/* ------------------------------------------------------------------ */

/**
 * The single normalized response contract every provider result must satisfy
 * after the route's normalizeSpecies pass (ranking, bands, max-10 cap).
 */
function expectNormalizedContract(result: {
  topResult: { species: SpeciesCandidate[] };
  sourceLabel: string;
}): void {
  expect(typeof result.sourceLabel).toBe("string");
  expect(result.sourceLabel.length).toBeGreaterThan(0);
  expect(Array.isArray(result.topResult.species)).toBe(true);
  expect(result.topResult.species.length).toBeGreaterThan(0);

  let previousScore = Number.POSITIVE_INFINITY;
  result.topResult.species.forEach((c, i) => {
    // Shape: every SpeciesCandidate field present with the documented type.
    expect(c.rank).toBe(i + 1); // 1-based, assigned
    expect(typeof c.scientificName).toBe("string");
    expect(c.scientificName.length).toBeGreaterThan(0); // a name is never invented/empty
    expect(Array.isArray(c.commonNames)).toBe(true);
    expect(c.family === null || c.family === undefined || typeof c.family === "string").toBe(true);
    expect(c.genus === null || c.genus === undefined || typeof c.genus === "string").toBe(true);
    expect(c.gbifId === null || c.gbifId === undefined || typeof c.gbifId === "number").toBe(true);
    expect(c.powoId === null || c.powoId === undefined || typeof c.powoId === "string").toBe(true);
    expect(typeof c.score).toBe("number");
    expect(Number.isFinite(c.score)).toBe(true);
    expect(c.score).toBeGreaterThanOrEqual(0);
    expect(c.score).toBeLessThanOrEqual(1);
    expect(["exact", "likely", "possible"]).toContain(c.confidenceBand);
    expect(Array.isArray(c.sources)).toBe(true);
    expect(c.sources.length).toBeGreaterThan(0);
    expect(Array.isArray(c.images)).toBe(true);
    // Scores sorted descending (normalizeSpecies contract).
    expect(c.score).toBeLessThanOrEqual(previousScore);
    previousScore = c.score;
    // Image display rule parity: every image (mock has none) carries the
    // complete attribution trio — author + Pl@ntNet + license.
    for (const img of c.images) {
      expect(typeof img.attribution).toBe("string");
      expect(img.attribution).toContain("Pl@ntNet");
      expect(img.license === undefined || typeof img.license === "string").toBe(true);
      expect(typeof img.citation).toBe("string");
      expect(typeof img.url).toBe("string");
    }
  });
}

/* ------------------------------------------------------------------ */
/* Mock provider contract (regression pin — existing responses frozen)  */
/* ------------------------------------------------------------------ */

describe("mock provider — normalized contract + deterministic regression pin", () => {
  it("satisfies the shared normalized contract (parity with the live shape)", async () => {
    const result = await identifyMock({
      images: [JPEG_BYTES],
      organ: "auto",
      combinedHash: "0".repeat(64),
    });
    expectNormalizedContract({
      topResult: { species: normalizeSpecies(result.topResult.species) },
      sourceLabel: result.sourceLabel,
    });
  });

  it("REGRESSION PIN: exact deterministic output for a fixed hash is unchanged", async () => {
    const result = await identifyMock({
      images: [JPEG_BYTES],
      organ: "leaf",
      combinedHash: "0".repeat(64),
    });
    // Frozen Phase-2 mock behavior (hash nibble 0 → no rotation). Scores are
    // written as the same expressions the provider computes so float equality
    // is exact. Any accidental mock-shape change fails here loudly.
    expect(result.sourceLabel).toBe("mock");
    expect(result.topResult.species).toEqual([
      {
        rank: 0,
        scientificName: "Monstera deliciosa",
        commonNames: ["swiss cheese plant", "ceriman"],
        family: "Araceae",
        genus: "Monstera",
        gbifId: null,
        powoId: null,
        score: Math.min(0.99, 0.87 * 1.0),
        confidenceBand: "possible",
        sources: ["mock"],
        images: [],
        plantLibrarySlug: "monstera-deliciosa",
      },
      {
        rank: 0,
        scientificName: "Epipremnum aureum",
        commonNames: ["golden pothos", "devil's ivy"],
        family: "Araceae",
        genus: "Epipremnum",
        gbifId: null,
        powoId: null,
        score: Math.min(0.99, 0.81 * 0.52),
        confidenceBand: "possible",
        sources: ["mock"],
        images: [],
        plantLibrarySlug: "epipremnum-aureum",
      },
      {
        rank: 0,
        scientificName: "Dracaena trifasciata",
        commonNames: ["snake plant", "mother-in-law's tongue"],
        family: "Asparagaceae",
        genus: "Dracaena",
        gbifId: null,
        powoId: null,
        score: Math.min(0.99, 0.84 * 0.24),
        confidenceBand: "possible",
        sources: ["mock"],
        images: [],
        plantLibrarySlug: "dracaena-trifasciata",
      },
      {
        rank: 0,
        scientificName: "Zamioculcas zamiifolia",
        commonNames: ["ZZ plant", "eternity plant"],
        family: "Araceae",
        genus: "Zamioculcas",
        gbifId: null,
        powoId: null,
        score: Math.min(0.99, 0.79 * 0.15),
        confidenceBand: "possible",
        sources: ["mock"],
        images: [],
        plantLibrarySlug: "zamioculcas-zamiifolia",
      },
      {
        rank: 0,
        scientificName: "Spathiphyllum wallisii",
        commonNames: ["peace lily"],
        family: "Araceae",
        genus: "Spathiphyllum",
        gbifId: null,
        powoId: null,
        score: Math.min(0.99, 0.76 * 0.09),
        confidenceBand: "possible",
        sources: ["mock"],
        images: [],
        plantLibrarySlug: "spathiphyllum-wallisii",
      },
    ]);
  });

  it("stays deterministic: identical inputs → identical results; hash nibble selects the rotation deterministically", async () => {
    const a = await identifyMock({ images: [JPEG_BYTES], organ: "auto", combinedHash: "0".repeat(64) });
    const b = await identifyMock({ images: [JPEG_BYTES], organ: "auto", combinedHash: "0".repeat(64) });
    expect(b).toEqual(a);

    const rotated = await identifyMock({ images: [JPEG_BYTES], organ: "auto", combinedHash: "f".repeat(64) });
    const rotatedAgain = await identifyMock({ images: [JPEG_BYTES], organ: "auto", combinedHash: "f".repeat(64) });
    // nibble f=15 → offset 5: the rotation AND the selection are deterministic.
    expect(rotatedAgain).toEqual(rotated);
    expect(rotated.topResult.species[0].scientificName).toBe("Ficus lyrata");
    expect(rotated.topResult.species).toHaveLength(5);
  });

  it("mock never fabricates imagery, gbif/powo ids, or a non-mock source label", async () => {
    for (const organ of ["leaf", "flower", "fruit", "bark", "auto"] as const) {
      const result = await identifyMock({
        images: [JPEG_BYTES],
        organ,
        combinedHash: "a".repeat(64),
      });
      expect(result.sourceLabel).toBe("mock");
      for (const c of result.topResult.species) {
        expect(c.images).toEqual([]);
        expect(c.gbifId).toBeNull();
        expect(c.sources).toEqual(["mock"]);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* Live provider → Stage C normalizer contract (same checker)           */
/* ------------------------------------------------------------------ */

/** Builds an UpstreamIdentifyResponse from a documentation-derived fixture. */
function upstreamBody(results: unknown[], remaining: number | null = 431): UpstreamIdentifyResponse {
  return { results, remainingIdentificationRequests: remaining, raw: { results, remainingIdentificationRequests: remaining } };
}

async function liveIdentify(
  body: UpstreamIdentifyResponse,
  headers: Record<string, string> = { RateLimit: QUOTA_HEADERS.rateLimit }
): Promise<IdentifyProviderResult> {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json", ...headers },
      })
  );
  const provider = new PlantnetLiveProvider({
    apiKey: DUMMY_KEY,
    fetchImpl: fetchMock as unknown as typeof fetch,
  });
  const result = await provider.identify({
    images: [JPEG_BYTES],
    organ: "auto",
    combinedHash: "b".repeat(64),
  });
  expect(fetchMock).toHaveBeenCalledTimes(1); // one call, no retries
  return result;
}

describe("live provider — normalized contract parity via the Stage C normalizer", () => {
  it("a documentation-derived single result satisfies the SAME shared contract as mock", async () => {
    const result = await liveIdentify(upstreamBody([SINGLE_PLANT_RESULT]));
    const normalized = normalizeSpecies(result.topResult.species);
    expectNormalizedContract({
      topResult: { species: normalized },
      sourceLabel: result.sourceLabel,
    });
    expect(result.sourceLabel).toBe("pl@ntnet-v2");
  });

  it("multiple candidates: scores preserved exactly, ranks/bands assigned, cap respected", async () => {
    const result = await liveIdentify(upstreamBody(MULTIPLE_CANDIDATES_RESULTS));
    const normalized = normalizeSpecies(result.topResult.species);
    expectNormalizedContract({
      topResult: { species: normalized },
      sourceLabel: result.sourceLabel,
    });
    expect(normalized).toHaveLength(3);
    expect(normalized[0].score).toBe(0.91); // exact — never re-scaled
    expect(normalized[0].confidenceBand).toBe("exact");
    expect(normalized[1].score).toBe(0.55);
    expect(normalized[1].confidenceBand).toBe("likely");
    expect(normalized[2].score).toBe(0.2);
    expect(normalized[2].confidenceBand).toBe("possible");
  });

  it("scientific/common names + genus/family map identically to the mock fields", async () => {
    const result = await liveIdentify(upstreamBody([SINGLE_PLANT_RESULT]));
    const c = normalizeSpecies(result.topResult.species)[0];
    expect(c.scientificName).toBe("Ficus lyrata Warb."); // verbatim documented full name
    expect(c.commonNames).toEqual(["fiddle-leaf fig"]);
    expect(c.genus).toBe("Ficus");
    expect(c.family).toBe("Moraceae");
    // Mock-shape parity: the same fields exist with the same meaning.
    const mockC = (await identifyMock({ images: [JPEG_BYTES], organ: "auto", combinedHash: "0".repeat(64) }))
      .topResult.species[0];
    for (const key of ["rank", "scientificName", "commonNames", "family", "genus", "gbifId", "score", "confidenceBand", "sources", "images"] as const) {
      expect(key in c).toBe(true);
      expect(key in mockC).toBe(true);
    }
  });

  it("optional taxonomy identifiers: present/absent/odd variants map without invention", async () => {
    const withIds = normalizeSpecies((await liveIdentify(upstreamBody([SINGLE_PLANT_RESULT]))).topResult.species)[0];
    expect(withIds.gbifId).toBe(2870168); // digits-string → same number
    expect(withIds.powoId).toBe("5543396-1");

    const noIds = normalizeSpecies((await liveIdentify(upstreamBody([NO_TAXONOMY_IDS_RESULT]))).topResult.species)[0];
    expect(noIds.gbifId).toBeNull();
    expect(noIds.powoId).toBeNull();

    const noCommon = normalizeSpecies((await liveIdentify(upstreamBody([NO_COMMON_NAMES_RESULT]))).topResult.species)[0];
    expect(noCommon.commonNames).toEqual([]);
    expect(noCommon.family).toBe("Asphodelaceae");
    expect(noCommon.genus).toBeNull();

    for (const variant of ODD_TAXONOMY_ID_VARIANTS) {
      const c = normalizeSpecies((await liveIdentify(upstreamBody([{ score: 0.5, species: { scientificNameWithoutAuthor: "Aloe vera" }, ...variant }]))).topResult.species)[0];
      expect(c.gbifId === null || typeof c.gbifId === "number").toBe(true);
      expect(c.powoId === null || typeof c.powoId === "string").toBe(true);
    }
  });

  it("optional image metadata + attribution: only complete CC BY-SA images appear (mock parity: none fabricated)", async () => {
    const result = await liveIdentify(upstreamBody([SINGLE_PLANT_RESULT]));
    const c = normalizeSpecies(result.topResult.species)[0];
    expect(c.images).toHaveLength(1);
    const img = c.images[0];
    expect(img.license).toBe("cc-by-sa");
    expect(img.citation).toBe("Fabrice Rubio / Pl@ntNet, cc-by-sa"); // verbatim
    expect(img.attribution).toBe("Fabrice Rubio / Pl@ntNet, cc-by-sa"); // all three elements
    // Mock counterpart never fabricates imagery — same images[] contract slot.
    const mockC = (await identifyMock({ images: [JPEG_BYTES], organ: "auto", combinedHash: "0".repeat(64) }))
      .topResult.species[0];
    expect(mockC.images).toEqual([]);
  });

  it("empty upstream results → empty normalized list (route maps to 404 no_match_found); mock never returns empty", async () => {
    const result = await liveIdentify(upstreamBody(EMPTY_RESULTS_BODY.results));
    expect(result.topResult.species).toEqual([]);
    expect(normalizeSpecies(result.topResult.species)).toEqual([]);

    const mock = await identifyMock({ images: [JPEG_BYTES], organ: "auto", combinedHash: "0".repeat(64) });
    expect(mock.topResult.species.length).toBeGreaterThan(0); // mock is always non-empty
  });

  it("quota signals ride along identically in both header-derived and body-field forms (nothing invented)", async () => {
    // Body-field preference.
    const withBody = await liveIdentify(upstreamBody([SINGLE_PLANT_RESULT], REMAINING_BODY_VALUES[0]));
    expect(withBody.upstreamQuota?.remainingIdentificationRequests).toBe(431);
    // Header-only fallback carries the raw header opaquely.
    const headerOnly = await liveIdentify(upstreamBody([SINGLE_PLANT_RESULT], null));
    expect(headerOnly.upstreamQuota?.rateLimit).toBe(QUOTA_HEADERS.rateLimit);
    expect(headerOnly.upstreamQuota?.remainingIdentificationRequests).toBeNull();
    // Mock has no upstream quota (undefined) — the field is optional in the contract.
    const mock = await identifyMock({ images: [JPEG_BYTES], organ: "auto", combinedHash: "0".repeat(64) });
    expect(mock.upstreamQuota).toBeUndefined();
  });

  it("fixture provenance label is present and self-describing (never a recorded response)", () => {
    expect(FIXTURE_PROVENANCE).toMatch(/SYNTHETIC/i);
    expect(FIXTURE_PROVENANCE).toMatch(/NOT a real recorded/i);
  });
});
