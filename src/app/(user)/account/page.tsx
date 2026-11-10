import type { Metadata } from "next";
import { RouteStub } from "@/components/layout/route-stub";

export const metadata: Metadata = { title: "Account" };

/*
 * /account — canonical route stub. Profile editing + the "Delete my data"
 * erasure flow ship in Phase 4 (P4-05, LEGAL_AND_COMPLIANCE.md §11).
 */
export default function AccountPage() {
  return (
    <RouteStub
      title="Account"
      phase="Phase 4"
      description="Profile settings, display name, and — when you want it — a two-step 'Delete my data' erasure flow that removes your plants, reminders and saved species."
    />
  );
}
