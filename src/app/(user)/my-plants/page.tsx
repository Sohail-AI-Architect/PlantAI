import type { Metadata } from "next";
import { RouteStub } from "@/components/layout/route-stub";

export const metadata: Metadata = { title: "My Plants" };

/*
 * /my-plants — canonical route stub. Personal plant library + photos ship
 * in Phase 4 (P4-01) on top of the user_plants table.
 */
export default function MyPlantsPage() {
  return (
    <RouteStub
      title="My Plants"
      phase="Phase 4"
      description="Your personal plant collection: nicknames, photos, notes, and linked care guidance. Built on signed-in accounts in Phase 4."
    />
  );
}
