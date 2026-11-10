import type { Metadata } from "next";
import { RouteStub } from "@/components/layout/route-stub";

export const metadata: Metadata = { title: "Plant library" };

/*
 * /library — canonical route stub. Species content, search (?q=) and the
 * plant catalog ship in Phase 3 (P3-01, P3-06, P3-07).
 */
export default function LibraryPage() {
  return (
    <RouteStub
      title="Plant library"
      phase="Phase 3"
      description="An editorial library of plant species with practical care guidance — watering, sunlight, soil, fertilizer — plus full-text search. The first entries are authored and fact-checked in Phase 3."
    />
  );
}
