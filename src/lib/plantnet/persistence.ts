import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  requireServerOnly,
  getServerSupabaseSecretKey,
  isIdentificationPersistenceEnabled,
} from "@/lib/env";
import type { SpeciesCandidate } from "@/lib/plantnet/types";
import { DEFAULT_PROJECT } from "@/lib/plantnet/live-provider";

/**
 * Identification persistence (API_DOCUMENTATION.md §2.4 steps 7/11/12).
 *
 * PHASE 2 REALITY (owner-approved scope):
 * `public.identifications` has **no INSERT grant/policy for anon or
 * authenticated** (deliberate anti-forgery design — rows are written by the
 * server via the privileged key, DATABASE_SCHEMA.md §3.3), and
 * `identification_cache` is service_role-only. The owner's local
 * `SUPABASE_SERVICE_ROLE_KEY` was REJECTED by Supabase ("Invalid API key"),
 * and weakening those permissions to persist rows without a valid key is
 * forbidden.
 *
 * Phase 2.5 (2026-11-12, per supabase.com/docs/guides/getting-started/api-keys):
 * the key is now resolved via `getServerSupabaseSecretKey()` — preferring the
 * modern `SUPABASE_SECRET_KEY` (`sb_secret_...`, recommended by Supabase;
 * legacy `anon`/`service_role` JWTs deprecated by end of 2026) with the
 * legacy `SUPABASE_SERVICE_ROLE_KEY` name still accepted. Both resolve to
 * the same `service_role` Postgres role.
 *
 * WRITE CONTROL (owner decision 2026-11-12): a verified key is capability,
 * NOT permission. Every write in this module (identifications INSERT,
 * identification_cache upsert, hit_count UPDATE) is gated by
 * `isIdentificationPersistenceEnabled()` — OFF unless the server-side env
 * var PLANTAI_PERSISTENCE_ENABLED is exactly "true". Enforced twice: here
 * in each helper AND in `getPersistenceCapability()` (which the identify
 * route calls), so an accidental call cannot bypass it. Read-only database
 * access is unaffected. Activation is a separate owner decision.
 *
 * STAGE F1/F2 (2026-11-14, owner-approved code alignment; NO SQL changed):
 * every write payload now matches the ACTUAL deployed schema (migration
 * 000): identification_cache upserts `p_hash` with conflict target
 * `(p_hash, project, organ)` (was: nonexistent `image_hash` +
 * `image_hash,organ` — every upsert would have failed, PGRST204);
 * identifications inserts organ/hash/project explicitly (was: silently
 * defaulted); hit-count lookups filter the full unique key. Project is the
 * verified canonical `"all"` (PERSISTED_PROJECT below). Remaining schema
 * mismatches (organ CHECK lacking fruit/bark, 'allplants' defaults) are
 * proposal F-3 — a separate owner-approved migration.
 */

requireServerOnly();

export interface PersistenceCapability {
  available: boolean;
  /** Stable machine reason for logs + the completion report. */
  reason: string;
  client: SupabaseClient | null;
}

/**
 * Canonical persisted project (Stage F1/F2, 2026-11-14): the VERIFIED
 * upstream project contract — `"all"` (docs/VERIFIED_FACTS.md Stage A1;
 * `live-provider.ts` DEFAULT_PROJECT, single source of truth). Written
 * EXPLICITLY on every identification_cache / identifications write so the
 * cache unique key `(p_hash, project, organ)` never depends on database
 * defaults. The schema's own `'allplants'` column DEFAULT is a known,
 * separately flagged mismatch (DATABASE_SCHEMA.md §3.3/§3.10; TASKS.md
 * FW-3) — aligning that default is the owner-approved F-3 migration, NOT
 * part of this code change (no SQL was modified here).
 */
export const PERSISTED_PROJECT = DEFAULT_PROJECT;

/**
 * Supabase rejects an invalid/expired key with "Invalid API key" on every
 * call. Log that state ONCE per process (it means the owner-side credential
 * needs replacing — persistence stays skipped, responses unaffected).
 */
let invalidKeyLogged = false;

function logInvalidSecretKey(): void {
  if (invalidKeyLogged) return;
  invalidKeyLogged = true;
  console.error(
    "[identify] The configured Supabase secret key (SUPABASE_SECRET_KEY or " +
      "legacy SUPABASE_SERVICE_ROLE_KEY) is present but REJECTED by Supabase " +
      "(Invalid API key). identifications persistence + identification_cache " +
      "stay skipped until the owner supplies a valid key from Dashboard → " +
      "Project Settings → API Keys. User responses are unaffected."
  );
}

/**
 * One-per-process notice that the persistence write control is OFF (the
 * safe default). Explains the fix without ever touching user responses.
 */
let disabledLogged = false;

function logPersistenceDisabled(): void {
  if (disabledLogged) return;
  disabledLogged = true;
  console.warn(
    "[identify] persistence disabled: PLANTAI_PERSISTENCE_ENABLED is not set " +
      'to exactly "true" (safe default OFF). No identifications INSERT, no ' +
      "identification_cache upsert, and no hit_count updates will be " +
      "attempted. Identification responses are unaffected. Enabling writes " +
      "is a separate owner decision (see .env.example)."
  );
}

export function getPersistenceCapability(): PersistenceCapability {
  const { key, source } = getServerSupabaseSecretKey();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) {
    return {
      available: false,
      reason:
        "No valid privileged Supabase key configured (SUPABASE_SECRET_KEY or " +
        "legacy SUPABASE_SERVICE_ROLE_KEY — owner-side prerequisite). " +
        "identifications rows and identification_cache upserts are skipped.",
      client: null,
    };
  }
  // SAFE-DEFAULT WRITE CONTROL (owner decision 2026-11-12): even with a
  // valid privileged key, automatic identification writes stay DISABLED
  // unless PLANTAI_PERSISTENCE_ENABLED is exactly "true". A verified key is
  // capability, not permission. No client is even constructed while OFF.
  if (!isIdentificationPersistenceEnabled()) {
    logPersistenceDisabled();
    return {
      available: false,
      reason:
        "PLANTAI_PERSISTENCE_ENABLED is not \"true\" — identification " +
        "persistence writes are disabled by the safe default (a valid " +
        `privileged key IS present, env: ${source}). Enabling requires an ` +
        "explicit owner decision.",
      client: null,
    };
  }
  // Dedicated privileged client: server-only module, RLS bypassed
  // deliberately (SECURITY.md §6 service-role usage policy; each usage cites
  // the bypassed policy: identifications INSERT service-role-only by design;
  // identification_cache is service_role-only). `sb_secret_...` and the
  // legacy JWT resolve to the same service_role Postgres role.
  return {
    available: true,
    reason: `privileged client available (env: ${source})`,
    client: createClient(url, key, { auth: { persistSession: false } }),
  };
}

export interface PersistInput {
  userId: string | null;
  imageHash: string;
  organ: string;
  species: SpeciesCandidate[];
  bestMatch: SpeciesCandidate | null;
  mode: "mock" | "live";
}

/**
 * Persists an identifications row (status=complete) + the
 * identification_cache upsert. Best-effort: a persistence failure must never
 * break the user's identification response (logged, surfaced as 200).
 * Returns the inserted identification id, or null when skipped/failed.
 */
export async function persistIdentification(
  cap: PersistenceCapability,
  input: PersistInput
): Promise<string | null> {
  // Independent enforcement (defense in depth): even a caller holding an
  // available capability object cannot bypass the global write switch.
  if (!isIdentificationPersistenceEnabled()) {
    logPersistenceDisabled();
    return null;
  }
  if (!cap.available || !cap.client) {
    console.warn(
      `[identify] persistence skipped: ${cap.reason} (hash prefix ${input.imageHash.slice(0, 12)}…)`
    );
    return null;
  }

  try {
    const resultPayload = { species: input.species };
    const { data, error } = await cap.client
      .from("identifications")
      .insert({
        user_id: input.userId, // null allowed — anonymous rows exist by design
        image_paths: [], // Storage upload of request images ships with the live provider (Phase 2 prep note)
        // Stage F2 (2026-11-14): organ / hash / project are now explicit —
        // previously omitted, so every row silently defaulted (organ 'auto'
        // regardless of the user's hint, hash NULL, project column default).
        // Column names verified against migration 000 (§3.3):
        // `organ`, `hash`, `project` (the identifications hash column is
        // `hash`, NOT `p_hash` — that name belongs to identification_cache).
        organ: input.organ,
        hash: input.imageHash,
        project: PERSISTED_PROJECT,
        best_match_scientific_name: input.bestMatch?.scientificName ?? null,
        best_match_score: input.bestMatch ? Number(input.bestMatch.score.toFixed(4)) : null,
        result: resultPayload,
        status: input.mode === "mock" ? "complete" : "complete",
        // Note: a "mock" provenance marker is not in the schema; mock runs are
        // distinguishable via result.sources === ["mock"].
        //
        // PRIVACY: latitude/longitude are deliberately NEVER written — GPS is
        // a regional request hint only (API_DOCUMENTATION.md §2.9); it is not
        // sent upstream (live-provider.ts) and is not part of PersistInput.
        //
        // KNOWN DEPENDENCY (FW-2 / proposal F-3, owner migration pending):
        // the CURRENT identifications.organ CHECK still allows 'lateral'/'root'
        // and lacks 'fruit'/'bark'. Explicit organ values 'fruit'/'bark' are
        // therefore rejected by Postgres until that owner-approved migration
        // runs. Persistence is best-effort: such a failure is logged and
        // returns null (route issues a fallback UUID) — responses are NEVER
        // affected. No SQL was modified to work around this.
      })
      .select("id")
      .single();

    if (error || !data) {
      // Logged without credentials; PostgREST messages describe the DB-side
      // cause (schema/policy/grant), never the connection string.
      const msg = error?.message ?? "no error object";
      if (msg.includes("Invalid API key")) {
        logInvalidSecretKey();
      } else {
        console.error(
          `[identify] identifications insert failed: code=${error?.code ?? "none"} ` +
            `message=${msg} details=${error?.details ?? "none"} hint=${error?.hint ?? "none"}`
        );
      }
      return null;
    }

    // Stage F1 (2026-11-14): aligned with the ACTUAL identification_cache
    // schema (migration 000 §3.10 / DATABASE_SCHEMA.md §3.10):
    // p_hash + unique index (p_hash, project, organ). The former payload
    // wrote a NONEXISTENT `image_hash` column with onConflict
    // "image_hash,organ" (which no unique index matches) — every upsert
    // would have failed with PGRST204 on first persistence activation.
    // Mapping decisions (evidence-based, nothing invented):
    // - p_hash = the request-level `combinedImageHash` — the ONLY hash
    //   identity implemented (src/lib/identify/hash.ts; exact-byte SHA-256,
    //   the pHash library decision is deferred). This keeps the durable key
    //   IDENTICAL to the in-memory dedup key (hash::organ) while project is
    //   the single constant PERSISTED_PROJECT (see dedup-cache.ts).
    // - p_hash_variants is deliberately NOT written: its documented meaning
    //   is "hashes of OTHER images in the request" (DATABASE_SCHEMA.md
    //   §3.10), but the implemented identity collapses ALL request images
    //   into the single combined hash — no separate variant hashes exist to
    //   store, so the column stays at its schema default '{}' until a
    //   multi-variant hash design is separately decided.
    // - top_score mirrors identifications.best_match_score (same source and
    //   rounding); NULL when the result has no best match (nullable column).
    const { error: cacheError } = await cap.client
      .from("identification_cache")
      .upsert(
        {
          p_hash: input.imageHash,
          project: PERSISTED_PROJECT,
          organ: input.organ,
          normalized_result: resultPayload,
          top_score: input.bestMatch ? Number(input.bestMatch.score.toFixed(4)) : null,
          hit_count: 0,
          last_hit_at: new Date().toISOString(),
        },
        { onConflict: "p_hash,project,organ" }
      );

    if (cacheError) {
      console.error(`[identify] identification_cache upsert failed: ${cacheError.code}`);
    }

    return data.id as string;
  } catch (e) {
    console.error("[identify] persistence threw (non-fatal)", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Bumps hit_count on a durable cache hit (capability present).
 * Stage F1 (2026-11-14): the read filters the FULL unique key
 * `(p_hash, project, organ)` — the former `image_hash` filter named a
 * nonexistent column. PERSISTED_PROJECT is applied internally so the
 * lookup identity always matches the upsert identity (single constant).
 */
export async function bumpCacheHitCount(
  cap: PersistenceCapability,
  imageHash: string,
  organ: string
): Promise<void> {
  // Independent enforcement: hit-count updates are writes too — disabled
  // while the persistence control is OFF, regardless of any capability.
  if (!isIdentificationPersistenceEnabled()) {
    logPersistenceDisabled();
    return;
  }
  if (!cap.available || !cap.client) return;
  try {
    const { data } = await cap.client
      .from("identification_cache")
      .select("id, hit_count")
      .eq("p_hash", imageHash)
      .eq("project", PERSISTED_PROJECT)
      .eq("organ", organ)
      .maybeSingle();
    if (!data) return;
    await cap.client
      .from("identification_cache")
      .update({ hit_count: (data.hit_count ?? 0) + 1, last_hit_at: new Date().toISOString() })
      .eq("id", data.id);
  } catch {
    // best-effort stat only
  }
}
