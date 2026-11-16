import { requireServerOnly } from "@/lib/env";
import type { IdentifyProvider } from "@/lib/plantnet/provider";
import { normalizeUpstreamResponse } from "@/lib/plantnet/normalize";
import {
  ProviderError,
  type IdentifyProviderRequest,
  type IdentifyProviderResult,
  type UpstreamIdentifyResponse,
  type UpstreamNormalizer,
  type UpstreamQuotaSignals,
} from "@/lib/plantnet/types";

/**
 * LIVE Pl@ntNet v2 provider — Stage B (2026-11-13), server-only.
 *
 * Implements the VERIFIED Stage A1 upstream contract
 * (docs/VERIFIED_FACTS.md, verified 2026-11-12; API_DOCUMENTATION.md §2.8):
 * - Endpoint:  POST https://my-api.plantnet.org/v2/identify/{project}
 *   (the official API gateway host; `my.plantnet.org` is the portal/docs site).
 * - Default project: `all`.
 * - Auth: the `api-key` QUERY PARAMETER — so the key is embedded in the URL.
 *   THIS MODULE NEVER LOGS the full URL, the key, headers, or the request
 *   body; error messages carry only codes/statuses (ProviderError contract
 *   in types.ts).
 * - Images: repeated `images` form fields (1–3, already validated upstream in
 *   the route), each appended with the correct MIME type detected from magic
 *   bytes (never the client-declared type).
 * - Organs: upstream parameter is `organs` (plural) — ONE repeated form value
 *   PER IMAGE, IN IMAGE ORDER. Only upstream-valid non-auto values
 *   (`leaf`/`flower`/`fruit`/`bark`) are ever sent; omitted = automatic
 *   detection for every image. The pre-Stage-C zod values `lateral`/`root`
 *   (flagged mismatch FW-1) are therefore NEVER transmitted upstream — they
 *   fall back to auto-detection rather than being sent as invalid values.
 * - NEVER sent: latitude/longitude (MVP sends no GPS upstream), email, IP,
 *   user ID, deprecated parameters (e.g. `type`).
 * - Timeout: 20 s via AbortController. NO automatic retries — every failure
 *   surfaces once as a typed error (docs/VERIFIED_FACTS.md: errored requests
 *   can consume a credit; the user retries manually).
 * - Error taxonomy (verified):
 *     404  → no_match_found   (non-plant image: "Species not found")
 *     429  → quota_exhausted  (no retry)
 *     other 4xx → upstream_rejected
 *     5xx  → upstream_error
 *     network failure / timeout → upstream_error
 * - Quota capture: `RateLimit-Policy`, `RateLimit`, `Retry-After` headers +
 *   `remainingIdentificationRequests` body field, carried opaquely; the
 *   `RateLimit` header's remaining value (`r=`) is parsed defensively by
 *   parseRateLimitRemaining() for the `X-RateLimit-Remaining-Upstream`
 *   header (partition keys and everything else are never exposed).
 *
 * STAGE C (2026-11-13): the default normalizer is implemented
 * (normalizeUpstreamResponse in normalize.ts) — verified-field-only mapping,
 * conservative license enforcement, defensive skipping of malformed
 * entries/images. An empty mapped result list is surfaced by the route as
 * HTTP 404 `no_match_found`.
 *
 * This module is UNREACHABLE while PLANTNET_MODE=mock: provider.ts returns
 * the MockProvider and never constructs or calls this class. Activating live
 * identification (Stage G/H) is a separate owner decision.
 */

requireServerOnly();

/** Official API gateway origin (Stage A1 verified — NOT my.plantnet.org). */
export const PLANTNET_API_ORIGIN = "https://my-api.plantnet.org";

/** Verified default project ("set project to all" — Stage A1). */
export const DEFAULT_PROJECT = "all";

/** Hard upstream-call timeout (Stage B requirement). */
export const UPSTREAM_TIMEOUT_MS = 20_000;

/** Upstream-valid, non-auto organ values (Stage A1; `auto` = omit the field). */
const UPSTREAM_ORGANS = new Set(["leaf", "flower", "fruit", "bark"]);

export interface PlantnetLiveProviderOptions {
  /** Server-only API key (from env.getPlantnetApiKey(); never logged). */
  apiKey: string;
  /** Upstream project slug; default `all`. */
  project?: string;
  /** Injectable fetch for offline tests (defaults to globalThis.fetch). */
  fetchImpl?: typeof fetch;
  /** Injectable Stage C normalizer (defaults to the not-ready boundary). */
  normalizer?: UpstreamNormalizer;
}

export class PlantnetLiveProvider implements IdentifyProvider {
  private readonly apiKey: string;
  private readonly project: string;
  private readonly fetchImpl: typeof fetch;
  private readonly normalizeResponse: UpstreamNormalizer;

  constructor(options: PlantnetLiveProviderOptions) {
    this.apiKey = options.apiKey;
    this.project = options.project ?? DEFAULT_PROJECT;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.normalizeResponse = options.normalizer ?? normalizeUpstreamResponse;
  }

  async identify(request: IdentifyProviderRequest): Promise<IdentifyProviderResult> {
    const url = buildUpstreamUrl(this.apiKey, this.project);
    const form = this.buildFormData(request);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
    } catch (e) {
      throw upstreamFailure(e); // network failure OR 20 s timeout — no retry
    } finally {
      clearTimeout(timer);
    }

    const headerQuota = captureHeaderQuota(response);
    if (!response.ok) {
      throw mapHttpError(response, headerQuota);
    }

    // 200 path — parse conservatively, capture the documented quota field,
    // then hand the parsed response to the Stage C boundary.
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ProviderError(
        "upstream_error",
        "Upstream returned HTTP 200 with a body that is not valid JSON.",
        response.status,
        headerQuota
      );
    }
    const parsed = parseUpstreamResponse(body, response.status, headerQuota);
    const quota: UpstreamQuotaSignals = {
      ...headerQuota,
      remainingIdentificationRequests: parsed.remainingIdentificationRequests,
    };
    const normalized = this.normalizeResponse(parsed);
    return {
      topResult: normalized.topResult,
      sourceLabel: "pl@ntnet-v2",
      upstreamQuota: quota,
    };
  }

  /**
   * Builds the multipart form: repeated `images` fields (MIME from magic
   * bytes) + repeated `organs` fields (one per image, in image order) ONLY
   * when a valid non-auto organ was requested. Nothing else is ever sent.
   */
  private buildFormData(request: IdentifyProviderRequest): FormData {
    const form = new FormData();
    for (let i = 0; i < request.images.length; i++) {
      const mime = detectImageMime(request.images[i]);
      if (!mime) {
        // The route's magic-byte validation rejects such bytes earlier; this
        // is a defensive stop so an unknown payload is never sent upstream.
        throw new ProviderError(
          "invalid_request",
          "Image bytes without a recognized JPEG/PNG signature reached the live provider.",
          0
        );
      }
      form.append(
        "images",
        new Blob([toArrayBuffer(request.images[i])], { type: mime }),
        `image-${i + 1}.${mime === "image/png" ? "png" : "jpg"}`
      );
    }

    const organ = (request.organ ?? "auto").trim().toLowerCase();
    if (UPSTREAM_ORGANS.has(organ)) {
      for (let i = 0; i < request.images.length; i++) {
        form.append("organs", organ); // one per image, in image order
      }
    }
    // organ === "auto" (or the flagged FW-1 values lateral/root): send NO
    // organs field — upstream auto-detects for every image. Never transmit
    // an upstream-invalid value.
    return form;
  }
}

/* ------------------------------------------------------------------ */
/* Helpers (pure, testable)                                            */
/* ------------------------------------------------------------------ */

/**
 * Builds the upstream URL with the `api-key` query parameter (verified auth).
 * The returned URL contains the secret — it is used ONLY as the fetch target
 * and is never logged/stringified into diagnostics (see redactUrlForLogs).
 */
export function buildUpstreamUrl(apiKey: string, project: string = DEFAULT_PROJECT): URL {
  const url = new URL(`/v2/identify/${encodeURIComponent(project)}`, PLANTNET_API_ORIGIN);
  url.searchParams.set("api-key", apiKey);
  return url;
}

/**
 * Redacts a request URL for any diagnostic use: origin + path only — the
 * query string (which carries `api-key`) is always stripped. SECURITY.md §3.
 */
export function redactUrlForLogs(url: URL): string {
  return `${url.origin}${url.pathname}`;
}

/** Magic-byte MIME detection (mirrors the route's validation, never trusts client input). */
export function detectImageMime(
  bytes: Uint8Array
): "image/jpeg" | "image/png" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  return null;
}

/** Conservative parse of a 200 body into the documented subset. */
export function parseUpstreamResponse(
  body: unknown,
  httpStatus: number,
  quota: UpstreamQuotaSignals | null
): UpstreamIdentifyResponse {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ProviderError(
      "upstream_error",
      "Upstream returned HTTP 200 with a non-object JSON body.",
      httpStatus,
      quota
    );
  }
  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.results)) {
    throw new ProviderError(
      "upstream_error",
      "Upstream HTTP 200 body is missing the documented results[] array.",
      httpStatus,
      quota
    );
  }
  return {
    results: record.results,
    remainingIdentificationRequests:
      typeof record.remainingIdentificationRequests === "number"
        ? record.remainingIdentificationRequests
        : null,
    raw: body,
  };
}

/** Response headers contain no secrets — captured opaquely, never logged. */
function captureHeaderQuota(response: Response): UpstreamQuotaSignals {
  return {
    remainingIdentificationRequests: null, // filled from the 200 body only
    rateLimitPolicy: response.headers.get("RateLimit-Policy"),
    rateLimit: response.headers.get("RateLimit"),
    retryAfter: response.headers.get("Retry-After"),
  };
}

/**
 * Verified HTTP error mapping (Stage A1). Response bodies are NOT parsed for
 * error shapes and are NEVER embedded in messages (unverified structure; and
 * the URL/key must never leak through diagnostics).
 */
function mapHttpError(response: Response, quota: UpstreamQuotaSignals): never {
  const status = response.status;
  if (status === 404) {
    // Verified: non-plant image → 404 "Species not found" → no_match_found.
    throw new ProviderError(
      "no_match_found",
      "No plant was recognized in the submitted photo (upstream HTTP 404).",
      status,
      quota
    );
  }
  if (status === 429) {
    // Verified: daily quota exhausted. NO retry — surfaced once.
    throw new ProviderError(
      "quota_exhausted",
      "The upstream daily identification quota is exhausted (HTTP 429).",
      status,
      quota
    );
  }
  if (status >= 400 && status < 500) {
    // Verified: other 4xx ≠ no-match — contract drift / client-server mismatch.
    throw new ProviderError(
      "upstream_rejected",
      `The upstream API rejected the request (HTTP ${status}).`,
      status,
      quota
    );
  }
  throw new ProviderError(
    "upstream_error",
    `The upstream API failed (HTTP ${status}).`,
    status,
    quota
  );
}

/**
 * Network failure / timeout → upstream_error. Only the error NAME is carried
 * into the message: Node fetch failures (TypeError) can embed the full
 * request URL — which contains the API key — so messages are never propagated.
 */
function upstreamFailure(e: unknown): never {
  const name = e instanceof Error ? e.name : typeof e;
  throw new ProviderError(
    "upstream_error",
    `The upstream request could not be completed (${name}) — no automatic retry was attempted.`,
    0
  );
}

/**
 * Defensively parses the remaining value out of the documented
 * `RateLimit` header (`"dailyQuota";r=<remaining>;t=<seconds>;pk=…`).
 * Returns the integer remaining count, or null when absent/malformed.
 * Partition keys (`pk=…`) and every other component are NEVER exposed.
 */
export function parseRateLimitRemaining(headerValue: string | null | undefined): number | null {
  if (typeof headerValue !== "string") return null;
  const match = headerValue.match(/(?:^|;)\s*r=(\d+)/i);
  if (!match) return null;
  const remaining = Number(match[1]);
  return Number.isFinite(remaining) ? remaining : null;
}

/** Blob construction helper (avoids TS BufferSource variance friction). */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}
