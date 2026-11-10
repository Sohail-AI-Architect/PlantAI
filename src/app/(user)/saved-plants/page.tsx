import type { Metadata } from "next";
import { RouteStub } from "@/components/layout/route-stub";

export const metadata: Metadata = { title: "Saved Plants" };

/*
 * /saved-plants — canonical route stub. The basic save action (bookmarks of
 * library species) ships in Phase 2 (P2-08); the full management view is
 * Phase 4.
 */
export default function SavedPlantsPage() {
  return (
    <RouteStub
      title="Saved Plants"
      phase="Phase 2–4"
      description="Bookmarked species from the identification flow (basic saving arrives with Phase 2; the full management view arrives with Phase 4)."
    />
  );
}
