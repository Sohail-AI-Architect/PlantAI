import { requireServerOnly } from "@/lib/env";

/**
 * `app_settings` reader for the identify pipeline (FR-ID-002/007).
 *
 * Limits are tunable in the database (DATABASE_SCHEMA.md §3.9): e.g.
 * `identify.daily_limit.anonymous` = 5, `identify.daily_limit.authenticated`
 * = 20, `identify.images.max` = 3, `identify.image.max_bytes` = 10485760.
 *
 * Access path: anon/authenticated have an explicit SELECT grant + the
 * `p_app_settings_read_all` policy (Data API privilege configuration,
 * 2026-11-11), so the server can read settings with the *session* client —
 * no service_role credential is needed. app_settings never holds secrets.
 *
 * Cache: read once per instance + TTL re-check (API_DOCUMENTATION.md §5.1
 * "read once per instance + on settings change (cheap polling)").
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";

requireServerOnly();

export interface IdentifyLimits {
  anonymousPerDay: number;
  authenticatedPerDay: number;
  maxImages: number;
  maxImageBytes: number;
}

/** Hard floor/ceiling so a bad settings row cannot brick the endpoint. */
const FALLBACK: IdentifyLimits = {
  anonymousPerDay: 5,
  authenticatedPerDay: 20,
  maxImages: 3,
  maxImageBytes: 10 * 1024 * 1024,
};

const NUMBER_KEYS: Record<keyof IdentifyLimits, string> = {
  anonymousPerDay: "identify.daily_limit.anonymous",
  authenticatedPerDay: "identify.daily_limit.authenticated",
  maxImages: "identify.images.max",
  maxImageBytes: "identify.image.max_bytes",
};

const TTL_MS = 60_000; // 1-minute settings cache per instance
let cache: { limits: IdentifyLimits; fetchedAt: number } | null = null;

function clamp(name: string, value: unknown, min: number, max: number): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    console.warn(`app_settings: ${name} invalid (${String(value)}) — using fallback`);
    return null;
  }
  return Math.floor(n);
}

export async function getIdentifyLimits(
  forceRefresh = false
): Promise<IdentifyLimits> {
  if (!forceRefresh && cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return cache.limits;
  }

  const limits: IdentifyLimits = { ...FALLBACK };
  try {
    const supabase = await createSupabaseServerClient();
    const keys = Object.values(NUMBER_KEYS);
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", keys);

    if (error) {
      // 42501-equivalent or transient error — fall back to defaults; the
      // endpoint must not fail because settings are unreadable.
      console.warn(
        `app_settings read failed (${error.code ?? "unknown"}): using built-in defaults`
      );
    } else {
      const byKey = new Map((data ?? []).map((r) => [r.key, r.value]));
      for (const [field, key] of Object.entries(NUMBER_KEYS)) {
        const raw = byKey.get(key);
        if (raw === undefined) continue;
        const bounds: Record<string, [number, number]> = {
          "identify.daily_limit.anonymous": [0, 100],
          "identify.daily_limit.authenticated": [0, 1000],
          "identify.images.max": [1, 5],
          "identify.image.max_bytes": [1024, 25 * 1024 * 1024],
        };
        const [min, max] = bounds[key];
        const v = clamp(key, raw, min, max);
        if (v !== null) limits[field as keyof IdentifyLimits] = v;
      }
    }
  } catch {
    console.warn("app_settings unavailable — using built-in defaults");
  }

  cache = { limits, fetchedAt: Date.now() };
  return limits;
}

/** Test hook: drop the per-instance settings cache. */
export function resetSettingsCacheForTests(): void {
  cache = null;
}
