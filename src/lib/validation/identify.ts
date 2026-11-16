import { z } from "zod";
import { DEFAULT_ORGAN, ORGANS } from "@/lib/plantnet/organs";

/**
 * `POST /api/identify` request contract (API_DOCUMENTATION.md §2.3/§2.9).
 * These zod schemas are the canonical contract objects (§1 rationale #3).
 *
 * Server rules implemented here + in image-validation:
 * - V1: exactly 1–3 images under the form key `images[]`
 * - V2: MIME image/jpeg | image/png — enforced by magic-byte sniff, never by
 *       the client-declared MIME type alone
 * - V3: ≤ 10 MB per image (tunable via app_settings.identify.image.max_bytes)
 * - V6: organ ∈ leaf|flower|fruit|bark|auto (default auto) — Stage C
 *       correction (2026-11-13) per the verified Stage A1 upstream contract:
 *       the previously accepted `lateral`/`root` values are NOT valid
 *       upstream organ values and are rejected with HTTP 400 BEFORE any
 *       upstream call (error-credit-burns rule, docs/VERIFIED_FACTS.md).
 * - V7: latitude/longitude numeric ranges; both-or-neither
 *
 * Unknown form fields are ignored silently (forward-compatibility, §2.3).
 */

export { ORGANS, type Organ } from "@/lib/plantnet/organs";

export const ACCEPTED_IMAGE_MIMES = ["image/jpeg", "image/png"] as const;

export const organSchema = z
  .string()
  .trim()
  .transform((v) => (v === "" ? DEFAULT_ORGAN : v))
  .pipe(z.enum(ORGANS))
  .default(DEFAULT_ORGAN);

/**
 * V7 both-or-neither predicate (shared by `geoSchema` and
 * `identifyRequestSchema`): latitude and longitude must be supplied together
 * or not at all — one-without-the-other is a client bug or abuse.
 */
function geoBothOrNeither(v: { latitude?: number; longitude?: number }): boolean {
  return (
    (v.latitude === undefined && v.longitude === undefined) ||
    (v.latitude !== undefined && v.longitude !== undefined)
  );
}

const geoFieldsSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

export const geoSchema = geoFieldsSchema
  .refine(geoBothOrNeither, {
    message: "latitude and longitude must be provided together (or both omitted)",
  })
  .optional();

export const identifyRequestSchema = geoFieldsSchema
  .extend({ organ: organSchema })
  .refine(geoBothOrNeither, {
    message: "latitude and longitude must be provided together (or both omitted)",
  });

export type IdentifyRequest = z.infer<typeof identifyRequestSchema>;

/** Error detail shape shared with the response envelope (§2.7 details[]). */
export interface ValidationErrorDetail {
  path: string;
  msg: string;
}

export function zodDetails(error: z.ZodError): ValidationErrorDetail[] {
  return error.issues.map((i) => ({
    path: i.path.join(".") || "_root",
    msg: i.message,
  }));
}
