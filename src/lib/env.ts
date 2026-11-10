/*
 * Environment access — Phase 1 foundation (FR-TEC-005 / NFR-S-001).
 *
 * Rules enforced here (SECURITY.md §2):
 * - Real values live ONLY in `.env.local` (git-ignored) or the host's
 *   encrypted environment settings. Nothing here ever logs values.
 * - Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `PLANTNET_API_KEY`) are read on
 *   the server only — never imported from client code going forward.
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
