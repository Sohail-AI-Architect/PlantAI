/*
 * Stage B (2026-11-13) — offline tests for the server-only live Pl@ntNet
 * provider and the provider seam wiring.
 *
 * HARD RULES honored by this file:
 * - NO real network I/O: `fetch` is always a vi.fn() stub (or an injected
 *   impl) — no request ever leaves the process.
 * - ONLY dummy credentials ("test-dummy-key-..." strings) — the real API key
 *   is never read, never needed, never printed.
 * - PLANTNET_MODE / PLANTNET_API_KEY are saved + restored around every test;
 *   the enforced repo state (mock, no key activation) is untouched.
 * - No Supabase, no Storage, no database access of any kind.
 *
 * Covers: endpoint/project, api-key query parameter (no Authorization
 * header), repeated `organs` in image order, omitted organs = auto-detect,
 * invalid organ values never sent, JPEG/PNG MIME from magic bytes, 20 s
 * timeout via AbortController, no automatic retry, verified error mapping
 * (404/429/other-4xx/5xx/network), URL/key redaction in errors, Stage C
 * boundary behavior, mock mode never calls fetch (and never constructs the
 * live provider), and client-side import protection (server-only guard).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getProvider } from "@/lib/plantnet/provider";
import {
  DEFAULT_PROJECT,
  PLANTNET_API_ORIGIN,
  UPSTREAM_TIMEOUT_MS,
  PlantnetLiveProvider,
  buildUpstreamUrl,
  detectImageMime,
  redactUrlForLogs,
} from "@/lib/plantnet/live-provider";
import {
  ProviderError,
  type IdentifyProviderRequest,
  type SpeciesCandidate,
  type UpstreamIdentifyResponse,
  type UpstreamNormalizer,
} from "@/lib/plantnet/types";

/* ------------------------------------------------------------------ */
/* Environment + fetch hygiene (dummy credentials ONLY)                 */
/* ------------------------------------------------------------------ */

const DUMMY_KEY = "test-dummy-key-not-a-real-credential";

const CONTROLLED_KEYS = ["PLANTNET_MODE", "PLANTNET_API_KEY"] as const;
const savedEnv = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of CONTROLLED_KEYS) {
    if (!savedEnv.has(key)) savedEnv.set(key, process.env[key]);
    delete process.env[key];
  }
});

afterEach(() => {
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/* ------------------------------------------------------------------ */
/* Test doubles                                                         */
/* ------------------------------------------------------------------ */

/** JPEG (FF D8 FF) / PNG (89 50 4E 47) magic-byte fixtures. */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function req(organ: string, images: Uint8Array[] = [JPEG]): IdentifyProviderRequest {
  return { images, organ, combinedHash: "f".repeat(64) };
}

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

/** Normalizer test double: records the parsed upstream response it receives. */
function makeRecordingNormalizer(): {
  normalizer: UpstreamNormalizer;
  seen: UpstreamIdentifyResponse[];
  result: { topResult: { species: SpeciesCandidate[] } };
} {
  const seen: UpstreamIdentifyResponse[] = [];
  const species: SpeciesCandidate[] = [
    {
      rank: 0,
      scientificName: "Test species",
      commonNames: [],
      gbifId: null,
      score: 0.9,
      sources: ["pl@ntnet-v2"],
      images: [],
      confidenceBand: "possible",
    },
  ];
  return {
    normalizer: (response) => {
      seen.push(response);
      return { topResult: { species } };
    },
    seen,
    result: { topResult: { species } },
  };
}

function makeProvider(overrides: {
  fetchImpl?: typeof fetch;
  normalizer?: UpstreamNormalizer;
}): PlantnetLiveProvider {
  const { normalizer } = makeRecordingNormalizer();
  return new PlantnetLiveProvider({
    apiKey: DUMMY_KEY,
    fetchImpl: overrides.fetchImpl,
    normalizer: overrides.normalizer ?? normalizer,
  });
}

/* ------------------------------------------------------------------ */
/* Request construction                                                 */
/* ------------------------------------------------------------------ */

describe("live provider request construction", () => {
  it("POSTs to https://my-api.plantnet.org/v2/identify/all with the api-key query parameter", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { results: [] }));
    await makeProvider({ fetchImpl: fetchMock as unknown as typeof fetch }).identify(
      req("auto")
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url).toBeInstanceOf(URL);
    expect(`${url.protocol}//${url.host}`).toBe(PLANTNET_API_ORIGIN);
    expect(url.pathname).toBe(`/v2/identify/${DEFAULT_PROJECT}`);
    expect(init.method).toBe("POST");
    // Verified auth: api-key as a query parameter (exactly once).
    expect(url.searchParams.getAll("api-key")).toEqual([DUMMY_KEY]);
    expect(Array.from(url.searchParams.keys())).toEqual(["api-key"]);
  });

  it("does NOT set an Authorization header (query-param auth only)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { results: [] }));
    await makeProvider({ fetchImpl: fetchMock as unknown as typeof fetch }).identify(
      req("leaf")
    );
    const [, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    const headers = new Headers(init.headers ?? []);
    expect(headers.has("authorization")).toBe(false);
  });

  it("appends repeated `images` fields and repeated `organs` fields (one per image, in image order)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { results: [] }));
    await makeProvider({ fetchImpl: fetchMock as unknown as typeof fetch }).identify(
      req("leaf", [JPEG, PNG, JPEG])
    );
    const [, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    const form = init.body as FormData;
    expect(form.getAll("images")).toHaveLength(3);
    const organs = form.getAll("organs");
    expect(organs).toEqual(["leaf", "leaf", "leaf"]);
  });

  it("omits the organs field entirely for automatic detection (organ = auto)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { results: [] }));
    await makeProvider({ fetchImpl: fetchMock as unknown as typeof fetch }).identify(
      req("auto")
    );
    const [, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    const form = init.body as FormData;
    expect(form.has("organs")).toBe(false);
  });

  it("never transmits the flagged invalid organ values lateral/root (falls back to auto-detect)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { results: [] }));
    for (const organ of ["lateral", "root"]) {
      await makeProvider({ fetchImpl: fetchMock as unknown as typeof fetch }).identify(
        req(organ)
      );
      const [, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as unknown as [
        URL,
        RequestInit,
      ];
      const form = init.body as FormData;
      expect(form.getAll("organs")).toEqual([]);
    }
  });

  it("appends images with the correct JPEG/PNG MIME type detected from magic bytes", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { results: [] }));
    await makeProvider({ fetchImpl: fetchMock as unknown as typeof fetch }).identify(
      req("auto", [JPEG, PNG])
    );
    const [, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    const blobs = init.body as FormData;
    const images = blobs.getAll("images") as Blob[];
    expect(images).toHaveLength(2);
    expect(images[0].type).toBe("image/jpeg");
    expect(images[1].type).toBe("image/png");
  });

  it("never sends location, identity, or deprecated parameters", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { results: [] }));
    await makeProvider({ fetchImpl: fetchMock as unknown as typeof fetch }).identify({
      ...req("leaf", [JPEG]),
      latitude: 48.85,
      longitude: 2.35,
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    const form = init.body as FormData;
    for (const field of ["latitude", "longitude", "email", "ip", "user_id", "type"]) {
      expect(form.has(field)).toBe(false);
    }
    for (const param of ["latitude", "longitude", "email"]) {
      expect(url.searchParams.has(param)).toBe(false);
    }
  });

  it("detectImageMime unit behavior (defensive magic-byte sniffing)", () => {
    expect(detectImageMime(JPEG)).toBe("image/jpeg");
    expect(detectImageMime(PNG)).toBe("image/png");
    expect(detectImageMime(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Timeout + no-retry behavior                                          */
/* ------------------------------------------------------------------ */

describe("live provider timeout and retry policy", () => {
  it("aborts after the 20 s timeout and maps it to upstream_error (single attempt)", async () => {
    vi.useFakeTimers();
    const hanging = vi.fn(
      (_url: URL, init: RequestInit): Promise<Response> =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new Error("The operation was aborted"))
          );
        })
    );
    const provider = makeProvider({ fetchImpl: hanging as unknown as typeof fetch });
    const pending = provider.identify(req("auto"));
    const assertion = expect(pending).rejects.toMatchObject({ code: "upstream_error" });
    await vi.advanceTimersByTimeAsync(UPSTREAM_TIMEOUT_MS);
    await assertion;
    expect(hanging).toHaveBeenCalledTimes(1);
  });

  it("never retries: a network failure surfaces once as upstream_error", async () => {
    const failing = vi.fn(async (): Promise<Response> => {
      throw new TypeError("fetch failed");
    });
    const provider = makeProvider({ fetchImpl: failing as unknown as typeof fetch });
    await expect(provider.identify(req("auto"))).rejects.toMatchObject({
      code: "upstream_error",
    });
    expect(failing).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------------------------ */
/* Verified error mapping                                               */
/* ------------------------------------------------------------------ */

describe("live provider error mapping (Stage A1 taxonomy)", () => {
  const cases: {
    name: string;
    status: number;
    expectedCode: ProviderError["code"];
  }[] = [
    { name: "404 → no_match_found (non-plant image)", status: 404, expectedCode: "no_match_found" },
    { name: "429 → quota_exhausted (no retry)", status: 429, expectedCode: "quota_exhausted" },
    { name: "400 → upstream_rejected", status: 400, expectedCode: "upstream_rejected" },
    { name: "401 → upstream_rejected", status: 401, expectedCode: "upstream_rejected" },
    { name: "403 → upstream_rejected", status: 403, expectedCode: "upstream_rejected" },
    { name: "500 → upstream_error", status: 500, expectedCode: "upstream_error" },
    { name: "503 → upstream_error", status: 503, expectedCode: "upstream_error" },
  ];

  for (const c of cases) {
    it(c.name, async () => {
      const fetchMock = vi.fn(async () =>
        jsonResponse(c.status, { error: "upstream error body" })
      );
      const provider = makeProvider({ fetchImpl: fetchMock as unknown as typeof fetch });
      const err = await provider.identify(req("auto")).then(
        () => {
          throw new Error("expected the provider to throw");
        },
        (e: unknown) => e as ProviderError
      );
      expect(err).toBeInstanceOf(ProviderError);
      expect(err.code).toBe(c.expectedCode);
      expect(err.httpStatus).toBe(c.status);
      expect(fetchMock).toHaveBeenCalledTimes(1); // no automatic retry
    });
  }

  it("captures Retry-After (and the other quota headers) on a 429", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(429, { error: "quota" }, {
        "RateLimit-Policy": '"dailyQuota";q=500;w=86400',
        RateLimit: '"dailyQuota";r=0;t=3600',
        "Retry-After": "Wed, 13 Nov 2026 00:00:00 GMT",
      })
    );
    const provider = makeProvider({ fetchImpl: fetchMock as unknown as typeof fetch });
    const err = (await provider.identify(req("auto")).then(
      () => null,
      (e: unknown) => e as ProviderError
    )) as ProviderError;
    expect(err.code).toBe("quota_exhausted");
    expect(err.upstreamQuota?.retryAfter).toBe("Wed, 13 Nov 2026 00:00:00 GMT");
    expect(err.upstreamQuota?.rateLimit).toBe('"dailyQuota";r=0;t=3600');
    expect(err.upstreamQuota?.rateLimitPolicy).toBe('"dailyQuota";q=500;w=86400');
  });
});

/* ------------------------------------------------------------------ */
/* 200 path: conservative parse + Stage C boundary                      */
/* ------------------------------------------------------------------ */

describe("live provider 200 path (conservative parse + Stage C boundary)", () => {
  it("parses the documented fields, captures quota signals, and hands the response to the normalizer", async () => {
    const { normalizer, seen, result } = makeRecordingNormalizer();
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        200,
        { results: [{ score: 0.9 }], remainingIdentificationRequests: 123 },
        {
          "RateLimit-Policy": '"dailyQuota";q=500;w=86400',
          RateLimit: '"dailyQuota";r=123;t=3600',
        }
      )
    );
    const out = await makeProvider({
      fetchImpl: fetchMock as unknown as typeof fetch,
      normalizer,
    }).identify(req("leaf"));

    expect(seen).toHaveLength(1);
    expect(Array.isArray(seen[0].results)).toBe(true);
    expect(seen[0].remainingIdentificationRequests).toBe(123);
    // Raw JSON passed through untouched for Stage C (nothing invented here).
    expect(seen[0].raw).toEqual({
      results: [{ score: 0.9 }],
      remainingIdentificationRequests: 123,
    });
    expect(out.sourceLabel).toBe("pl@ntnet-v2");
    expect(out.upstreamQuota).toEqual({
      remainingIdentificationRequests: 123,
      rateLimitPolicy: '"dailyQuota";q=500;w=86400',
      rateLimit: '"dailyQuota";r=123;t=3600',
      retryAfter: null,
    });
    expect(out.topResult).toEqual(result.topResult);
  });

  it("a 200 body missing results[] maps to upstream_error (no guessed structure)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { unexpected: true }));
    const provider = makeProvider({ fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(provider.identify(req("auto"))).rejects.toMatchObject({
      code: "upstream_error",
    });
  });

  it("the default normalizer maps a documented 200 into candidates (Stage C implemented)", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        results: [
          {
            score: 0.9,
            species: {
              scientificNameWithoutAuthor: "Monstera deliciosa",
              commonNames: ["swiss cheese plant"],
              family: { scientificNameWithoutAuthor: "Araceae" },
              genus: { scientificNameWithoutAuthor: "Monstera" },
            },
            gbif: { id: "2870168" }, // top-level sibling, string id (official example)
            images: [],
          },
        ],
        remainingIdentificationRequests: 499,
      })
    );
    const provider = new PlantnetLiveProvider({
      apiKey: DUMMY_KEY,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const out = await provider.identify(req("auto"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out.topResult.species).toHaveLength(1);
    expect(out.topResult.species[0].scientificName).toBe("Monstera deliciosa");
    expect(out.topResult.species[0].score).toBe(0.9);
    expect(out.upstreamQuota?.remainingIdentificationRequests).toBe(499);
  });
});

/* ------------------------------------------------------------------ */
/* Redaction (SECURITY.md §3 — never log the URL/key/headers/body)       */
/* ------------------------------------------------------------------ */

describe("live provider redaction", () => {
  it("redactUrlForLogs strips the query string (which carries api-key)", () => {
    const url = buildUpstreamUrl(DUMMY_KEY);
    expect(redactUrlForLogs(url)).toBe("https://my-api.plantnet.org/v2/identify/all");
    expect(redactUrlForLogs(url)).not.toContain(DUMMY_KEY);
    expect(redactUrlForLogs(url)).not.toContain("api-key");
  });

  it("error messages never embed the key, the api-key parameter, or the URL", async () => {
    const scenarios: (() => Promise<unknown>)[] = [
      () =>
        makeProvider({
          fetchImpl: vi.fn(async () => jsonResponse(404, {})) as unknown as typeof fetch,
        }).identify(req("auto")),
      () =>
        makeProvider({
          fetchImpl: vi.fn(async () => jsonResponse(429, {})) as unknown as typeof fetch,
        }).identify(req("auto")),
      () =>
        makeProvider({
          fetchImpl: vi.fn(async () => jsonResponse(400, {})) as unknown as typeof fetch,
        }).identify(req("auto")),
      () =>
        makeProvider({
          fetchImpl: vi.fn(async () => jsonResponse(500, {})) as unknown as typeof fetch,
        }).identify(req("auto")),
      () =>
        makeProvider({
          fetchImpl: vi.fn(async (): Promise<Response> => {
            // Simulate undici's URL-embedding network error shape.
            const e = new TypeError(
              `fetch failed: ${buildUpstreamUrl(DUMMY_KEY).toString()}`
            );
            throw e;
          }) as unknown as typeof fetch,
        }).identify(req("auto")),
    ];
    for (const scenario of scenarios) {
      const err = (await scenario().then(
        () => null,
        (e: unknown) => e as Error
      )) as Error;
      expect(err.message).not.toContain(DUMMY_KEY);
      expect(err.message).not.toContain("api-key");
      expect(err.message).not.toContain("my-api.plantnet.org");
    }
  });
});

/* ------------------------------------------------------------------ */
/* Provider seam wiring (mock-first)                                    */
/* ------------------------------------------------------------------ */

describe("provider seam wiring (mock-first, live inactive)", () => {
  it("mock mode (default) returns the MockProvider and never calls fetch", async () => {
    const fetchMock = vi.fn(async (): Promise<Response> => {
      throw new Error("fetch must never be called in mock mode");
    });
    vi.stubGlobal("fetch", fetchMock);
    const { mode, provider } = getProvider();
    expect(mode).toBe("mock");
    const out = await provider.identify(req("auto"));
    expect(out.sourceLabel).toBe("mock");
    expect(out.topResult.species.length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("PLANTNET_MODE=live without a key fails safe to mock with a diagnostic (fetch never called)", async () => {
    process.env.PLANTNET_MODE = "live";
    // PLANTNET_API_KEY intentionally unset.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async (): Promise<Response> => {
      throw new Error("fetch must never be called");
    });
    vi.stubGlobal("fetch", fetchMock);
    const { mode, provider } = getProvider();
    expect(mode).toBe("mock");
    await provider.identify(req("auto"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("PLANTNET_MODE=live with a blank key fails safe to mock with a safe diagnostic", async () => {
    process.env.PLANTNET_MODE = "live";
    process.env.PLANTNET_API_KEY = "   "; // blank = invalid credential
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { mode } = getProvider();
    expect(mode).toBe("mock");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = String(errorSpy.mock.calls[0]?.[0] ?? "");
    expect(logged).toContain("missing or blank");
    expect(logged).not.toContain("   "); // the value itself is never echoed
  });

  it("PLANTNET_MODE=live with a valid-format key wires the live provider (still inactive without owner activation)", async () => {
    process.env.PLANTNET_MODE = "live";
    process.env.PLANTNET_API_KEY = DUMMY_KEY; // dummy only — never a real key
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        results: [
          {
            score: 0.9,
            species: { scientificNameWithoutAuthor: "Monstera deliciosa" },
          },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { mode, provider } = getProvider();
    expect(mode).toBe("live");
    // Delegation is proven offline: the stub fetch returns a documented 200
    // fixture and the Stage C normalizer maps it into candidates end-to-end.
    const out = await provider.identify(req("auto"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out.topResult.species).toHaveLength(1);
    expect(out.topResult.species[0].scientificName).toBe("Monstera deliciosa");
    expect(out.sourceLabel).toBe("pl@ntnet-v2");
    const [url] = fetchMock.mock.calls[0] as unknown as [URL];
    expect(url.pathname).toBe("/v2/identify/all");
  });

  it("PLANTNET_API_KEY alone (no PLANTNET_MODE) is enough to wire the live provider", async () => {
    process.env.PLANTNET_API_KEY = DUMMY_KEY; // dummy only — never a real key
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        results: [
          {
            score: 0.8,
            species: { scientificNameWithoutAuthor: "Ficus lyrata" },
          },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { mode, provider } = getProvider();
    expect(mode).toBe("live");
    const out = await provider.identify(req("auto"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out.topResult.species[0]?.scientificName).toBe("Ficus lyrata");
  });
});

/* ------------------------------------------------------------------ */
/* Server-only import protection (must be the LAST module-cache test)   */
/* ------------------------------------------------------------------ */

describe("server-only import protection", () => {
  it("client-side imports cannot access the server-only live provider", async () => {
    vi.resetModules();
    (globalThis as { window?: unknown }).window = {}; // simulate a client bundle
    try {
      await expect(import("@/lib/plantnet/live-provider")).rejects.toThrow(
        /Server-only module was imported on the client/
      );
    } finally {
      delete (globalThis as { window?: unknown }).window;
    }
  });
});
