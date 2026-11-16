import { ACCEPTED_IMAGE_MIMES } from "@/lib/validation/identify";

/**
 * Server-side image validation (API_DOCUMENTATION.md §2.9 V1–V4, V9).
 *
 * The client-declared MIME type is never trusted (owner requirement +
 * SECURITY.md): the file signature is sniffed from the first bytes:
 *   JPEG: FF D8 FF
 *   PNG:  89 50 4E 47 0D 0A 1A 0A
 */

const JPEG_MAGIC = [0xff, 0xd8, 0xff] as const;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

export type ImageKind = "image/jpeg" | "image/png";

export interface ImageValidationOk {
  ok: true;
  kind: ImageKind;
  bytes: Uint8Array;
  size: number;
}

export interface ImageValidationFailure {
  ok: false;
  /** Stable machine code for the response envelope (§2.7). */
  code: "unsupported_image" | "image_too_large" | "empty_file";
  message: string;
}

function startsWith(bytes: Uint8Array, magic: readonly number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((m, i) => bytes[i] === m);
}

/** Sniffs the real image type from magic bytes — never trusts declared MIME. */
export function sniffImageKind(bytes: Uint8Array): ImageKind | null {
  if (startsWith(bytes, JPEG_MAGIC)) return "image/jpeg";
  if (startsWith(bytes, PNG_MAGIC)) return "image/png";
  return null;
}

/**
 * Validates one uploaded image: non-empty, sniffed type in the accepted set,
 * size ≤ maxBytes. Buffer length is re-checked (a spoofed Content-Length or
 * client MIME cannot pass).
 */
export function validateUploadedImage(
  bytes: Uint8Array,
  maxBytes: number
): ImageValidationOk | ImageValidationFailure {
  if (bytes.length === 0) {
    return {
      ok: false,
      code: "empty_file",
      message: "An uploaded file was empty.",
    };
  }

  if (bytes.length > maxBytes) {
    return {
      ok: false,
      code: "image_too_large",
      message: `An image exceeds the ${Math.round(maxBytes / (1024 * 1024))} MB limit.`,
    };
  }

  const kind = sniffImageKind(bytes);
  if (!kind || !(ACCEPTED_IMAGE_MIMES as readonly string[]).includes(kind)) {
    return {
      ok: false,
      code: "unsupported_image",
      message: "Only JPEG or PNG photos are supported.",
    };
  }

  return { ok: true, kind, bytes, size: bytes.length };
}
