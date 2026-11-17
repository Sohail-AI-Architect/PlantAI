import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/*
 * Offline contract test for canonical declarations (Stage 2C, live-verified
 * gap: the homepage was the only public page without `alternates.canonical`).
 *
 * Scope honesty: this is a SOURCE-contract test — it asserts that every
 * indexable public page file declares its own canonical URL (and that the
 * ROOT layout does NOT, since a root-level canonical would hijack child
 * pages that don't override it). It cannot verify the RENDERED <link
 * rel="canonical"> on the live site; that is a post-deploy check.
 */

const root = path.resolve(process.cwd());

const PUBLIC_PAGES: Array<[string, string]> = [
  ["homepage", "src/app/(public)/page.tsx"],
  ["identify", "src/app/(public)/identify/page.tsx"],
  ["library", "src/app/(public)/library/page.tsx"],
  ["blog index", "src/app/(public)/blog/page.tsx"],
  ["blog article", "src/app/(public)/blog/[slug]/page.tsx"],
  ["about", "src/app/(public)/about/page.tsx"],
  ["contact", "src/app/(public)/contact/page.tsx"],
  ["privacy", "src/app/(public)/privacy/page.tsx"],
  ["terms", "src/app/(public)/terms/page.tsx"],
  ["cookie policy", "src/app/(public)/cookie-policy/page.tsx"],
  ["plant detail", "src/app/(public)/plant/[slug]/page.tsx"],
];

function source(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("canonical URL contract — every indexable public page", () => {
  it.each(PUBLIC_PAGES)("%s declares its own canonical", (_name, rel) => {
    expect(source(rel)).toMatch(/canonical/);
  });

  it("root layout does NOT declare a global canonical (would hijack children)", () => {
    const layout = source("src/app/layout.tsx");
    expect(layout.includes("alternates")).toBe(false);
  });
});
