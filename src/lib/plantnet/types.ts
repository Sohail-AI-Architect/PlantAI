/**
 * PlantAI identification response types — the normalized shape that is the
 * ONLY thing stored/returned (API_DOCUMENTATION.md §2.6).
 *
 * Phase 2 additive fields (documented in API_DOCUMENTATION.md §7 changelog):
 * - `mode: "mock" | "live"` — explicit provider mode so a mock result can
 *   never masquerade as a real AI identification (owner requirement).
 * - `mockNotice` — human-readable mock-mode label string (mock mode only).
 * - `careSummary.plantLibraryId` — the library row id, so the results UI can
 *   call the documented `savePlant({ plantId })` action directly.
 */

export type ConfidenceBand = "exact" | "likely" | "possible";

export interface SpeciesImage {
  url: string;
  alt: string;
  /** Actual returned citation string, verbatim when the upstream provided one. */
  citation: string;
  /**
   * Stage C (2026-11-13): the ACTUAL returned license value (verbatim),
   * when the upstream provided one. Rendering is permitted ONLY for the
   * documented reusable license (CC BY-SA — Stage A1); the normalizer never
   * emits an image entry whose license is missing/unknown/unsupported, so
   * anything present in `images[]` is displayable. The old
   * `cc_by_sa: boolean` assumption is removed — never assume licenses.
   */
  license?: string;
  /**
   * Stage C: composed attribution actually displayed with the image
   * (contributor credit + Pl@ntNet credit + license, per the documented
   * pattern). Built ONLY from returned metadata — never fabricated.
   */
  attribution: string;
}

export interface SpeciesCandidate {
  rank: number;
  scientificName: string;
  commonNames: string[];
  family?: string | null;
  genus?: string | null;
  gbifId?: number | null;
  /** Stage C: Kew POWO identifier, when the upstream returned one (additive). */
  powoId?: string | null;
  score: number;
  confidenceBand: ConfidenceBand;
  sources: string[];
  images: SpeciesImage[];
}

export interface CareSummary {
  watering: string;
  sunlight: string;
  soil: string;
  fertilizer: string;
  plantLibrarySlug: string;
  /** Additive (Phase 2): library row id for the save-plant action. */
  plantLibraryId?: string;
}

export interface IdentifySuccessPayload {
  success: true;
  cached: boolean;
  /** Additive (Phase 2): "mock" | "live" — always present. */
  mode: "mock" | "live";
  identificationId: string;
  remainingQuota: number;
  topResult: { species: SpeciesCandidate[] };
  careSummary: CareSummary | null;
  /** Additive (Phase 2, mock mode only): transparent mock label. */
  mockNotice?: string;
}

export type IdentifyErrorPayload = {
  success: false;
  error: {
    code:
      | "invalid_request"
      | "unsupported_image"
      | "auth_required"
      | "no_match_found"
      | "image_too_large"
      | "daily_limit_reached"
      | "upstream_error"
      | "quota_exhausted"
      | "provider_unavailable"
      | "concurrency_limited"
      | "internal_error"
      /** Stage B (2026-11-13): unexpected upstream 4xx ≠ no-match
       * (API_DOCUMENTATION.md §2.8 — planned code, now implemented at the
       * provider layer; surfaced as HTTP 502 by the route). */
      | "upstream_rejected";
    message: string;
  };
  details?: { path: string; msg: string }[];
  remainingQuota: number;
  nextResetUTC?: string;
};

export interface IdentifyProviderRequest {
  images: Uint8Array[];
  organ: string;
  latitude?: number;
  longitude?: number;
  /** Deterministic dedup key — lets the mock provider be stable per input. */
  combinedHash: string;
}

/**
 * Stage B (2026-11-13): upstream quota signals captured from a live Pl@ntNet
 * identification response, when available (docs/VERIFIED_FACTS.md —
 * `remainingIdentificationRequests` is a response-body field;
 * `RateLimit-Policy`/`RateLimit`/`Retry-After` are response headers). Values
 * are carried opaquely (strings/number|null) — never parsed or re-invented.
 * Header values contain no secrets.
 */
export interface UpstreamQuotaSignals {
  /** Response-body field, when the 200 body carries it; null otherwise. */
  remainingIdentificationRequests: number | null;
  rateLimitPolicy: string | null;
  rateLimit: string | null;
  retryAfter: string | null;
}

export interface IdentifyProviderResult {
  /** The provider's raw answer in the normalized PlantAI shape (no care summary yet). */
  topResult: { species: SpeciesCandidate[] };
  /** Upstream label for `sources` + logging; e.g. "pl@ntnet-v2" | "mock". */
  sourceLabel: string;
  /** Stage B (live provider only): captured upstream quota signals. */
  upstreamQuota?: UpstreamQuotaSignals | null;
}

/**
 * Stage B: typed provider-level error. Safety contract (SECURITY.md §3):
 * messages NEVER embed the request URL, the API key, request headers, the
 * request body, or raw upstream response bodies — only the mapped error code,
 * the upstream HTTP status, and fixed wording.
 */
export class ProviderError extends Error {
  readonly code:
    | "no_match_found"
    | "quota_exhausted"
    | "upstream_rejected"
    | "upstream_error"
    | "invalid_request";
  readonly httpStatus: number;
  readonly upstreamQuota: UpstreamQuotaSignals | null;

  constructor(
    code: ProviderError["code"],
    message: string,
    httpStatus: number,
    upstreamQuota: UpstreamQuotaSignals | null = null
  ) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.upstreamQuota = upstreamQuota;
  }
}

/**
 * Stage B: conservative, Stage-A1-documented subset of the upstream v2
 * `POST /v2/identify/{project}` 200 body (docs/VERIFIED_FACTS.md). Only
 * documented fields are typed; `raw` carries the parsed JSON unchanged for
 * the Stage C normalizer so nothing is guessed or invented here.
 */
export interface UpstreamIdentifyResponse {
  /** Documented: array of scored results (0–1 scores). */
  results: readonly unknown[];
  /** Documented response-body quota field; null when absent/non-numeric. */
  remainingIdentificationRequests: number | null;
  /** Full parsed JSON, passed through untouched for Stage C mapping. */
  raw: unknown;
}

/**
 * Stage C boundary: maps a verified upstream 200 response into the PlantAI
 * candidate shape (license display rule, per-image `author`/`license`/
 * `citation` handling, candidate caps). Implemented in Stage C — Stage B
 * defines the interface and passes the parsed response through.
 */
export type UpstreamNormalizer = (
  response: UpstreamIdentifyResponse
) => { topResult: { species: SpeciesCandidate[] } };
