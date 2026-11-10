import type { Metadata } from "next";
import { RouteStub } from "@/components/layout/route-stub";

export const metadata: Metadata = { title: "About" };

/*
 * /about — canonical route stub. Full project story + Pl@ntNet attribution
 * section ships in Phase 3 (LEGAL_AND_COMPLIANCE.md §7).
 */
export default function AboutPage() {
  return (
    <RouteStub
      title="About PlantAI"
      phase="Phase 3"
      description="The full story: why PlantAI exists, how identification works (and its limits), who runs the project, and the data sources (including the Pl@ntNet attribution policy)."
    />
  );
}
