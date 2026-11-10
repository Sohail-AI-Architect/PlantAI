import type { Metadata } from "next";
import { RouteStub } from "@/components/layout/route-stub";

export const metadata: Metadata = { title: "Reminders" };

/*
 * /reminders — canonical route stub. Care reminder engine ships in Phase 4
 * (P4-03) on care_reminders; the feature flag in app_settings
 * (feature.reminders=false) keeps it hidden until shipped.
 */
export default function RemindersPage() {
  return (
    <RouteStub
      title="Care reminders"
      phase="Phase 4"
      description="Watering, fertilizing, pruning and repotting reminders per plant, with sensible repeat intervals and a due-list view."
    />
  );
}
