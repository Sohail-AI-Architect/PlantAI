import type { Metadata } from "next";
import { RouteStub } from "@/components/layout/route-stub";

export const metadata: Metadata = { title: "Terms of Service" };

/*
 * /terms — canonical route stub. Real ToS ships in Phase 3
 * (LEGAL_AND_COMPLIANCE.md §3).
 */
export default function TermsPage() {
  return (
    <RouteStub
      title="Terms of Service"
      phase="Phase 3"
      description="The terms of use — acceptable use, content rights, disclaimers about AI-assisted identification accuracy, and limitation of liability — ship with the first public content release in Phase 3."
    />
  );
}
