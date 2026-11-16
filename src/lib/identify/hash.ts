import { createHash } from "node:crypto";

/**
 * SHA-256 image-hash deduplication (Phase 2D, owner-approved design; FR-ID-003).
 *
 * Hashes are computed from the raw image bytes on the SERVER — a
 * client-supplied hash is never trusted (owner requirement).
 *
 * Normalization for multi-image requests: the set of per-image hashes is
 * sorted before the final hash, so uploading the same photos in a different
 * order yields the same dedup key (predictable permutation behavior,
 * API_DOCUMENTATION.md §6 case 3). JPEG/PNG bytes are otherwise untouched —
 * exact-byte dedup only (stricter than a perceptual hash; the pHash library
 * decision is deferred — no dependency without owner approval).
 */

export function sha256Image(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Deterministic request-level dedup key: sorted per-image SHA-256 hashes,
 * joined and hashed again. Same images in any order → same key.
 */
export function combinedImageHash(imageBytesList: Uint8Array[]): string {
  const perImage = imageBytesList
    .map((b) => sha256Image(b))
    .sort()
    .join("\n");
  return createHash("sha256").update(perImage).digest("hex");
}
