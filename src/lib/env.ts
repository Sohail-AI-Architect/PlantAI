/*
 * Environment access — Phase 1 foundation (FR-TEC-005 / NFR-S-001).
 *
 * Rules enforced here (SECURITY.md §2):
 * - Real values live ONLY in `.env.local` (git-ignored) or the host's
 *   encrypted environment settings. Nothing here ever logs values.
 * - Secrets (`SUPABASE_SECRET_KEY` / legacy `SUPABASE_SERVICE_ROLE_KEY`,
 *   `PLANTNET_API_KEY`) are read on the server only — never imported from
 *   client code going forward.
 * - Missing-variable failures are explicit and explain the fix instead of
 *   producing cryptic Supabase errors.
 */

/** Public (browser-safe) variables — exposed through the NEXT_PUBLIC_ prefix. */
export interface PublicSupabaseConfig {
  url: string;
  publishableKey: string;
}

/**
 * Returns the browser-safe Supabase pair (Project URL + Publishable key).
 *
 * Naming decision (ADR-9, 2026-11-10): the owner's new Supabase dashboard
 * supplies a "Publishable key" stored under
 * `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (older material used
 * `SUPABASE_ANON_KEY`). The publishable key is designed for browser use —
 * it is NOT a secret; RLS is the security boundary (DATABASE_SCHEMA.md §1).
 */
export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Missing Supabase public environment variables. Add them to .env.local " +
        "(never commit that file) — see ENVIRONMENT_SETUP.md §5. Required keys: " +
        "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }
  return { url, publishableKey };
}

/**
 * Server-only contract reminder: any future module needing the service/secret
 * key must call this and MUST NOT be imported from a Client Component.
 */
export function requireServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Server-only module was imported on the client.");
  }
}

/**
 * Privileged (RLS-bypassing) Supabase key — Phase 2.5 migration per the
 * current official API-key documentation
 * (supabase.com/docs/guides/getting-started/api-keys, read 2026-11-12):
 *
 * - Supabase is DEPRECATING the legacy `anon`/`service_role` JWT keys by the
 *   end of 2026; the replacement secret key has the `sb_secret_...` format
 *   and its canonical env name is `SUPABASE_SECRET_KEY`. It resolves to the
 *   same `service_role` Postgres role (BYPASSRLS), so database grants/RLS
 *   behavior is unchanged.
 * - `@supabase/supabase-js` 2.119.0 accepts the `sb_secret_...` key directly
 *   as the `createClient` key argument (official backend example).
 *
 * Resolution order (backward compatible — no credential is generated here,
 * values live only in .env.local / host settings):
 *   1. SUPABASE_SECRET_KEY           (recommended, modern)
 *   2. SUPABASE_SERVICE_ROLE_KEY     (legacy; works while not revoked)
 */
export type SecretKeySource =
  | "SUPABASE_SECRET_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "missing";

export interface ServerSecretKey {
  key: string | null;
  source: SecretKeySource;
}

export function getServerSupabaseSecretKey(): ServerSecretKey {
  const modern = process.env.SUPABASE_SECRET_KEY;
  if (modern) return { key: modern, source: "SUPABASE_SECRET_KEY" };
  const legacy = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (legacy) return { key: legacy, source: "SUPABASE_SERVICE_ROLE_KEY" };
  return { key: null, source: "missing" };
}

/**
 * Identification provider mode (Phase 2, mock-first per the owner-approved
 * plan + AI_INTEGRATION_PLAN.md).
 *
 * Default: "mock" — if no explicit production provider configuration exists
 * (mode unset, or mode=live without an API key), the app runs the local
 * deterministic mock provider. It never performs external calls and is
 * always clearly labelled in UI + API responses. Live Pl@ntNet integration
 * requires PLANTNET_MODE=live AND a server-only PLANTNET_API_KEY AND
 * explicit owner approval.
 */
export type PlantnetMode = "mock" | "live";

/**
 * Stage B (2026-11-13): reads the server-only Pl@ntNet API key without ever
 * exposing or logging it. Returns null for missing AND blank/whitespace-only
 * values (a blank key is an invalid credential, not a configured one).
 */
export function getPlantnetApiKey(): string | null {
  const raw = process.env.PLANTNET_API_KEY;
  if (!raw || raw.trim().length === 0) return null;
  return raw;
}

export function getPlantnetMode(): PlantnetMode {
  const raw = (process.env.PLANTNET_MODE ?? "mock").trim().toLowerCase();
  if (raw === "live") {
    if (!getPlantnetApiKey()) {
      // Live mode requested but unconfigured — fail safe to mock, loudly.
      console.error(
        "PLANTNET_MODE=live is set but PLANTNET_API_KEY is missing or blank; " +
          "falling back to mock mode. Live identification stays disabled."
      );
      return "mock";
    }
    return "live";
  }
  return "mock";
}

/**
 * Identification-persistence write control (owner decision 2026-11-12).
 *
 * SAFE DEFAULT: OFF. Automatic database writes from the identification
 * pipeline — the `identifications` INSERT, the `identification_cache`
 * upsert, and the `hit_count` UPDATE (src/lib/plantnet/persistence.ts) —
 * must happen ONLY when the owner has deliberately set
 * `PLANTAI_PERSISTENCE_ENABLED` to the exact string `true` in server-side
 * environment configuration.
 *
 * Rules:
 * - Missing, blank, invalid, or any other value (e.g. "false", "TRUE",
 *   "1", "yes") keeps writes DISABLED — only `=== "true"` activates.
 * - Deliberately NOT `NEXT_PUBLIC_`-prefixed: the setting must never reach
 *   client bundles (Next.js omits non-public vars from client bundles and
 *   Next.js build replaces `process.env.X` in client code with undefined
 *   for non-public names — the switch simply evaluates false there).
 * - Never added to `.env.local` by the agent; activation is a separate
 *   owner decision (documented in .env.example).
 * - Enforced in BOTH layers: the capability factory
 *   (`getPersistenceCapability`) and each write helper independently
 *   (defense in depth — an accidentally-constructed capability cannot
 *   bypass the switch).
 * - Database READS are unaffected: read-only lookups (app_settings via
 *   settings.ts, session queries) keep working.
 */
export function isIdentificationPersistenceEnabled(): boolean {
  return process.env.PLANTAI_PERSISTENCE_ENABLED === "true";
}

/**
 * Privacy-preserving salt for the anonymous rate-limit IP hash
 * (SECURITY.md §7: raw IP addresses are never logged; only a salted hash is
 * kept, in-memory, for the daily counter).
 *
 * - If IP_HASH_SALT is configured (server-side env), it is used — stable
 *   across instances/restarts.
 * - Otherwise a random per-process salt is generated at first use; the
 *   counter semantics stay correct within an instance (the documented
 *   in-memory best-effort limiter), but hashes differ across instances.
 *   Configure IP_HASH_SALT in production for stable per-IP counters.
 */
export function getIpHashSalt(): string {
  return process.env.IP_HASH_SALT ?? `__ephemeral__${process.pid ?? ""}`;
}
