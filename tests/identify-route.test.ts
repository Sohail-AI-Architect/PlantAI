/*
 * Stage D (2026-11-13) — /api/identify ROUTE regression + parity tests.
 *
 * Exercises the REAL route handler (POST) with the real validation, hashing,
 * dedup cache, rate limiter, and persistence write-guard, and mocked seams:
 * - Supabase server client (auth claims + plant_library care lookup) — stub,
 *   zero network, zero DB access.
 * - app_settings reader (deterministic limits).
 * - Provider seam (mock by default; swappable to error-throwing stubs to
 *   exercise the Stage B/C error taxonomy end-to-end).
 *
 * Safety: persistence stays OFF (env keys are removed in beforeEach and
 * restored in afterEach — values never printed); PLANTNET_MODE is untouched
 * (unset ⇒ mock); no external requests; the persistence spies wrap the REAL
 * functions so the write-guard behavior itself is what gets asserted.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "@/app/api/identify/route";
import { clearDedupCacheForTests } from "@/lib/identify/dedup-cache";
import { combinedImageHash } from "@/lib/identify/hash";
import { normalizeSpecies } from "@/lib/plantnet/normalize";
import { identifyMock } from "@/lib/plantnet/mock-provider";
import { persistIdentification, bumpCacheHitCount } from "@/lib/plantnet/persistence";
import { ProviderError, type SpeciesCandidate } from "@/lib/plantnet/types";

/* ------------------------------------------------------------------ */
/* Hoisted mock state (read at call time by the vi.mock factories)      */
/* ------------------------------------------------------------------ */

const providerState = vi.hoisted(() => ({
  mode: "mock" as "mock" | "live",
  /** When set, replaces the default (real mock) provider implementation. */
  identify: null as null | ((req: unknown) => Promise<unknown>),
}));

const supabaseState = vi.hoisted(() => ({
  /** plant_library care-summary row returned by the stubbed session client. */
  careRow: {
    id: "lib-11111111-1111-1111-1111-111111111111",
    slug: "monstera-deliciosa",
    watering: "Water when the top 2-3 cm of soil is dry",
    sunlight: "Bright, indirect light",
    soil: "Airy, well-draining mix",
    fertilizer: "Balanced liquid feed monthly in growth season",
  } as Record<string, unknown> | null,
}));

vi.mock("@/lib/plantnet/provider", () => ({
  getProvider: () => ({
    mode: providerState.mode,
    provider: {
      identify: async (req: unknown) => {
        if (providerState.identify) return providerState.identify(req);
        const { identifyMock } = await import("@/lib/plantnet/mock-provider");
        return identifyMock(req as Parameters<typeof identifyMock>[0]);
      },
    },
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: null } }) }, // anonymous
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: supabaseState.careRow, error: null }),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/settings", () => ({
  getIdentifyLimits: async () => ({
    anonymousPerDay: 5,
    authenticatedPerDay: 20,
    maxImages: 3,
    maxImageBytes: 10 * 1024 * 1024,
  }),
}));

// Spy wrappers around the REAL persistence functions — the actual write-guard
// behavior runs; the spies only record that the route invoked it (and that it
// returned null while persistence is OFF).
vi.mock("@/lib/plantnet/persistence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/plantnet/persistence")>();
  return {
    ...actual,
    persistIdentification: vi.fn(actual.persistIdentification),
    bumpCacheHitCount: vi.fn(actual.bumpCacheHitCount),
  };
});

/* ------------------------------------------------------------------ */
/* Environment hygiene (save/restore, never print values)               */
/* ------------------------------------------------------------------ */

const CONTROLLED_KEYS = [
  "PLANTNET_MODE",
  "PLANTNET_API_KEY",
  "PLANTAI_PERSISTENCE_ENABLED",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "IP_HASH_SALT",
] as const;
const savedEnv = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of CONTROLLED_KEYS) {
    if (!savedEnv.has(key)) savedEnv.set(key, process.env[key]);
    delete process.env[key];
  }
  providerState.mode = "mock";
  providerState.identify = null;
  supabaseState.careRow = { ...(supabaseState.careRow as Record<string, unknown>) };
  clearDedupCacheForTests();
});

afterEach(() => {
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/* Request helpers                                                      */
/* ------------------------------------------------------------------ */

let ipCounter = 0;
function uniqueIp(): string {
  ipCounter += 1;
  return `203.0.113.${ipCounter}`; // RFC 5737 documentation range
}

function jpegFile(name = "plant.jpg", size = 64): File {
  const bytes = new Uint8Array(size);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes[3] = 0xe0; // JPEG magic — passes the server-side sniff
  return new File([bytes], name, { type: "image/jpeg" });
}

function pngFile(name = "plant.png", size = 64): File {
  const bytes = new Uint8Array(size);
  bytes[0] = 0x89;
  bytes[1] = 0x50;
  bytes[2] = 0x4e;
  bytes[3] = 0x47;
  bytes[4] = 0x0d;
  bytes[5] = 0x0a;
  bytes[6] = 0x1a;
  bytes[7] = 0x0a; // full 8-byte PNG magic
  return new File([bytes], name, { type: "image/png" });
}

function makeRequest(options?: {
  files?: File[];
  organ?: string;
  latitude?: string;
  longitude?: string;
  ip?: string;
  extraHeaders?: Record<string, string>;
}): NextRequest {
  const form = new FormData();
  for (const file of options?.files ?? [jpegFile()]) form.append("images[]", file);
  if (options?.organ !== undefined) form.append("organ", options.organ);
  if (options?.latitude !== undefined) form.append("latitude", options.latitude);
  if (options?.longitude !== undefined) form.append("longitude", options.longitude);
  return new NextRequest("http://localhost:3000/api/identify", {
    method: "POST",
    body: form,
    headers: {
      "x-forwarded-for": options?.ip ?? uniqueIp(),
      ...(options?.extraHeaders ?? {}),
    },
  });
}

/** Stubbed SpeciesCandidate list for provider-seam substitution tests. */
function stubSpecies(score = 0.9): SpeciesCandidate[] {
  return [
    {
      rank: 0,
      scientificName: "Aloe vera",
      commonNames: ["aloe vera"],
      family: "Asphodelaceae",
      genus: "Aloe",
      gbifId: null,
      powoId: null,
      score,
      confidenceBand: "possible",
      sources: ["pl@ntnet-v2"],
      images: [],
    },
  ];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ------------------------------------------------------------------ */
/* Success path + response-structure stability                          */
/* ------------------------------------------------------------------ */

describe("POST /api/identify — mock success path (structure parity)", () => {
  it("mock identification succeeds with the stable, UI-compatible response structure", async () => {
    const file = jpegFile();
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Expected route output computed INDEPENDENTLY through the provider seam —
    // the route must return exactly the provider's normalized result.
    const expected = normalizeSpecies(
      (
        await identifyMock({
          images: [bytes],
          organ: "auto",
          combinedHash: combinedImageHash([bytes]),
        })
      ).topResult.species
    );

    const res = await POST(makeRequest({ files: [file] }));
    expect(res.status).toBe(200);

    const body = await res.json();
    // Envelope: exactly the documented IdentifySuccessPayload fields.
    expect(body.success).toBe(true);
    expect(body.cached).toBe(false);
    expect(body.mode).toBe("mock");
    expect(body.mockNotice).toBe(
      "Sample data — this result did not come from live Pl@ntNet identification."
    );
    expect(body.identificationId).toMatch(UUID_RE); // fallback id (persistence OFF)
    expect(typeof body.remainingQuota).toBe("number");
    expect(body.topResult.species).toHaveLength(5);

    // REGRESSION PARITY: route output ≡ deterministic provider output.
    expect(body.topResult.species).toEqual(expected);

    // Species contract — the exact fields the results UI reads.
    body.topResult.species.forEach((c: Record<string, unknown>, i: number) => {
      expect(c.rank).toBe(i + 1);
      expect(typeof c.scientificName).toBe("string");
      expect((c.scientificName as string).length).toBeGreaterThan(0);
      expect(Array.isArray(c.commonNames)).toBe(true);
      expect(typeof c.score).toBe("number");
      expect(["exact", "likely", "possible"]).toContain(c.confidenceBand);
      expect(c.sources).toEqual(["mock"]);
      // No image is ever rendered without valid attribution + license —
      // mock candidates carry none at all.
      expect(c.images).toEqual([]);
    });

    // careSummary resolved from OUR library (mocked session client, read-only).
    expect(body.careSummary).toEqual({
      watering: "Water when the top 2-3 cm of soil is dry",
      sunlight: "Bright, indirect light",
      soil: "Airy, well-draining mix",
      fertilizer: "Balanced liquid feed monthly in growth season",
      plantLibrarySlug: "monstera-deliciosa",
      plantLibraryId: "lib-11111111-1111-1111-1111-111111111111",
    });

    // Headers: stable rate-limit trio, no upstream header in mock mode.
    expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("4");
    expect(res.headers.get("X-RateLimit-Reset")).toMatch(/^\d+$/);
    expect(res.headers.get("X-RateLimit-Remaining-Upstream")).toBeNull();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("dedup cache: an identical repeat returns cached:true with the SAME identificationId and no second provider call", async () => {
    const providerCalls = vi.fn();
    providerState.identify = async (req) => {
      providerCalls();
      const { identifyMock } = await import("@/lib/plantnet/mock-provider");
      return identifyMock(req as Parameters<typeof identifyMock>[0]);
    };
    const first = await POST(makeRequest({ ip: "198.51.100.7", files: [pngFile()] }));
    const second = await POST(makeRequest({ ip: "198.51.100.7", files: [pngFile()] })); // same PNG bytes + organ
    const b1 = await first.json();
    const b2 = await second.json();
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(b2.cached).toBe(true);
    expect(b1.cached).toBe(false);
    expect(b2.identificationId).toBe(b1.identificationId);
    expect(b2.mockNotice).toBe(b1.mockNotice);
    expect(providerCalls).toHaveBeenCalledTimes(1); // provider ran once
  });

  it("mock responses have not unexpectedly changed: the response key set is frozen", async () => {
    const res = await POST(makeRequest({ ip: "198.51.100.8" }));
    const body = await res.json();
    // Exact envelope key set (additions/removals must be a conscious,
    // documented contract change — API_DOCUMENTATION.md §7).
    expect(Object.keys(body).sort()).toEqual([
      "cached",
      "careSummary",
      "identificationId",
      "mockNotice",
      "mode",
      "remainingQuota",
      "success",
      "topResult",
    ]);
    // Exact candidate key set (SpeciesCandidate + the mock-only library slug).
    expect(Object.keys(body.topResult.species[0]).sort()).toEqual([
      "commonNames",
      "confidenceBand",
      "family",
      "gbifId",
      "genus",
      "images",
      "plantLibrarySlug",
      "powoId",
      "rank",
      "scientificName",
      "score",
      "sources",
    ]);
  });
});

/* ------------------------------------------------------------------ */
/* Validation + rate-limit behavior (unchanged contracts)               */
/* ------------------------------------------------------------------ */

describe("POST /api/identify — production configuration gate", () => {
  it("returns a clean 503 provider_unavailable when no PLANTNET_API_KEY is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await POST(makeRequest({ ip: "198.51.100.90" }));
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("provider_unavailable");
      expect(body.error.message).not.toMatch(/plantnet|api[_-]?key/i);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      // The missing key is a server-config problem: no quota is consumed.
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("5");
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
      errorSpy.mockRestore();
    }
  });
});

describe("POST /api/identify — validation + rate limits (regression)", () => {
  it("invalid organ values (lateral/root) → 400 invalid_request BEFORE any provider call", async () => {
    const identifySpy = vi.fn(async (req: unknown) => {
      const { identifyMock } = await import("@/lib/plantnet/mock-provider");
      return identifyMock(req as Parameters<typeof identifyMock>[0]);
    });
    providerState.identify = identifySpy;
    for (const organ of ["lateral", "root"]) {
      const res = await POST(makeRequest({ organ, ip: "198.51.100.9" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("invalid_request");
      expect(body.details.some((d: { path: string }) => d.path === "organ")).toBe(true);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    }
    expect(identifySpy).not.toHaveBeenCalled(); // no upstream call, no credit burn
  });

  it("zero images → 400; unsupported image bytes → 400 unsupported_image; oversized image → 413", async () => {
    const none = await POST(
      makeRequest({ files: [], ip: "198.51.100.10" })
    );
    expect(none.status).toBe(400);
    expect((await none.json()).error.code).toBe("invalid_request");

    const bad = new File([new Uint8Array([0x00, 0x01, 0x02, 0x03])], "fake.jpg", { type: "image/jpeg" });
    const unsupported = await POST(makeRequest({ files: [bad], ip: "198.51.100.11" }));
    expect(unsupported.status).toBe(400);
    expect((await unsupported.json()).error.code).toBe("unsupported_image");

    const bigBytes = new Uint8Array(10 * 1024 * 1024 + 1);
    bigBytes[0] = 0xff;
    bigBytes[1] = 0xd8;
    bigBytes[2] = 0xff;
    bigBytes[3] = 0xe0;
    const huge = new File([bigBytes], "big.jpg", { type: "image/jpeg" });
    const oversized = await POST(makeRequest({ files: [huge], ip: "198.51.100.12" }));
    expect(oversized.status).toBe(413);
    expect((await oversized.json()).error.code).toBe("image_too_large");
  });

  it("body-size guard: declared content-length over the cap → 413 before parsing", async () => {
    const res = await POST(
      makeRequest({ ip: "198.51.100.13", extraHeaders: { "content-length": "40000000" } })
    );
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe("image_too_large");
  });

  it("failed validation does NOT consume the daily budget; the 6th valid request hits 429", async () => {
    const ip = "198.51.100.14";
    // Two failed (unbilled) attempts.
    for (const organ of ["lateral", "root"]) {
      const res = await POST(makeRequest({ organ, ip }));
      expect(res.status).toBe(400);
    }
    // Five valid requests exhaust the anonymous daily limit of 5.
    for (let i = 0; i < 5; i++) {
      const res = await POST(makeRequest({ ip }));
      expect(res.status).toBe(200);
      expect((await res.json()).remainingQuota).toBe(4 - i);
    }
    const sixth = await POST(makeRequest({ ip }));
    expect(sixth.status).toBe(429);
    const body = await sixth.json();
    expect(body.error.code).toBe("daily_limit_reached");
    expect(body.nextResetUTC).toMatch(/Z$/);
    expect(body.remainingQuota).toBe(0);
    expect(sixth.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("the dedup cache hit still receives a correct rate-limit + no-store response", async () => {
    const ip = "198.51.100.15";
    await POST(makeRequest({ ip }));
    const second = await POST(makeRequest({ ip }));
    expect(second.headers.get("Cache-Control")).toBe("no-store");
    expect(second.headers.get("X-RateLimit-Remaining")).toBe("3");
    expect((await second.json()).cached).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* GPS both-or-neither (V7, API_DOCUMENTATION.md §2.9)                   */
/* ------------------------------------------------------------------ */

describe("POST /api/identify — GPS validation (V7 both-or-neither)", () => {
  const identifySpy = vi.fn(async (req: unknown) => {
    const { identifyMock } = await import("@/lib/plantnet/mock-provider");
    return identifyMock(req as Parameters<typeof identifyMock>[0]);
  });

  beforeEach(() => {
    providerState.identify = identifySpy;
    identifySpy.mockClear();
  });

  it("latitude only → 400 invalid_request with a _root detail; NO provider call", async () => {
    const res = await POST(makeRequest({ latitude: "48.8566", ip: "198.51.100.20" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("invalid_request");
    expect(body.details.some((d: { path: string }) => d.path === "_root")).toBe(true);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(identifySpy).not.toHaveBeenCalled(); // error-credit-burns rule
  });

  it("longitude only → 400 invalid_request with a _root detail; NO provider call", async () => {
    const res = await POST(makeRequest({ longitude: "2.3522", ip: "198.51.100.21" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("invalid_request");
    expect(body.details.some((d: { path: string }) => d.path === "_root")).toBe(true);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(identifySpy).not.toHaveBeenCalled();
  });

  it("both supplied → 200 success; GPS coordinates are never echoed back (upstream non-disclosure covered by live-provider.test.ts)", async () => {
    const res = await POST(
      makeRequest({ latitude: "48.8566", longitude: "2.3522", ip: "198.51.100.22" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(identifySpy).toHaveBeenCalledTimes(1);
    // The response never contains GPS data, and nothing geographic appears in
    // the payload — GPS is a regional hint only, never identification input.
    // (The live provider never serializes latitude/longitude into the upstream
    // request — asserted separately in tests/live-provider.test.ts.)
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("48.8566");
    expect(raw).not.toContain("2.3522");
    expect(raw.toLowerCase()).not.toContain("latitude");
    expect(raw.toLowerCase()).not.toContain("longitude");
  });

  it("neither supplied → 200 success (baseline GPS-less flow unchanged)", async () => {
    const res = await POST(makeRequest({ ip: "198.51.100.23" }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(identifySpy).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------------------------ */
/* Provider error taxonomy end-to-end (Stage B/C behavior via the route) */
/* ------------------------------------------------------------------ */

describe("POST /api/identify — provider error taxonomy (end-to-end, no crash, no leaks)", () => {
  function useProviderThrowing(error: Error, mode: "mock" | "live" = "live"): void {
    providerState.mode = mode;
    providerState.identify = async () => {
      throw error;
    };
  }

  it("upstream quota exhaustion (429) → 503 quota_exhausted + safe upstream remaining header; partition key never surfaces", async () => {
    useProviderThrowing(
      new ProviderError(
        "quota_exhausted",
        "The daily identification budget is exhausted.",
        429,
        {
          remainingIdentificationRequests: null,
          rateLimitPolicy: '"dailyQuota";q=500;w=86400;pk=user1-identify',
          rateLimit: '"dailyQuota";r=0;t=3600;pk=user1-identify',
          retryAfter: "Fri, 14 Nov 2026 00:00:00 GMT",
        }
      )
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(makeRequest({ ip: "198.51.100.16" }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("quota_exhausted");
    expect(body.error.message).toBe(
      "Our daily plant-recognition budget is exhausted; try again tomorrow."
    );
    expect(res.headers.get("X-RateLimit-Remaining-Upstream")).toBe("0");
    // Response NEVER leaks the URL/key/partition key/reset times.
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("pk=");
    expect(raw).not.toContain("https://");
    expect(raw).not.toContain("api-key");
    expect(raw).not.toContain("my-api.plantnet.org");
    // Logs are limited to the code + status — no URLs, keys, or bodies.
    const logged = errorSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).not.toContain("https://");
    expect(logged).not.toContain("api-key");
    expect(logged).not.toContain("pk=");
  });

  it("upstream_rejected (other 4xx) → 502; upstream_error (5xx/network) → 503; both no-store", async () => {
    useProviderThrowing(
      new ProviderError("upstream_rejected", "The upstream rejected the request.", 400)
    );
    const rejected = await POST(makeRequest({ ip: "198.51.100.17" }));
    expect(rejected.status).toBe(502);
    expect((await rejected.json()).error.code).toBe("upstream_rejected");

    useProviderThrowing(
      new ProviderError("upstream_error", "The upstream request failed.", 0)
    );
    const failed = await POST(makeRequest({ ip: "198.51.100.18" }));
    expect(failed.status).toBe(503);
    expect((await failed.json()).error.code).toBe("upstream_error");
    expect(failed.headers.get("Cache-Control")).toBe("no-store");
  });

  it("upstream no_match_found (404) → route 404 with the fixed friendly message", async () => {
    useProviderThrowing(
      new ProviderError("no_match_found", "Species not found.", 404)
    );
    const res = await POST(makeRequest({ ip: "198.51.100.19" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("no_match_found");
    expect(body.error.message).toBe(
      "No confident match — try better light, a closer leaf photo, or another angle."
    );
  });

  it("a non-ProviderError provider crash never breaks the route: 500 internal_error, generic message", async () => {
    providerState.mode = "live";
    providerState.identify = async () => {
      throw new Error("boom");
    };
    const res = await POST(makeRequest({ ip: "198.51.100.20" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).toBe(
      "Something went wrong on our side — the error has been logged."
    );
  });

  it("a provider returning NO valid candidates → 404 no_match_found (empty-results contract)", async () => {
    providerState.mode = "live";
    providerState.identify = async () => ({
      topResult: { species: [] },
      sourceLabel: "pl@ntnet-v2",
    });
    const res = await POST(makeRequest({ ip: "198.51.100.21" }));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("no_match_found");
  });
});

/* ------------------------------------------------------------------ */
/* Persistence OFF + mockNotice parity                                  */
/* ------------------------------------------------------------------ */

describe("POST /api/identify — persistence OFF + mock/live notice parity", () => {
  it("persistence OFF: the route asks the write-guard (which refuses); a fallback UUID id is issued; zero writes", async () => {
    const res = await POST(makeRequest({ ip: "198.51.100.22" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.identificationId).toMatch(UUID_RE);

    expect(vi.mocked(persistIdentification)).toHaveBeenCalledTimes(1);
    const [cap] = vi.mocked(persistIdentification).mock.calls[0];
    expect(cap.available).toBe(false); // write-guard capability unavailable
    expect(cap.client).toBeNull(); // no privileged client constructed
    const returned = await Promise.all(
      vi.mocked(persistIdentification).mock.results.map((r) => r.value)
    );
    expect(returned).toContain(null); // the real guard returned null (OFF)
  });

  it("persistence OFF: cached-hit hit-count bumps are attempted through the guard and write nothing", async () => {
    const ip = "198.51.100.23";
    await POST(makeRequest({ ip }));
    await POST(makeRequest({ ip })); // cache hit
    expect(vi.mocked(bumpCacheHitCount)).toHaveBeenCalledTimes(1);
    const [cap] = vi.mocked(bumpCacheHitCount).mock.calls[0];
    expect(cap.available).toBe(false);
  });

  it("mockNotice appears ONLY in mock mode; a live-mode provider response omits it entirely", async () => {
    providerState.mode = "live";
    providerState.identify = async () => ({
      topResult: { species: stubSpecies(0.9) },
      sourceLabel: "pl@ntnet-v2",
      upstreamQuota: {
        remainingIdentificationRequests: 498,
        rateLimitPolicy: '"dailyQuota";q=500;w=86400',
        rateLimit: '"dailyQuota";r=498;t=3600',
        retryAfter: null,
      },
    });
    const res = await POST(makeRequest({ ip: "198.51.100.24" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe("live");
    expect(body).not.toHaveProperty("mockNotice"); // never a fake label on live results
    expect(body.topResult.species[0].sources).toEqual(["pl@ntnet-v2"]);
    // Same normalized species contract in both modes.
    expect(body.topResult.species[0].rank).toBe(1);
    expect(body.topResult.species[0].confidenceBand).toBe("exact");
    // Safe upstream quota visibility on live success (body-field preference).
    expect(res.headers.get("X-RateLimit-Remaining-Upstream")).toBe("498");
    // Mock counterpart for contrast (seam reset to the real mock provider;
    // different image bytes so the dedup cache cannot return the live payload).
    providerState.mode = "mock";
    providerState.identify = null;
    const otherFile = jpegFile("other.jpg", 128); // different bytes → different hash
    const mockRes = await POST(makeRequest({ files: [otherFile], ip: "198.51.100.25" }));
    const mockBody = await mockRes.json();
    expect(mockBody.mode).toBe("mock");
    expect(typeof mockBody.mockNotice).toBe("string");
  });
});
