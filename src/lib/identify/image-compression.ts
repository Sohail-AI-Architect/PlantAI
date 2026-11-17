/*
 * Client-side image compression for /identify (Stage 2B, post-deployment).
 *
 * WHY: Netlify Functions cap request bodies at ~6 MB (Netlify's documented
 * platform limit), while the identify pipeline accepts up to 3 photos and
 * the widget previously passed raw files up to 10 MB each — a 6–10 MB
 * upload was rejected with 413 at the platform edge before the route
 * handler could respond. Camera captures were already resized through a
 * canvas (plant-camera.tsx); gallery uploads were not.
 *
 * DESIGN:
 * - Pure, testable decision logic lives here (thresholds + aspect-preserving
 *   dimension math); the DOM-dependent canvas step is a thin wrapper that
 *   degrades HONESTLY: if compression is unavailable or fails, the original
 *   file is returned unchanged and the caller's normal size validation and
 *   error messages apply (no image is ever silently discarded).
 * - Quality ladder 0.85 → 0.72 → 0.60 keeps plant-ID-relevant detail
 *   (leaf venation, flower structure) while reliably landing well under
 *   the platform limit even with 3 photos (3 × ~1.5 MB worst case ≈ 4.5 MB
 *   of body + form overhead < 6 MB).
 * - Files already ≤ the threshold pass through untouched — no re-encoding
 *   loss for small, well-compressed originals.
 */

/** Hard acceptance cap, matching the server contract (identify-widget). */
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

/** Files above this size are re-encoded client-side before upload. */
export const COMPRESS_THRESHOLD_BYTES = 1.5 * 1024 * 1024;

/** Longest edge after compression — ample for Pl@ntNet-style recognition. */
export const COMPRESS_MAX_DIMENSION = 2048;

/** Initial JPEG quality for the re-encode. */
export const COMPRESS_QUALITY = 0.85;

/** Per-image ceiling after compression; the ladder stops below this. */
export const COMPRESS_TARGET_BYTES = 1.5 * 1024 * 1024;

/** Quality ladder — first value is the initial quality, then fallbacks. */
const QUALITY_LADDER = [COMPRESS_QUALITY, 0.72, 0.6] as const;

/** Does this file need client-side optimization? (pure) */
export function shouldCompress(file: { size: number; type: string }): boolean {
  return file.size > COMPRESS_THRESHOLD_BYTES;
}

/**
 * Aspect-preserving dimensions bounded by `maxDimension` on the longest
 * edge (pure). Never upscales: images already at/below the bound keep
 * their exact original dimensions.
 */
export function computeScaledDimensions(
  width: number,
  height: number,
  maxDimension: number = COMPRESS_MAX_DIMENSION
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }
  const scale = maxDimension / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Re-encode an image through a canvas at bounded dimensions with the
 * quality ladder. BROWSER-ONLY: requires createImageBitmap + canvas.
 *
 * Honest-degradation contract: on ANY failure (no canvas 2D context,
 * decode error, zero-byte output) the ORIGINAL file is returned with
 * `compressed: false` — callers must still run their normal size checks
 * and surface understandable errors. Returns the original unchanged when
 * no quality step produced a smaller file than the input.
 */
export async function compressImageFile(
  file: File,
  options: { maxDimension?: number; targetBytes?: number } = {}
): Promise<{ file: File; compressed: boolean }> {
  const maxDimension = options.maxDimension ?? COMPRESS_MAX_DIMENSION;
  const targetBytes = options.targetBytes ?? COMPRESS_TARGET_BYTES;

  if (!shouldCompress(file)) return { file, compressed: false };
  if (typeof createImageBitmap === "undefined") {
    return { file, compressed: false };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Undecodable in this browser — keep the original; validation decides.
    return { file, compressed: false };
  }

  try {
    const { width, height } = computeScaledDimensions(
      bitmap.width,
      bitmap.height,
      maxDimension
    );
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return { file, compressed: false };
    context.drawImage(bitmap, 0, 0, width, height);

    let best: { blob: Blob; quality: number } | null = null;
    for (const quality of QUALITY_LADDER) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality)
      );
      if (!blob || blob.size === 0) continue;
      best = { blob, quality };
      // Stop as soon as a rung lands under the target (higher quality wins).
      if (blob.size <= targetBytes) break;
    }

    // Never hand back something LARGER than the original, and only call it
    // compression when it actually helps.
    if (!best || best.blob.size >= file.size) {
      return { file, compressed: false };
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "plant-photo";
    const compressed = new File([best.blob], `${baseName}.jpg`, {
      type: "image/jpeg",
    });
    return { file: compressed, compressed: true };
  } catch {
    return { file, compressed: false };
  } finally {
    bitmap.close();
  }
}
