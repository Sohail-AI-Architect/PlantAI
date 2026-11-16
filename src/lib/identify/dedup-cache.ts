import { requireServerOnly } from "@/lib/env";
import type { IdentifySuccessPayload } from "@/lib/plantnet/types";

/**
 * Image-hash dedup cache (FR-ID-003; API_DOCUMENTATION.md §2.4 step 6).
 *
 * PHASE 2 REALITY (owner-approved): the intended store,
 * `public.identification_cache`, is intentionally restricted to
 * `service_role` (Data API privilege configuration 2026-11-11 — zero grants
 * for anon/authenticated; SECURITY.md server-only table). The owner's local
 * privileged key (`SUPABASE_SERVICE_ROLE_KEY`, legacy name) was REJECTED by
 * Supabase as "Invalid API key", and weakening that restriction to
 * make deduplication work is explicitly forbidden.
 *
 * Therefore Phase 2 uses a per-instance in-memory cache with the same keying
 * scheme (combined SHA-256, organ) as the future `identification_cache` row
 * (hash + organ → normalized result), so the swap to the durable store is a
 * drop-in once the credential is configured.
 *
 * Stage F1/F2 (2026-11-14): the durable row key is
 * `(p_hash, project, organ)` where p_hash = `combinedImageHash` (the same
 * request-level hash used here) and project is the single constant
 * `PERSISTED_PROJECT` = "all" (persistence.ts). While project is constant,
 * this in-memory `(hash, organ)` key is semantically identical to the
 * durable composite key — the identities cannot diverge (single hash
 * function, single project constant). If multi-project support ever ships,
 * BOTH this key and the persistence writers must gain the project field
 * in the same change.
 *
 * HONEST LIMITATION: this cache is per-instance and wiped on restart/cold
 * start — best-effort, not globally persistent. Cross-instance dedup and
 * persistent `identifications` rows additionally require the owner to
 * enable writes via `PLANTAI_PERSISTENCE_ENABLED=true` (server-only write
 * control, safe default OFF) alongside the valid privileged key
 * (`SUPABASE_SECRET_KEY`, modern name) — documented in ENVIRONMENT_SETUP.md
 * + PHASE_2_SUPABASE_SECRET_KEY_REPORT.md.
 */

requireServerOnly();

export interface CacheHit {
  hit: true;
  payload: IdentifySuccessPayload;
  /** Cache entry creation time (ms epoch). */
  storedAt: number;
}

interface CacheEntry {
  payload: IdentifySuccessPayload;
  storedAt: number;
}

const TTL_MS = 6 * 60 * 60 * 1000; // 6h — instances are short-lived anyway
const MAX_ENTRIES = 500;

const store = new Map<string, CacheEntry>();

function evictIfNeeded(now: number): void {
  for (const [key, entry] of store) {
    if (now - entry.storedAt > TTL_MS) store.delete(key);
  }
  while (store.size > MAX_ENTRIES) {
    // Map preserves insertion order — evict oldest.
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

export function lookupCache(
  hash: string,
  organ: string
): CacheHit | { hit: false } {
  const key = `${hash}::${organ}`;
  const entry = store.get(key);
  const now = Date.now();
  evictIfNeeded(now);
  if (!entry || now - entry.storedAt > TTL_MS) {
    store.delete(key);
    return { hit: false };
  }
  return { hit: true, payload: entry.payload, storedAt: entry.storedAt };
}

export function putCache(hash: string, organ: string, payload: IdentifySuccessPayload): void {
  const key = `${hash}::${organ}`;
  store.set(key, { payload, storedAt: Date.now() });
  evictIfNeeded(Date.now());
}

/** Test hook. */
export function clearDedupCacheForTests(): void {
  store.clear();
}
