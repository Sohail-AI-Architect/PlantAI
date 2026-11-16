/**
 * Canonical organ enum — shared by the Zod request schema (server), the
 * upload UI (client), and the live provider's upstream mapping.
 *
 * Stage C (2026-11-13) correction per the verified Stage A1 upstream contract
 * (docs/VERIFIED_FACTS.md): valid values are `leaf`, `flower`, `fruit`, `bark`
 * plus `auto` (automatic detection). The previously listed `lateral`/`root`
 * values are NOT valid upstream values and are rejected with HTTP 400 by the
 * request schema before any upstream call can be made.
 *
 * This module is deliberately dependency-free (no zod) so client components
 * can import the same canonical enum without pulling server-side validation
 * into the client bundle.
 */

export const ORGANS = ["leaf", "flower", "fruit", "bark", "auto"] as const;

export type Organ = (typeof ORGANS)[number];

export const DEFAULT_ORGAN: Organ = "auto";

/** Upstream-valid, non-auto values — the ones ever sent as repeated `organs`. */
export const UPSTREAM_ORGAN_VALUES = ["leaf", "flower", "fruit", "bark"] as const;

/** Human labels for the optional organ selector (UI_UX_DESIGN.md §6.2). */
export const ORGAN_LABELS: Record<Organ, string> = {
  leaf: "Leaf",
  flower: "Flower",
  fruit: "Fruit",
  bark: "Bark",
  auto: "Auto-detect (recommended)",
};
