import type { Metadata } from "next";
import { RouteStub } from "@/components/layout/route-stub";

export const metadata: Metadata = { title: "Dashboard" };

/*
 * /dashboard — canonical route stub. Personal summary (plant count, upcoming
 * care) ships in Phase 4 (P4-04).
 */
export default function DashboardPage() {
  return (
    <RouteStub
      title="Your dashboard"
      phase="Phase 4"
      description="A quick personal overview: your plants, identification history, and what care is coming up."
    />
  );
}
