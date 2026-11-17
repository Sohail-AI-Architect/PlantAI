import { describe, expect, it } from "vitest";
import {
  COMPRESS_MAX_DIMENSION,
  COMPRESS_THRESHOLD_BYTES,
  UPLOAD_MAX_BYTES,
  compressImageFile,
  computeScaledDimensions,
  shouldCompress,
} from "@/lib/identify/image-compression";

/*
 * Offline contract tests for client-side upload optimization (Stage 2B).
 *
 * Scope honesty: these tests verify the PURE decision logic only —
 * thresholds and aspect-preserving dimension math — plus the honest
 * degradation path of the browser-only compression wrapper (no
 * createImageBitmap available in Node, so it must return the original
 * file untouched). They CANNOT verify real canvas re-encoding, actual
 * output sizes, or browser JPEG quality; that requires a real browser
 * (recorded in the Stage 2B report as NOT performed in this environment).
 *
 * What IS pinned here:
 * - the threshold boundary vs the hard 10 MB upload cap;
 * - no upscaling, aspect ratio preserved, exact-passthrough under the bound;
 * - degenerate dimensions never crash the math;
 * - the compression wrapper NEVER returns a fabricated result when the
 *   browser API is absent — callers still reach their normal validation.
 */

describe("upload thresholds", () => {
  it("hard cap is the server contract's 10 MB and exceeds the compression threshold", () => {
    expect(UPLOAD_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(COMPRESS_THRESHOLD_BYTES).toBeLessThan(UPLOAD_MAX_BYTES);
  });

  it("small files skip compression; large files are flagged", () => {
    expect(shouldCompress({ size: 500 * 1024, type: "image/jpeg" })).toBe(false);
    expect(shouldCompress({ size: COMPRESS_THRESHOLD_BYTES, type: "image/jpeg" })).toBe(false);
    expect(shouldCompress({ size: COMPRESS_THRESHOLD_BYTES + 1, type: "image/jpeg" })).toBe(true);
    expect(shouldCompress({ size: 8 * 1024 * 1024, type: "image/png" })).toBe(true);
  });
});

describe("computeScaledDimensions", () => {
  it("never upscales — images at or below the bound keep exact dimensions", () => {
    expect(computeScaledDimensions(1200, 900)).toEqual({ width: 1200, height: 900 });
    expect(computeScaledDimensions(COMPRESS_MAX_DIMENSION, COMPRESS_MAX_DIMENSION)).toEqual({
      width: COMPRESS_MAX_DIMENSION,
      height: COMPRESS_MAX_DIMENSION,
    });
  });

  it("bounds the longest edge while preserving aspect ratio", () => {
    const { width, height } = computeScaledDimensions(4032, 3024);
    expect(width).toBe(COMPRESS_MAX_DIMENSION);
    expect(Math.round(height)).toBe(Math.round((3024 / 4032) * COMPRESS_MAX_DIMENSION));

    const portrait = computeScaledDimensions(3024, 4032);
    expect(portrait.height).toBe(COMPRESS_MAX_DIMENSION);
    expect(portrait.width).toBeLessThan(COMPRESS_MAX_DIMENSION);
  });

  it("degenerate dimensions return zeros instead of throwing", () => {
    expect(computeScaledDimensions(0, 0)).toEqual({ width: 0, height: 0 });
    expect(computeScaledDimensions(-5, 100)).toEqual({ width: 0, height: 0 });
  });
});

describe("compressImageFile — honest degradation (no browser APIs)", () => {
  it("files under the threshold pass through untouched", async () => {
    const file = new File(["x"], "small.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 500 * 1024 });
    const result = await compressImageFile(file);
    expect(result.compressed).toBe(false);
    expect(result.file).toBe(file);
  });

  it("without createImageBitmap, oversized files return UNCHANGED (never discarded silently)", async () => {
    const file = new File(["x"], "big.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 8 * 1024 * 1024 });
    const result = await compressImageFile(file);
    expect(result.compressed).toBe(false);
    expect(result.file).toBe(file);
  });
});
