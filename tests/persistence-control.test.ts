/*
 * Identification-persistence write control tests (owner decision 2026-11-12).
 *
 * Proves:
 *  1. Missing PLANTAI_PERSISTENCE_ENABLED  → writes disabled.
 *  2. "false" / blank / invalid values     → writes disabled.
 *  3. Only the exact string "true"         → writes enabled (with a valid key+URL).
 *  4. Mock identification still succeeds while writes are disabled.
 *  5. No identifications INSERT happens when disabled.
 *  6. No identification_cache UPSERT happens when disabled.
 *  7. No hit_count UPDATE happens when disabled.
 *  8. Read-only in-memory cache behavior still works.
 *
 * The Supabase client is ALWAYS mocked (spy objects) — these tests never
 * touch a real database and perform no network I/O.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getPersistenceCapability,
  persistIdentification,
  bumpCacheHitCount,
  PERSISTED_PROJECT,
  type PersistenceCapability,
  type PersistInput,
} from "@/lib/plantnet/persistence";
import { DEFAULT_PROJECT } from "@/lib/plantnet/live-provider";
import { ORGANS } from "@/lib/plantnet/organs";
import { isIdentificationPersistenceEnabled } from "@/lib/env";
import { identifyMock } from "@/lib/plantnet/mock-provider";
import {
  lookupCache,
  putCache,
  clearDedupCacheForTests,
} from "@/lib/identify/dedup-cache";
import type { SpeciesCandidate } from "@/lib/plantnet/types";

/* ------------------------------------------------------------------ */
/* Environment hygiene — save/restore the real values, never print them */
/* ------------------------------------------------------------------ */

const CONTROLLED_KEYS = [
  "PLANTAI_PERSISTENCE_ENABLED",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

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
});

/* ------------------------------------------------------------------ */
/* Spy Supabase client — records every write method call               */
/* ------------------------------------------------------------------ */

interface SpyCalls {
  identificationsInsert: number;
  cacheUpsert: number;
  cacheHitCountUpdate: number;
  cacheSelect: number;
  /* Stage F1/F2 (2026-11-14): payload/filter capture (additive only). */
  lastInsertPayload: Record<string, unknown> | null;
  lastUpsertPayload: Record<string, unknown> | null;
  lastUpsertOptions: Record<string, unknown> | null;
  lastCacheSelectFilters: unknown[];
  lastUpdatePayload: Record<string, unknown> | null;
}

function makeSpyClient(): { client: SupabaseClient; calls: SpyCalls } {
  const calls: SpyCalls = {
    identificationsInsert: 0,
    cacheUpsert: 0,
    cacheHitCountUpdate: 0,
    cacheSelect: 0,
    lastInsertPayload: null,
    lastUpsertPayload: null,
    lastUpsertOptions: null,
    lastCacheSelectFilters: [],
    lastUpdatePayload: null,
  };
  const client = {
    from(table: string) {
      if (table === "identifications") {
        return {
          insert: (payload: Record<string, unknown>) => {
            calls.identificationsInsert += 1;
            calls.lastInsertPayload = payload;
            return {
              select: () => ({
                single: async () => ({
                  data: { id: "00000000-0000-4000-8000-000000000000" },
                  error: null,
                }),
              }),
            };
          },
        };
      }
      if (table === "identification_cache") {
        return {
          upsert: (payload: Record<string, unknown>, options?: Record<string, unknown>) => {
            calls.cacheUpsert += 1;
            calls.lastUpsertPayload = payload;
            calls.lastUpsertOptions = options ?? null;
            return Promise.resolve({ error: null });
          },
          select: (...selectArgs: unknown[]) => {
            calls.cacheSelect += 1;
            void selectArgs; // column list not asserted; filters are
            const filters: unknown[] = [];
            calls.lastCacheSelectFilters = filters;
            const chain = () => ({
              eq: (column: unknown, value: unknown) => {
                filters.push([column, value]);
                return chain();
              },
              maybeSingle: async () => ({
                data: { id: "cache-row-1", hit_count: 3 },
                error: null,
              }),
            });
            return chain();
          },
          update: (payload: Record<string, unknown>) => {
            calls.cacheHitCountUpdate += 1;
            calls.lastUpdatePayload = payload;
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      throw new Error(`unexpected table in spy: ${table}`);
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

/* ------------------------------------------------------------------ */
/* Test data                                                           */
/* ------------------------------------------------------------------ */

const SPECIES: SpeciesCandidate[] = [
  {
    rank: 1,
    scientificName: "Monstera deliciosa",
    commonNames: ["swiss cheese plant"],
    family: "Araceae",
    genus: "Monstera",
    gbifId: null,
    score: 0.87,
    confidenceBand: "exact",
    sources: ["mock"],
    images: [],
  },
];

function makePersistInput(overrides: Partial<PersistInput> = {}): PersistInput {
  return {
    userId: null,
    imageHash: "a".repeat(64),
    organ: "auto",
    species: SPECIES,
    bestMatch: SPECIES[0],
    mode: "mock",
    ...overrides,
  };
}

function availableCap(client: SupabaseClient): PersistenceCapability {
  return { available: true, reason: "test-provided capability", client };
}

const DISABLED_VALUES = [
  undefined, // missing
  "", // blank
  "   ", // whitespace-only
  "false",
  "FALSE",
  "False",
  "true ", // trailing space — not the exact string
  " true",
  "TRUE",
  "1",
  "yes",
  "enabled",
];

/* ------------------------------------------------------------------ */
/* 1–3: the control itself, at capability AND helper level             */
/* ------------------------------------------------------------------ */

describe("PLANTAI_PERSISTENCE_ENABLED write control", () => {
  it.each(DISABLED_VALUES)(
    "keeps writes disabled for value: %s",
    (value) => {
      if (value !== undefined) process.env.PLANTAI_PERSISTENCE_ENABLED = value;
      expect(isIdentificationPersistenceEnabled()).toBe(false);

      // Capability level: no client constructed, unavailable.
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-ref.supabase.co";
      process.env.SUPABASE_SECRET_KEY = "sb_secret_fakevaluefortestsonly";
      const cap = getPersistenceCapability();
      expect(cap.available).toBe(false);
      expect(cap.client).toBeNull();
    }
  );

  it("enables only for the exact string 'true' (capability becomes available)", () => {
    process.env.PLANTAI_PERSISTENCE_ENABLED = "true";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-ref.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_fakevaluefortestsonly";
    expect(isIdentificationPersistenceEnabled()).toBe(true);
    const cap = getPersistenceCapability();
    expect(cap.available).toBe(true);
    expect(cap.client).not.toBeNull();
  });

  it("helper refuses writes even when handed an available capability (defense in depth)", async () => {
    const { client, calls } = makeSpyClient();
    for (const value of DISABLED_VALUES) {
      if (value === undefined) delete process.env.PLANTAI_PERSISTENCE_ENABLED;
      else process.env.PLANTAI_PERSISTENCE_ENABLED = value;

      const id = await persistIdentification(availableCap(client), makePersistInput());
      expect(id).toBeNull();

      await bumpCacheHitCount(availableCap(client), "h".repeat(64), "auto");
      expect(calls.identificationsInsert).toBe(0);
      expect(calls.cacheUpsert).toBe(0);
      expect(calls.cacheHitCountUpdate).toBe(0);
      expect(calls.cacheSelect).toBe(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 5–7: no INSERT / UPSERT / hit-count UPDATE while disabled           */
/* ------------------------------------------------------------------ */

describe("no database writes occur while the control is OFF", () => {
  it("persistIdentification performs no INSERT and no cache UPSERT", async () => {
    const { client, calls } = makeSpyClient();
    const id = await persistIdentification(availableCap(client), makePersistInput());
    expect(id).toBeNull();
    expect(calls.identificationsInsert).toBe(0);
    expect(calls.cacheUpsert).toBe(0);
  });

  it("bumpCacheHitCount performs no hit_count UPDATE (and no cache read)", async () => {
    const { client, calls } = makeSpyClient();
    await bumpCacheHitCount(availableCap(client), "h".repeat(64), "auto");
    expect(calls.cacheHitCountUpdate).toBe(0);
    expect(calls.cacheSelect).toBe(0);
  });

  it("an unavailable capability (control OFF at pipeline level) also writes nothing", async () => {
    // Simulates the route path: getPersistenceCapability() returns an
    // unavailable capability while OFF; even so the helper is given it.
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-ref.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_fakevaluefortestsonly";
    const cap = getPersistenceCapability(); // control OFF → unavailable
    const { client, calls } = makeSpyClient();
    void client;
    const id = await persistIdentification(cap, makePersistInput());
    expect(id).toBeNull();
    expect(calls.identificationsInsert).toBe(0);
    expect(calls.cacheUpsert).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* 3 + write execution when explicitly enabled (only exact "true")     */
/* ------------------------------------------------------------------ */

describe("explicitly enabled (exact 'true'): writes execute against the mocked client", () => {
  it("persistIdentification INSERTs + cache UPSERTs and returns the id", async () => {
    process.env.PLANTAI_PERSISTENCE_ENABLED = "true";
    const { client, calls } = makeSpyClient();
    const id = await persistIdentification(availableCap(client), makePersistInput());
    expect(id).toBe("00000000-0000-4000-8000-000000000000");
    expect(calls.identificationsInsert).toBe(1);
    expect(calls.cacheUpsert).toBe(1);
  });

  it("bumpCacheHitCount reads then updates hit_count once", async () => {
    process.env.PLANTAI_PERSISTENCE_ENABLED = "true";
    const { client, calls } = makeSpyClient();
    await bumpCacheHitCount(availableCap(client), "h".repeat(64), "auto");
    expect(calls.cacheSelect).toBe(1);
    expect(calls.cacheHitCountUpdate).toBe(1);
  });

  it("enabled but missing privileged key still writes nothing (capability unavailable)", async () => {
    process.env.PLANTAI_PERSISTENCE_ENABLED = "true";
    // No SUPABASE_SECRET_KEY / legacy key / URL configured → the capability
    // factory (the route's entry point) returns unavailable; even so the
    // helper is handed that capability and must write nothing.
    const cap = getPersistenceCapability();
    expect(cap.available).toBe(false);
    const { client, calls } = makeSpyClient();
    const id = await persistIdentification(cap, makePersistInput());
    expect(id).toBeNull();
    expect(calls.identificationsInsert).toBe(0);
    expect(calls.cacheUpsert).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* 4: mock identification keeps working with writes disabled           */
/* ------------------------------------------------------------------ */

describe("mock identification with writes disabled", () => {
  it("returns a full provider result and the route's id fallback keeps the response shape", async () => {
    const { client } = makeSpyClient();
    const providerResult = await identifyMock({
      images: [new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])],
      organ: "auto",
      combinedHash: "b".repeat(64),
    });

    expect(providerResult.sourceLabel).toBe("mock");
    expect(providerResult.topResult.species.length).toBeGreaterThan(0);
    expect(providerResult.topResult.species[0].sources).toEqual(["mock"]);
    expect(providerResult.topResult.species[0].images).toEqual([]);

    // Route behavior with a disabled capability: identificationId falls
    // back to a generated UUID — response structure unchanged.
    const id =
      (await persistIdentification(
        availableCap(client),
        makePersistInput({ species: providerResult.topResult.species })
      )) ?? "generated-uuid-fallback";
    expect(id).toBe("generated-uuid-fallback");
  });

  it("is deterministic per input (same hash → same top species)", async () => {
    const a = await identifyMock({
      images: [new Uint8Array([1])],
      organ: "auto",
      combinedHash: "c".repeat(64),
    });
    const b = await identifyMock({
      images: [new Uint8Array([2])],
      organ: "auto",
      combinedHash: "c".repeat(64),
    });
    expect(a.topResult.species[0].scientificName).toBe(
      b.topResult.species[0].scientificName
    );
  });
});

/* ------------------------------------------------------------------ */
/* 8: read-only in-memory dedup cache unaffected                       */
/* ------------------------------------------------------------------ */

describe("in-memory dedup cache (read-only behavior preserved)", () => {
  beforeEach(() => clearDedupCacheForTests());
  afterEach(() => clearDedupCacheForTests());

  it("putCache → lookupCache round-trips regardless of the write control", () => {
    delete process.env.PLANTAI_PERSISTENCE_ENABLED;
    const hash = "d".repeat(64);
    const payload = {
      success: true as const,
      cached: false,
      mode: "mock" as const,
      identificationId: "x",
      remainingQuota: 4,
      topResult: { species: SPECIES },
      careSummary: null,
      mockNotice: "Sample data — this result did not come from live Pl@ntNet identification.",
    };
    putCache(hash, "auto", payload);
    const hit = lookupCache(hash, "auto");
    expect(hit.hit).toBe(true);
    if (hit.hit) {
      expect(hit.payload.mode).toBe("mock");
      expect(hit.payload.topResult.species[0].scientificName).toBe(
        "Monstera deliciosa"
      );
    }
    // Different organ key = miss (read-only check, no writes anywhere).
    const miss = lookupCache(hash, "leaf");
    expect(miss.hit).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Stage F1 — identification_cache upsert contract (schema-aligned)     */
/* ------------------------------------------------------------------ */

describe("Stage F1 — identification_cache upsert payload matches the actual schema", () => {
  beforeEach(() => {
    process.env.PLANTAI_PERSISTENCE_ENABLED = "true";
  });

  it("uses the real schema columns and the real unique conflict target", async () => {
    const { client, calls } = makeSpyClient();
    await persistIdentification(availableCap(client), makePersistInput());
    expect(calls.cacheUpsert).toBe(1);
    const payload = calls.lastUpsertPayload!;
    // Exact column set — migration 000 §3.10 writes (p_hash_variants and id
    // stay at/derived from their schema defaults).
    expect(Object.keys(payload).sort()).toEqual([
      "hit_count",
      "last_hit_at",
      "normalized_result",
      "organ",
      "p_hash",
      "project",
      "top_score",
    ]);
    expect(payload.p_hash).toBe("a".repeat(64)); // = PersistInput.imageHash
    expect(payload.organ).toBe("auto");
    expect(payload.project).toBe(PERSISTED_PROJECT);
    expect(payload.hit_count).toBe(0);
    expect(typeof payload.last_hit_at).toBe("string");
    expect(Number.isNaN(new Date(payload.last_hit_at as string).getTime())).toBe(false);
    // The unique index is (p_hash, project, organ) — the conflict target
    // must name exactly those columns.
    expect(calls.lastUpsertOptions).toEqual({ onConflict: "p_hash,project,organ" });
  });

  it("never writes the nonexistent image_hash column (former F1 defect)", async () => {
    const { client, calls } = makeSpyClient();
    await persistIdentification(availableCap(client), makePersistInput());
    expect("image_hash" in calls.lastUpsertPayload!).toBe(false);
  });

  it("p_hash_variants is NOT fabricated — left at the schema default '{}'", async () => {
    const { client, calls } = makeSpyClient();
    await persistIdentification(availableCap(client), makePersistInput());
    // The implemented hash identity collapses ALL request images into the
    // single combined hash; the column's documented meaning is "hashes of
    // OTHER images". No variant hashes exist, so none are invented.
    expect("p_hash_variants" in calls.lastUpsertPayload!).toBe(false);
  });

  it("project is the verified canonical 'all', identical to the live provider's DEFAULT_PROJECT (no drift)", () => {
    expect(PERSISTED_PROJECT).toBe(DEFAULT_PROJECT);
    expect(PERSISTED_PROJECT).toBe("all");
  });

  it("top_score mirrors bestMatch.score with the same rounding as best_match_score; null without a bestMatch", async () => {
    const { client, calls } = makeSpyClient();
    await persistIdentification(availableCap(client), makePersistInput());
    expect(calls.lastUpsertPayload!.top_score).toBe(0.87);

    const { client: client2, calls: calls2 } = makeSpyClient();
    await persistIdentification(
      availableCap(client2),
      makePersistInput({ bestMatch: null })
    );
    expect(calls2.lastUpsertPayload!.top_score).toBeNull();
  });

  it("every canonical organ value passes through verbatim (no remapping, no legacy values synthesized)", async () => {
    for (const organ of ORGANS) {
      const { client, calls } = makeSpyClient();
      await persistIdentification(availableCap(client), makePersistInput({ organ }));
      expect(calls.lastUpsertPayload!.organ).toBe(organ);
    }
    // The canonical enum itself contains no obsolete values (FW-1 resolved
    // in Stage C; route-level rejection of lateral/root is covered by
    // tests/identify-route.test.ts).
    expect(ORGANS).not.toContain("lateral");
    expect(ORGANS).not.toContain("root");
  });

  it("bumpCacheHitCount filters by the FULL unique key (p_hash, project, organ) and updates hit_count from the read row", async () => {
    const { client, calls } = makeSpyClient();
    await bumpCacheHitCount(availableCap(client), "h".repeat(64), "auto");
    expect(calls.cacheSelect).toBe(1);
    expect(calls.lastCacheSelectFilters).toEqual([
      ["p_hash", "h".repeat(64)],
      ["project", PERSISTED_PROJECT],
      ["organ", "auto"],
    ]);
    expect(calls.cacheHitCountUpdate).toBe(1);
    const update = calls.lastUpdatePayload!;
    expect(update.hit_count).toBe(4); // spy read row carried hit_count: 3
    expect(typeof update.last_hit_at).toBe("string");
  });
});

/* ------------------------------------------------------------------ */
/* Stage F2 — identifications insert contract (schema-aligned)          */
/* ------------------------------------------------------------------ */

describe("Stage F2 — identifications insert payload matches the actual schema", () => {
  beforeEach(() => {
    process.env.PLANTAI_PERSISTENCE_ENABLED = "true";
  });

  it("inserts organ/hash/project explicitly, next to the unchanged pre-existing fields", async () => {
    const { client, calls } = makeSpyClient();
    const id = await persistIdentification(
      availableCap(client),
      makePersistInput({ organ: "leaf" })
    );
    expect(id).toBe("00000000-0000-4000-8000-000000000000");
    expect(calls.identificationsInsert).toBe(1);
    const payload = calls.lastInsertPayload!;
    expect(payload.organ).toBe("leaf");
    expect(payload.hash).toBe("a".repeat(64)); // identifications column is `hash` (NOT p_hash)
    expect(payload.project).toBe(PERSISTED_PROJECT);
    // Pre-existing contract fields remain exactly as before (F2 adds, never
    // removes or rewrites).
    expect(payload.user_id).toBeNull();
    expect(payload.image_paths).toEqual([]);
    expect(payload.best_match_scientific_name).toBe("Monstera deliciosa");
    expect(payload.best_match_score).toBe(0.87);
    expect(payload.result).toEqual({ species: SPECIES });
    expect(payload.status).toBe("complete");
  });

  it("hash identity is IDENTICAL between identifications.hash and identification_cache.p_hash", async () => {
    const { client, calls } = makeSpyClient();
    await persistIdentification(availableCap(client), makePersistInput());
    expect(calls.lastInsertPayload!.hash).toBe(calls.lastUpsertPayload!.p_hash);
  });

  it("canonical organs map through verbatim; the obsolete lateral/root values are unreachable", async () => {
    for (const organ of ORGANS) {
      const { client, calls } = makeSpyClient();
      await persistIdentification(availableCap(client), makePersistInput({ organ }));
      expect(calls.lastInsertPayload!.organ).toBe(organ);
    }
    expect(ORGANS).not.toContain("lateral");
    expect(ORGANS).not.toContain("root");
  });

  it("GPS privacy: latitude/longitude NEVER appear in ANY write payload", async () => {
    const { client, calls } = makeSpyClient();
    await persistIdentification(availableCap(client), makePersistInput());
    for (const payload of [calls.lastInsertPayload, calls.lastUpsertPayload]) {
      expect("latitude" in payload!).toBe(false);
      expect("longitude" in payload!).toBe(false);
    }
  });

  it("normalized candidates are carried unchanged (normalized_result = { species: input.species })", async () => {
    const { client, calls } = makeSpyClient();
    await persistIdentification(availableCap(client), makePersistInput());
    expect(calls.lastUpsertPayload!.normalized_result).toEqual({ species: SPECIES });
  });
});

/* ------------------------------------------------------------------ */
/* Stage F1/F2 — single consistent writer (no duplicate writes)          */
/* ------------------------------------------------------------------ */

describe("Stage F1/F2 — writer consistency (one identity, no contradictions)", () => {
  beforeEach(() => {
    process.env.PLANTAI_PERSISTENCE_ENABLED = "true";
  });

  it("one persistIdentification call = exactly one INSERT + one cache UPSERT sharing one hash/project/organ identity", async () => {
    const { client, calls } = makeSpyClient();
    await persistIdentification(availableCap(client), makePersistInput());
    expect(calls.identificationsInsert).toBe(1);
    expect(calls.cacheUpsert).toBe(1);
    expect(calls.cacheSelect).toBe(0);
    expect(calls.cacheHitCountUpdate).toBe(0);
    const insertPayload = calls.lastInsertPayload!;
    const upsertPayload = calls.lastUpsertPayload!;
    expect(insertPayload.hash).toBe(upsertPayload.p_hash);
    expect(insertPayload.project).toBe(upsertPayload.project);
    expect(insertPayload.organ).toBe(upsertPayload.organ);
  });

  it("one bumpCacheHitCount call = exactly one key-filtered SELECT + one UPDATE, nothing else", async () => {
    const { client, calls } = makeSpyClient();
    await bumpCacheHitCount(availableCap(client), "h".repeat(64), "auto");
    expect(calls.cacheSelect).toBe(1);
    expect(calls.cacheHitCountUpdate).toBe(1);
    expect(calls.identificationsInsert).toBe(0);
    expect(calls.cacheUpsert).toBe(0);
  });
});
