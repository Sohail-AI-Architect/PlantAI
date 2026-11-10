import type { Metadata } from "next";
import { RouteStub } from "@/components/layout/route-stub";

export const metadata: Metadata = { title: "Privacy Policy" };

/*
 * /privacy — canonical route stub. The real policy (content outline in
 * LEGAL_AND_COMPLIANCE.md §2) is drafted with owner jurisdiction input and
 * ships in Phase 3 (P3-05). This stub intentionally makes no legal claims.
 */
export default function PrivacyPage() {
  return (
    <RouteStub
      title="Privacy Policy"
      phase="Phase 3"
      description="The full privacy policy — what data is collected, why, for how long, which third parties are involved (Supabase, hosting, Pl@ntNet), and your rights — ships with the first public content release in Phase 3."
    />
  );
}
