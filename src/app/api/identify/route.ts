import { NextResponse, type NextRequest } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { getIpHashSalt, getPlantnetApiKey, requireServerOnly } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { identifyLimiter } from "@/lib/rate-limit";
import { getIdentifyLimits } from "@/lib/settings";
import {
  identifyRequestSchema,
  zodDetails,
  type IdentifyRequest,
} from "@/lib/validation/identify";
import {
  validateUploadedImage,
} from "@/lib/identify/image-validation";
import { combinedImageHash } from "@/lib/identify/hash";
import { lookupCache, putCache } from "@/lib/identify/dedup-cache";
import { getProvider } from "@/lib/plantnet/provider";
import { normalizeSpecies } from "@/lib/plantnet/normalize";
import { ProviderError, type IdentifyProviderResult, type UpstreamQuotaSignals } from "@/lib/plantnet/types";
import { parseRateLimitRemaining } from "@/lib/plantnet/live-provider";
import {
  getPersistenceCapability,
  persistIdentification,
  bumpCacheHitCount,
} from "@/lib/plantnet/persistence";
import type {
  IdentifySuccessPayload,
  SpeciesCandidate,
} from "@/lib/plantnet/types";

/**
 * POST /api/identify — the MVP's only Route Handler
 * (API_DOCUMENTATION.md §2; live Pl@ntNet when `PLANTNET_API_KEY` is set).
 *
 * Pipeline (§2.4):
 *   [1] body-size guard 413  →  [2] multipart parse 400
 *   →  [3] field validation (zod) 400
 *   →  [4] per-image magic-byte + size validation 400/413
 *   →  [5] identity via verified claims (never client-declared headers)
 *   →  [6] rate limit (in-memory, honest per-instance semantics) 429
 *   →  [7] SHA-256 hash + dedup lookup 200 cached:true
 *   →  [8] provider identify (live Pl@ntNet, or a clean 503 when the server
 *           key is not configured in production)
 *   →  [9] normalize + confidence bands
 *   →  [10] careSummary from plant_library (published rows, session client)
 *   →  [11] persistence — WRITE CONTROL: automatic DB writes are disabled
 *           by default; they happen only when PLANTAI_PERSISTENCE_ENABLED
 *           is exactly "true" (server-only env). Enforcement is two-layer:
 *           getPersistenceCapability() returns an unavailable capability
 *           while the switch is OFF, and both write helpers
 *           (persistIdentification / bumpCacheHitCount) independently
 *           re-check the switch (defense in depth). Read-only lookups
 *           (app_settings, dedup cache) are unaffected.
 *   →  [12] 200 JSON + X-RateLimit-* headers
 *
 * Every response carries Cache-Control: no-store and the X-RateLimit-*
 * headers (§2.5). Raw IPs are never logged (§SECURITY) — only a salted
 * SHA-256 hash feeds the in-memory counter.
 */

requireServerOnly();

/** Total body guard (~32 MB = 3×10 MB + fields; §2.1). */
const MAX_BODY_BYTES = 33 * 1024 * 1024;

/** Per-instance concurrency semaphore (§2.4 step 4; app_settings default 4). */
class Semaphore {
  private active = 0;
  private queue: (() => void)[] = [];
  constructor(private readonly max: number) {}
  async acquire(): Promise<boolean> {
    if (this.active < this.max) {
      this.active += 1;
      return true;
    }
    if (this.queue.length >= 64) return false; // hard backstop
    return new Promise<boolean>((resolve) => {
      this.queue.push(() => {
        this.active += 1;
        resolve(true);
      });
    });
  }
  release(): void {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) next();
  }
}
const identifySemaphore = new Semaphore(4); // identify.concurrent.upstream default

function utcResetIso(resetAtEpochMs: number): string {
  return new Date(resetAtEpochMs).toISOString().replace(".000Z", "Z");
}

function rateHeaders(
  limit: number,
  remaining: number,
  resetAt: number,
  upstreamRemaining?: number | null
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(0, remaining)),
    "X-RateLimit-Reset": String(Math.floor(resetAt / 1000)),
  };
  if (upstreamRemaining != null) {
    headers["X-RateLimit-Remaining-Upstream"] = String(upstreamRemaining);
  }
  return headers;
}

/**
 * Stage C: resolves the safe upstream-remaining value for
 * `X-RateLimit-Remaining-Upstream`. Preference order (both verified sources,
 * docs/VERIFIED_FACTS.md): the response-body field
 * `remainingIdentificationRequests` first, then the `r=` remaining value from
 * the documented `RateLimit` header. Never exposes partition keys, URLs, or
 * internal diagnostics; never invents a value.
 */
function resolveUpstreamRemaining(result: IdentifyProviderResult): number | null {
  const quota = result.upstreamQuota;
  if (!quota) return null;
  if (typeof quota.remainingIdentificationRequests === "number") {
    return quota.remainingIdentificationRequests;
  }
  return parseRateLimitRemaining(quota.rateLimit);
}

/** Same resolution from a ProviderError's captured quota (error paths). */
function resolveUpstreamRemainingFromQuota(quota: UpstreamQuotaSignals | null): number | null {
  if (!quota) return null;
  if (typeof quota.remainingIdentificationRequests === "number") {
    return quota.remainingIdentificationRequests;
  }
  return parseRateLimitRemaining(quota.rateLimit);
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  headers: Record<string, string>,
  extra?: { details?: { path: string; msg: string }[]; nextResetUTC?: string }
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
      ...(extra?.details ? { details: extra.details } : {}),
      remainingQuota: Math.max(0, Number(headers["X-RateLimit-Remaining"] ?? 0)),
      ...(extra?.nextResetUTC ? { nextResetUTC: extra.nextResetUTC } : {}),
    },
    { status, headers: { ...headers, "Cache-Control": "no-store" } }
  );
}

/** Client IP from platform headers — hashed with the server salt, never logged. */
function clientIpHash(request: NextRequest): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return createHash("sha256").update(`${ip}|${getIpHashSalt()}`).digest("hex");
}

async function resolveCareSummary(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  scientificName: string
): Promise<IdentifySuccessPayload["careSummary"]> {
  const { data, error } = await supabase
    .from("plant_library")
    .select("id, slug, watering, sunlight, soil, fertilizer")
    .eq("scientific_name", scientificName)
    .eq("is_published", true)
    .maybeSingle();

  if (error || !data || !data.watering || !data.sunlight || !data.soil || !data.fertilizer) {
    return null; // quieter card state in the UI (§6.3)
  }
  return {
    watering: data.watering,
    sunlight: data.sunlight,
    soil: data.soil,
    fertilizer: data.fertilizer,
    plantLibrarySlug: data.slug,
    plantLibraryId: data.id,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Identity + limits first (needed for rate-limit headers on every path).
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  const limits = await getIdentifyLimits();
  const limit = userId ? limits.authenticatedPerDay : limits.anonymousPerDay;
  const limiterKey = userId ? `user:${userId}` : `ip:${clientIpHash(request)}`;

  // [1] body-size guard — before any heavy work (§2.4 step 1).
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return errorResponse(
      413,
      "image_too_large",
      "The upload is too large (over the 3 × 10 MB limit).",
      rateHeaders(limit, identifyLimiter.peek(limiterKey, limit).remaining, identifyLimiter.peek(limiterKey, limit).resetAt)
    );
  }

  // [2] multipart parse.
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(
      400,
      "invalid_request",
      "We couldn't read your photos — check the upload and try again.",
      rateHeaders(limit, identifyLimiter.peek(limiterKey, limit).remaining, identifyLimiter.peek(limiterKey, limit).resetAt)
    );
  }

  const files = form.getAll("images[]");

  // [3] field validation (unknown fields silently ignored — §2.3).
  const parsed = identifyRequestSchema.safeParse({
    organ: form.get("organ") ?? undefined,
    latitude: form.has("latitude") ? form.get("latitude") : undefined,
    longitude: form.has("longitude") ? form.get("longitude") : undefined,
  });
  if (!parsed.success) {
    return errorResponse(
      400,
      "invalid_request",
      "We couldn't read your photos — check the upload and try again.",
      rateHeaders(limit, identifyLimiter.peek(limiterKey, limit).remaining, identifyLimiter.peek(limiterKey, limit).resetAt),
      { details: zodDetails(parsed.error) }
    );
  }
  const fields: IdentifyRequest = parsed.data;

  // [4] image count + per-image validation (V1–V3; never touches the
  // provider on failure — the error-credit-burns rule, docs/VERIFIED_FACTS.md).
  if (files.length < 1 || files.length > limits.maxImages) {
    return errorResponse(
      400,
      "invalid_request",
      files.length === 0
        ? "Please add at least one photo of the plant."
        : `Please upload between 1 and ${limits.maxImages} photos.`,
      rateHeaders(limit, identifyLimiter.peek(limiterKey, limit).remaining, identifyLimiter.peek(limiterKey, limit).resetAt)
    );
  }
  const buffers: Uint8Array[] = [];
  for (const file of files) {
    if (typeof file === "string") {
      return errorResponse(
        400,
        "invalid_request",
        "We couldn't read your photos — check the upload and try again.",
        rateHeaders(limit, identifyLimiter.peek(limiterKey, limit).remaining, identifyLimiter.peek(limiterKey, limit).resetAt)
      );
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const verdict = validateUploadedImage(bytes, limits.maxImageBytes);
    if (!verdict.ok) {
      const status = verdict.code === "image_too_large" ? 413 : 400;
      return errorResponse(
        status,
        verdict.code,
        verdict.message,
        rateHeaders(limit, identifyLimiter.peek(limiterKey, limit).remaining, identifyLimiter.peek(limiterKey, limit).resetAt)
      );
    }
    buffers.push(verdict.bytes);
  }

  // Live identification is configuration-driven. In production, a missing
  // server key returns a clean service-unavailable response instead of fake
  // sample matches — and it does not consume the visitor's daily quota.
  if (process.env.NODE_ENV === "production" && !getPlantnetApiKey()) {
    const peek = identifyLimiter.peek(limiterKey, limit);
    console.error(
      "[identify] live identification is not configured: set the server-only PLANTNET_API_KEY to enable Pl@ntNet."
    );
    return errorResponse(
      503,
      "provider_unavailable",
      "Plant identification isn't available right now — please try again later.",
      rateHeaders(limit, peek.remaining, peek.resetAt)
    );
  }

  // [5]/[6] rate limit — consumes an attempt only for requests that passed
  // validation (failed requests don't burn the user's daily budget).
  const decision = identifyLimiter.consume(limiterKey, limit);
  const headers = rateHeaders(decision.limit, decision.remaining, decision.resetAt);
  if (!decision.allowed) {
    return errorResponse(
      429,
      "daily_limit_reached",
      userId
        ? "You've used your free identifications for today — come back after midnight UTC."
        : "You've used your free identifications for today — come back after midnight UTC, or sign in for more.",
      headers,
      { nextResetUTC: utcResetIso(decision.resetAt) }
    );
  }

  // Per-instance concurrency gate (honest in-process semantics).
  const slot = await identifySemaphore.acquire();
  if (!slot) {
    return errorResponse(
      503,
      "concurrency_limited",
      "We're busy identifying other plants — try again in a few seconds.",
      headers
    );
  }

  try {
    // [7] hash + dedup.
    const hash = combinedImageHash(buffers);
    const cached = lookupCache(hash, fields.organ);
    if (cached.hit) {
      void bumpCacheHitCount(getPersistenceCapability(), hash, fields.organ);
      const payload = cached.payload;
      return NextResponse.json(
        { ...payload, cached: true, remainingQuota: decision.remaining },
        { headers: { ...headers, "Cache-Control": "no-store" } }
      );
    }

    // [8] provider — live Pl@ntNet when PLANTNET_API_KEY is configured
    // (production without a key already returned 503 above); development
    // and tests use the deterministic mock provider.
    const { mode, provider } = getProvider();
    const providerResult = await provider.identify({
      images: buffers,
      organ: fields.organ,
      latitude: fields.latitude,
      longitude: fields.longitude,
      combinedHash: hash,
    });

    // [9] normalize + bands.
    const species: SpeciesCandidate[] = normalizeSpecies(providerResult.topResult.species);
    if (species.length === 0) {
      return errorResponse(
        404,
        "no_match_found",
        "No confident match — try better light, a closer leaf photo, or another angle.",
        headers
      );
    }
    const bestMatch = species[0];

    // [10] careSummary from our own library content only (canonical #6).
    const careSummary = await resolveCareSummary(supabase, bestMatch.scientificName);

    // [11] persistence (skipped + logged when service-role credential absent).
    const cap = getPersistenceCapability();
    const identificationId =
      (await persistIdentification(cap, {
        userId,
        imageHash: hash,
        organ: fields.organ,
        species,
        bestMatch,
        mode,
      })) ?? randomUUID();

    const payload: IdentifySuccessPayload = {
      success: true,
      cached: false,
      mode,
      identificationId,
      remainingQuota: decision.remaining,
      topResult: { species },
      careSummary,
      ...(mode === "mock"
        ? {
            mockNotice:
              "Sample data — this result did not come from live Pl@ntNet identification.",
          }
        : {}),
    };

    putCache(hash, fields.organ, payload);

    // Stage C: safe upstream quota visibility on the success response —
    // `X-RateLimit-Remaining-Upstream` from verified sources only (body field
    // first, then the RateLimit header's r= value). Partition keys, URLs, and
    // reset times are never exposed; the header is omitted in mock mode.
    const upstreamRemaining = resolveUpstreamRemaining(providerResult);
    const responseHeaders =
      upstreamRemaining != null
        ? rateHeaders(decision.limit, decision.remaining, decision.resetAt, upstreamRemaining)
        : headers;

    // [12] respond.
    return NextResponse.json(payload, {
      headers: { ...responseHeaders, "Cache-Control": "no-store" },
    });
  } catch (e) {
    // Stage B (2026-11-13): typed provider errors from the live provider are
    // translated here (verified taxonomy, API_DOCUMENTATION.md §2.8) —
    // upstream 404 → 404 no_match_found, upstream 429 → 503 quota_exhausted
    // (SECURITY.md §3: no 429 pass-through), other 4xx → 502 upstream_rejected,
    // 5xx/network/timeout → 503 upstream_error. The mock provider never throws
    // ProviderError, so mock-mode behavior is unchanged. Messages are
    // user-friendly and contain no URLs/keys/status internals.
    if (e instanceof ProviderError) {
      console.error(
        "[identify] provider error:",
        e.code,
        "(upstream HTTP:",
        e.httpStatus,
        ") — no retry attempted."
      );
      const status =
        e.code === "no_match_found"
          ? 404
          : e.code === "quota_exhausted" || e.code === "upstream_error"
            ? 503
            : e.code === "upstream_rejected"
              ? 502
              : 400; // invalid_request (defensive; bytes rejected upstream-side)
      const message =
        e.code === "no_match_found"
          ? "No confident match — try better light, a closer leaf photo, or another angle."
          : e.code === "quota_exhausted"
            ? "Our daily plant-recognition budget is exhausted; try again tomorrow."
            : e.code === "upstream_rejected"
              ? "We couldn't process that identification right now — please try again."
              : e.code === "upstream_error"
                ? "Plant recognition is temporarily unavailable — please try again in a moment."
                : "We couldn't read your photos — check the upload and try again.";
      // Stage C: surface captured upstream remaining (if any) on error paths
      // via the same safe header; omitted when not available.
      const upstreamRemaining = resolveUpstreamRemainingFromQuota(e.upstreamQuota);
      const errorHeaders =
        upstreamRemaining != null
          ? rateHeaders(decision.limit, decision.remaining, decision.resetAt, upstreamRemaining)
          : headers;
      return errorResponse(status, e.code, message, errorHeaders);
    }
    console.error("[identify] unexpected error", e instanceof Error ? e.message : e);
    return errorResponse(
      500,
      "internal_error",
      "Something went wrong on our side — the error has been logged.",
      headers
    );
  } finally {
    identifySemaphore.release();
  }
}
