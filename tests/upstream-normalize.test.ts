/*
 * Stage C (2026-11-13) — offline tests for upstream response normalization,
 * image license/attribution enforcement, organ validation, candidate limits,
 * quota-header parsing, and mock-provider compatibility.
 *
 * Fixtures below mirror the VERIFIED Stage A1 upstream field shapes
 * (docs/VERIFIED_FACTS.md / API_DOCUMENTATION.md §2.8). Image URLs are
 * clearly offline placeholders — NO real network request is ever made by
 * these tests (the live provider is exercised only through pure functions
 * and, for the quota-propagation case, a stubbed fetch with a dummy key).
 */
import { describe, expect, it, vi } from "vitest";

import {
  isRenderableLicense,
  mapUpstreamResultEntry,
  normalizeSpecies,
  normalizeUpstreamResponse,
} from "@/lib/plantnet/normalize";
import { parseRateLimitRemaining, PlantnetLiveProvider } from "@/lib/plantnet/live-provider";
import { ORGANS, UPSTREAM_ORGAN_VALUES } from "@/lib/plantnet/organs";
import { identifyRequestSchema, organSchema } from "@/lib/validation/identify";
import { identifyMock } from "@/lib/plantnet/mock-provider";
import type { UpstreamIdentifyResponse } from "@/lib/plantnet/types";

/* ------------------------------------------------------------------ */
/* Fixtures (verified official field shapes; offline placeholder URLs)  */
/* ------------------------------------------------------------------ */

/** A fully-populated, documented-shape upstream result.
 * Nesting mirrors the official identify output example exactly:
 * - `commonNames`, `family`, `genus` live INSIDE `species`;
 * - `gbif` / `powo` are TOP-LEVEL result siblings with string ids
 *   (official example: gbif.id "2927079", powo.id "444576-1"). */
const FULL_RESULT = {
  score: 0.87,
  species: {
    scientificNameWithoutAuthor: "Monstera deliciosa",
    scientificNameAuthorship: "(G.Forst.) Engl. & K.Krause",
    scientificName: "Monstera deliciosa (G.Forst.) Engl. & K.Krause",
    commonNames: ["swiss cheese plant", "ceriman"],
    family: { scientificNameWithoutAuthor: "Araceae" },
    genus: { scientificNameWithoutAuthor: "Monstera" },
  },
  gbif: { id: "2870168" }, // string form per the official example
  powo: { id: "444576-1" },
  images: [
    {
      author: "Fabrice Rubio",
      license: "cc-by-sa",
      citation: "Fabrice Rubio / Pl@ntNet, cc-by-sa",
      // Offline placeholder URLs standing in for the documented url{m,o,s} sizes.
      url: {
        o: "https://fixture.invalid/img-o.jpg",
        m: "https://fixture.invalid/img-m.jpg",
        s: "https://fixture.invalid/img-s.jpg",
      },
    },
  ],
};

function response(results: unknown[], remaining: number | null = null): UpstreamIdentifyResponse {
  return { results, remainingIdentificationRequests: remaining, raw: { results } };
}

/* ------------------------------------------------------------------ */
/* Normalization                                                        */
/* ------------------------------------------------------------------ */

describe("Stage C upstream response normalization", () => {
  it("maps a valid species result into the existing PlantAI candidate shape", () => {
    const out = normalizeUpstreamResponse(response([FULL_RESULT]));
    expect(out.topResult.species).toHaveLength(1);
    const c = out.topResult.species[0];
    // Full documented name used verbatim (no invention).
    expect(c.scientificName).toBe("Monstera deliciosa (G.Forst.) Engl. & K.Krause");
    expect(c.commonNames).toEqual(["swiss cheese plant", "ceriman"]);
    expect(c.family).toBe("Araceae");
    expect(c.genus).toBe("Monstera");
    expect(c.gbifId).toBe(2870168); // digits-only string → same number (official string form)
    expect(c.powoId).toBe("444576-1");
    // Score preserved ACCURATELY (never re-scaled or clamped).
    expect(c.score).toBe(0.87);
    expect(c.sources).toEqual(["pl@ntnet-v2"]);
  });

  it("maps multiple candidate results in upstream order (route re-ranks)", () => {
    const second = {
      score: 0.42,
      species: { scientificNameWithoutAuthor: "Epipremnum aureum", commonNames: ["golden pothos"] },
    };
    const out = normalizeUpstreamResponse(response([FULL_RESULT, second]));
    expect(out.topResult.species).toHaveLength(2);
    expect(out.topResult.species[0].scientificName).toContain("Monstera deliciosa");
    expect(out.topResult.species[1].scientificName).toBe("Epipremnum aureum");
    expect(out.topResult.species[1].score).toBe(0.42);
  });

  it("handles missing common names and missing taxonomy identifiers defensively", () => {
    const bare = {
      score: 0.5,
      species: { scientificNameWithoutAuthor: "Aloe vera" },
    };
    const c = mapUpstreamResultEntry(bare)!;
    expect(c).not.toBeNull();
    expect(c.commonNames).toEqual([]);
    expect(c.family).toBeNull();
    expect(c.genus).toBeNull();
    expect(c.gbifId).toBeNull();
    expect(c.powoId).toBeNull();
    expect(c.images).toEqual([]);
  });

  it("accepts numeric gbif ids; non-digit strings stay null; numeric powo ids become strings", () => {
    const numeric = mapUpstreamResultEntry({
      score: 0.5,
      species: { scientificNameWithoutAuthor: "Aloe vera" },
      gbif: { id: 2870168 },
      powo: { id: "444576-1" },
    })!;
    expect(numeric.gbifId).toBe(2870168);
    expect(numeric.powoId).toBe("444576-1");

    const defensive = mapUpstreamResultEntry({
      score: 0.5,
      species: { scientificNameWithoutAuthor: "Aloe vera" },
      gbif: { id: "not-a-number" },
      powo: { id: 42 },
    })!;
    expect(defensive.gbifId).toBeNull(); // non-digit string never guessed
    expect(defensive.powoId).toBe("42"); // number → verbatim string, value preserved
  });

  it("composes the scientific name from documented fields when scientificName is absent", () => {
    const withAuthorship = mapUpstreamResultEntry({
      score: 0.6,
      species: {
        scientificNameWithoutAuthor: "Ficus lyrata",
        scientificNameAuthorship: "Warb.",
      },
    })!;
    expect(withAuthorship.scientificName).toBe("Ficus lyrata Warb.");

    const withoutAuthorship = mapUpstreamResultEntry({
      score: 0.6,
      species: { scientificNameWithoutAuthor: "Ficus elastica" },
    })!;
    expect(withoutAuthorship.scientificName).toBe("Ficus elastica");
  });

  it("HTTP 200 with empty results produces an empty list (route maps to no_match_found)", () => {
    const out = normalizeUpstreamResponse(response([]));
    expect(out.topResult.species).toEqual([]);
  });

  it("skips malformed entries without inventing names, scores, or identifiers", () => {
    const malformed: unknown[] = [
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
      { score: 0.5, species: {} }, // no name field at all
      { score: 0.5, species: { scientificNameWithoutAuthor: "   " } }, // blank name
    ];
    const out = normalizeUpstreamResponse(response(malformed));
    expect(out.topResult.species).toEqual([]);
  });

  it("keeps valid candidates beside malformed ones (defensive, not all-or-nothing)", () => {
    const out = normalizeUpstreamResponse(
      response([null, FULL_RESULT, { score: "bad" }, FULL_RESULT])
    );
    expect(out.topResult.species).toHaveLength(2);
    expect(out.topResult.species[0].score).toBe(0.87);
  });

  it("preserves unusual-but-valid scores exactly", () => {
    const c = mapUpstreamResultEntry({
      score: 0.123456789,
      species: { scientificNameWithoutAuthor: "Aloe vera" },
    })!;
    expect(c.score).toBe(0.123456789);
  });
});

/* ------------------------------------------------------------------ */
/* Candidate limits (existing rules)                                    */
/* ------------------------------------------------------------------ */

describe("candidate limits", () => {
  it("normalizeSpecies caps at the documented max-10 and assigns ranks/bands", () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      rank: 0,
      scientificName: `Species ${i}`,
      commonNames: [] as string[],
      family: null,
      genus: null,
      gbifId: null,
      powoId: null,
      score: Math.max(0.01, 0.9 - i * 0.05),
      sources: ["pl@ntnet-v2"],
      images: [],
    }));
    const out = normalizeSpecies(many);
    expect(out).toHaveLength(10);
    expect(out[0].rank).toBe(1);
    expect(out[0].confidenceBand).toBe("exact");
    expect(out[9].rank).toBe(10);
    // Score-descending order preserved.
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1].score).toBeGreaterThanOrEqual(out[i].score);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Image license + attribution enforcement (Stage A1 display rule)       */
/* ------------------------------------------------------------------ */

describe("image license and attribution enforcement", () => {
  it("isRenderableLicense is conservative and case-insensitive (documented CC BY-SA only)", () => {
    expect(isRenderableLicense("cc-by-sa")).toBe(true);
    expect(isRenderableLicense("CC BY-SA")).toBe(true);
    expect(isRenderableLicense("CC_BY_SA")).toBe(true);
    expect(isRenderableLicense("  cc by sa  ")).toBe(true);
    expect(isRenderableLicense("CC-BY-NC")).toBe(false); // unsupported
    expect(isRenderableLicense("cc-by-nc-sa")).toBe(false);
    expect(isRenderableLicense("proprietary")).toBe(false);
    expect(isRenderableLicense("")).toBe(false);
    expect(isRenderableLicense(null)).toBe(false);
    expect(isRenderableLicense(undefined)).toBe(false);
    expect(isRenderableLicense(42)).toBe(false);
  });

  it("keeps a CC BY-SA image with complete attribution and preserves returned metadata", () => {
    const c = mapUpstreamResultEntry(FULL_RESULT)!;
    expect(c.images).toHaveLength(1);
    const img = c.images[0];
    expect(img.url).toBe("https://fixture.invalid/img-m.jpg"); // m preferred among documented sizes
    expect(img.license).toBe("cc-by-sa");
    expect(img.citation).toBe("Fabrice Rubio / Pl@ntNet, cc-by-sa"); // verbatim
    expect(img.attribution).toBe("Fabrice Rubio / Pl@ntNet, cc-by-sa"); // contributor + Pl@ntNet + license
    expect(img.alt).toContain("Monstera deliciosa");
  });

  it.each([
    ["unsupported license", { author: "A", license: "CC-BY-NC", url: { m: "https://fixture.invalid/x.jpg" } }],
    ["missing license", { author: "A", url: { m: "https://fixture.invalid/x.jpg" } }],
    ["malformed license", { author: "A", license: 42, url: { m: "https://fixture.invalid/x.jpg" } }],
    ["missing author (incomplete attribution)", { license: "cc-by-sa", url: { m: "https://fixture.invalid/x.jpg" } }],
    ["blank author", { author: "   ", license: "cc-by-sa", url: { m: "https://fixture.invalid/x.jpg" } }],
    ["missing url object", { author: "A", license: "cc-by-sa" }],
    ["url object without usable sizes", { author: "A", license: "cc-by-sa", url: {} }],
    ["non-object image entry", "not-an-image"],
  ])("does NOT render an image with %s (candidate stays visible)", (_name, badImage) => {
    const c = mapUpstreamResultEntry({ ...FULL_RESULT, images: [badImage] })!;
    expect(c).not.toBeNull(); // candidate visible
    expect(c.images).toEqual([]); // image hidden
  });

  it("never fabricates attribution: citation composed only from actual author/license when citation absent", () => {
    const c = mapUpstreamResultEntry({
      score: 0.8,
      species: { scientificNameWithoutAuthor: "Aloe vera" },
      images: [
        { author: "Jane Doe", license: "CC BY-SA", url: { s: "https://fixture.invalid/s.jpg" } },
      ],
    })!;
    expect(c.images).toHaveLength(1);
    expect(c.images[0].attribution).toBe("Jane Doe / Pl@ntNet, CC BY-SA");
    expect(c.images[0].citation).toBe("Jane Doe / Pl@ntNet, CC BY-SA");
    expect(c.images[0].url).toBe("https://fixture.invalid/s.jpg"); // s fallback
  });

  it("one malformed image never invalidates the candidate's other images", () => {
    const good = {
      author: "Fabrice Rubio",
      license: "cc-by-sa",
      citation: "Fabrice Rubio / Pl@ntNet, cc-by-sa",
      url: { m: "https://fixture.invalid/good.jpg" },
    };
    const c = mapUpstreamResultEntry({
      ...FULL_RESULT,
      images: [null, good, { author: "X", license: "nope", url: { m: "https://fixture.invalid/bad.jpg" } }],
    })!;
    expect(c.images).toHaveLength(1);
    expect(c.images[0].url).toBe("https://fixture.invalid/good.jpg");
  });

  it("prefers the documented size order m → o → s", () => {
    const c = mapUpstreamResultEntry({
      score: 0.7,
      species: { scientificNameWithoutAuthor: "Aloe vera" },
      images: [
        {
          author: "A",
          license: "cc-by-sa",
          url: { o: "https://fixture.invalid/o.jpg", s: "https://fixture.invalid/s.jpg" },
        },
      ],
    })!;
    expect(c.images[0].url).toBe("https://fixture.invalid/o.jpg");
  });
});

/* ------------------------------------------------------------------ */
/* Attribution compliance audit (Stage A1 display rule, 2026-11-13)      */
/*                                                                      */
/* Every RENDERED Pl@ntNet CC BY-SA image must carry, in the attribution */
/* string: (1) the actual contributor/author, (2) the fixed Pl@ntNet     */
/* platform credit, (3) the applicable CC BY-SA license — and the        */
/* upstream citation is preserved verbatim when provided. Audit verdict: */
/* the composed template `${author} / Pl@ntNet, ${license}` satisfies    */
/* all three by construction (each element is gate-checked before        */
/* composition, and Pl@ntNet is a fixed string) — these tests LOCK that  */
/* guarantee so future edits cannot silently break it.                   */
/* ------------------------------------------------------------------ */

describe("attribution compliance audit — three required elements", () => {
  /** Every rendered image must contain author + fixed platform credit + license. */
  function expectCompleteAttribution(
    img: { author: string; attribution: string; license: string }
  ): void {
    expect(img.attribution).toContain(img.author); // (1) actual contributor
    expect(img.attribution).toContain("Pl@ntNet"); // (2) fixed platform credit
    expect(img.attribution).toContain(img.license); // (3) applicable license
  }

  it("scenario 1 — author + CC BY-SA + citation present: all three elements, citation verbatim", () => {
    const c = mapUpstreamResultEntry(FULL_RESULT)!;
    expect(c.images).toHaveLength(1);
    const img = c.images[0];
    expectCompleteAttribution({ author: "Fabrice Rubio", attribution: img.attribution, license: "cc-by-sa" });
    // Matches the documented attribution form (actual returned license casing).
    expect(img.attribution).toBe("Fabrice Rubio / Pl@ntNet, cc-by-sa");
    // (4) upstream citation preserved VERBATIM — not rewritten to attribution.
    expect(img.citation).toBe("Fabrice Rubio / Pl@ntNet, cc-by-sa");
  });

  it("scenario 2 — author + CC BY-SA + citation missing: fallback citation is the complete attribution", () => {
    const c = mapUpstreamResultEntry({
      score: 0.8,
      species: { scientificNameWithoutAuthor: "Aloe vera" },
      images: [{ author: "Jane Doe", license: "cc-by-sa", url: { m: "https://fixture.invalid/x.jpg" } }],
    })!;
    expect(c.images).toHaveLength(1);
    const img = c.images[0];
    expectCompleteAttribution({ author: "Jane Doe", attribution: img.attribution, license: "cc-by-sa" });
    // The fallback citation (no upstream citation provided) carries the same
    // three elements — it IS the composed attribution.
    expect(img.citation).toBe(img.attribution);
  });

  it("scenario 3 — verbatim license variants: attribution preserves the actual returned license value", () => {
    for (const license of ["cc-by-sa", "CC BY-SA", "CC_BY_SA", "cc by sa"]) {
      const c = mapUpstreamResultEntry({
        score: 0.6,
        species: { scientificNameWithoutAuthor: "Aloe vera" },
        images: [{ author: "Jane Doe", license, url: { m: "https://fixture.invalid/x.jpg" } }],
      })!;
      expect(c.images).toHaveLength(1); // all variants are the documented license
      expectCompleteAttribution({ author: "Jane Doe", attribution: c.images[0].attribution, license });
      expect(c.images[0].attribution).toBe(`Jane Doe / Pl@ntNet, ${license}`);
    }
  });

  it("scenarios 4–6 — missing author, missing/unsupported license, malformed metadata: never rendered, never a partial attribution", () => {
    const nonRenderable = [
      { url: { m: "https://fixture.invalid/x.jpg" } }, // author missing
      { author: "   ", url: { m: "https://fixture.invalid/x.jpg" } }, // author blank
      { author: "A", url: { m: "https://fixture.invalid/x.jpg" } }, // license missing
      { author: "A", license: "CC-BY-NC", url: { m: "https://fixture.invalid/x.jpg" } }, // unsupported
      { author: "A", license: 42, url: { m: "https://fixture.invalid/x.jpg" } }, // license malformed
      { author: "A", license: "cc-by-sa", url: {} }, // no usable url
      "not-an-image", // malformed entry
      null, // malformed entry
    ];
    for (const badImage of nonRenderable) {
      const c = mapUpstreamResultEntry({ ...FULL_RESULT, images: [badImage] })!;
      // Candidate stays visible; the image is hidden — so NO attribution
      // string (complete or partial) can ever be displayed.
      expect(c).not.toBeNull();
      expect(c.images).toEqual([]);
    }
  });

  it("only complete attributions ever exist in mapped candidates (invariant over mixed input)", () => {
    const c = mapUpstreamResultEntry({
      score: 0.9,
      species: { scientificNameWithoutAuthor: "Ficus lyrata" },
      images: [
        null,
        { author: "A", license: "nope", url: { m: "https://fixture.invalid/bad.jpg" } },
        { author: "Jane Doe", license: "cc-by-sa", url: { m: "https://fixture.invalid/ok.jpg" } },
      ],
    })!;
    expect(c.images).toHaveLength(1);
    for (const img of c.images) {
      expect(img.license).toBeDefined(); // renderable images always carry a license
      expectCompleteAttribution({ author: "Jane Doe", attribution: img.attribution, license: img.license as string });
      expect(img.attribution.startsWith("Jane Doe / Pl@ntNet, ")).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Organ validation (V6, Stage C correction)                            */
/* ------------------------------------------------------------------ */

describe("organ validation (shared canonical enum)", () => {
  it("accepts every verified organ value and trims/normalizes blanks", () => {
    for (const organ of ORGANS) {
      expect(organSchema.parse(organ)).toBe(organ);
    }
    expect(organSchema.parse("")).toBe("auto"); // blank ⇒ auto-detect
    expect(organSchema.parse(" leaf ")).toBe("leaf"); // trimmed then validated
    expect(organSchema.parse(undefined)).toBe("auto"); // default
  });

  it("rejects the invalid upstream values lateral/root (HTTP 400 before any upstream call)", () => {
    for (const invalid of ["lateral", "root", "stem", "LATERAL"]) {
      const verdict = organSchema.safeParse(invalid);
      expect(verdict.success).toBe(false);
    }
  });

  it("exposes exactly the upstream-valid non-auto set for the provider mapping", () => {
    expect(UPSTREAM_ORGAN_VALUES).toEqual(["leaf", "flower", "fruit", "bark"]);
    expect(ORGANS).toEqual(["leaf", "flower", "fruit", "bark", "auto"]);
  });
});

/* ------------------------------------------------------------------ */
/* GPS both-or-neither (V7, API_DOCUMENTATION.md §2.9)                   */
/* ------------------------------------------------------------------ */

describe("identifyRequestSchema — GPS both-or-neither (V7)", () => {
  const base = { organ: undefined };

  it("neither supplied → valid (schema does not invent GPS)", () => {
    const verdict = identifyRequestSchema.safeParse(base);
    expect(verdict.success).toBe(true);
    expect(verdict.success && verdict.data.latitude).toBeUndefined();
    expect(verdict.success && verdict.data.longitude).toBeUndefined();
  });

  it("both supplied (in range) → valid", () => {
    const verdict = identifyRequestSchema.safeParse({
      ...base,
      latitude: "48.8566",
      longitude: "2.3522",
    });
    expect(verdict.success).toBe(true);
    expect(verdict.success && verdict.data.latitude).toBeCloseTo(48.8566);
    expect(verdict.success && verdict.data.longitude).toBeCloseTo(2.3522);
  });

  it("latitude only → invalid (route surfaces this as HTTP 400)", () => {
    const verdict = identifyRequestSchema.safeParse({ ...base, latitude: "48.8566" });
    expect(verdict.success).toBe(false);
    if (!verdict.success) {
      expect(verdict.error.issues.some((i) => /together/.test(i.message))).toBe(true);
    }
  });

  it("longitude only → invalid (route surfaces this as HTTP 400)", () => {
    const verdict = identifyRequestSchema.safeParse({ ...base, longitude: "2.3522" });
    expect(verdict.success).toBe(false);
    if (!verdict.success) {
      expect(verdict.error.issues.some((i) => /together/.test(i.message))).toBe(true);
    }
  });

  it("out-of-range values are still rejected independently of the pair rule", () => {
    expect(identifyRequestSchema.safeParse({ ...base, latitude: "91", longitude: "2" }).success).toBe(false);
    expect(identifyRequestSchema.safeParse({ ...base, latitude: "48", longitude: "181" }).success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Quota header parsing + remaining propagation (safe sources only)      */
/* ------------------------------------------------------------------ */

describe("upstream quota visibility", () => {
  it("parseRateLimitRemaining extracts only the r= value from the documented header", () => {
    expect(parseRateLimitRemaining('"dailyQuota";r=123;t=3600;pk=user1-identify')).toBe(123);
    expect(parseRateLimitRemaining('"dailyQuota";q=500;w=86400;pk=x; r=7 ;t=60')).toBe(7);
    expect(parseRateLimitRemaining("r=0")).toBe(0);
    expect(parseRateLimitRemaining('"dailyQuota"')).toBeNull(); // no r= component
    expect(parseRateLimitRemaining("r=abc")).toBeNull();
    expect(parseRateLimitRemaining("")).toBeNull();
    expect(parseRateLimitRemaining(null)).toBeNull();
    expect(parseRateLimitRemaining(undefined)).toBeNull();
  });

  it("propagates the remaining value from the RateLimit header when the body field is absent", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ results: [] }), // no remainingIdentificationRequests field
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            RateLimit: '"dailyQuota";r=321;t=3600;pk=user1-identify',
          },
        }
      )
    );
    const provider = new PlantnetLiveProvider({
      apiKey: "test-dummy-key-not-a-real-credential",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const out = await provider.identify({
      images: [new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2])],
      organ: "auto",
      combinedHash: "e".repeat(64),
    });
    expect(out.upstreamQuota?.rateLimit).toBe('"dailyQuota";r=321;t=3600;pk=user1-identify');
    // The safe derived value the route would expose (partition key never travels).
    expect(parseRateLimitRemaining(out.upstreamQuota?.rateLimit)).toBe(321);
    expect(out.topResult.species).toEqual([]); // empty upstream results stay empty
  });
});

/* ------------------------------------------------------------------ */
/* Mock provider compatibility (all valid organs)                       */
/* ------------------------------------------------------------------ */

describe("mock provider compatibility after the enum correction", () => {
  it("works for every valid organ value with the new SpeciesImage shape", async () => {
    for (const organ of ORGANS) {
      const out = await identifyMock({
        images: [new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2])],
        organ,
        combinedHash: "a".repeat(64),
      });
      expect(out.sourceLabel).toBe("mock");
      expect(out.topResult.species.length).toBeGreaterThan(0);
      expect(out.topResult.species[0].images).toEqual([]); // mock never fabricates imagery
    }
  });
});
