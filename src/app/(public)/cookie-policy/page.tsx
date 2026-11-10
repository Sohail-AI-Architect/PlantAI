import type { Metadata } from "next";
import { RouteStub } from "@/components/layout/route-stub";

export const metadata: Metadata = { title: "Cookie Policy" };

/*
 * /cookie-policy — canonical route stub. The real inventory ships in
 * Phase 3; the consent banner activates only when ad/analytics scripts
 * switch on in Phase 5 (REQUIREMENTS.md FR-MON-002).
 */
export default function CookiePolicyPage() {
  return (
    <RouteStub
      title="Cookie Policy"
      phase="Phase 3"
      description="An honest cookie inventory (authentication session cookies first; advertising cookies only if ads ever switch on in Phase 5). The banner arrives only when something actually needs consent."
    />
  );
}
