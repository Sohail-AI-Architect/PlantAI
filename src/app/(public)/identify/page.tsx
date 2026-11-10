import type { Metadata } from "next";
import { RouteStub } from "@/components/layout/route-stub";

export const metadata: Metadata = { title: "Identify a plant" };

/*
 * /identify — canonical route stub (roadmap task 1.6).
 * Real upload → identification flow ships in Phase 2 (P2-01…P2-05).
 */
export default function IdentifyPage() {
  return (
    <RouteStub
      title="Identify a plant"
      phase="Phase 2"
      description="The identification experience — upload one to three photos, choose the best match, and see care basics — is built in Phase 2. PlantAI will use the Pl@ntNet recognition engine server-side and never promise disease diagnosis."
    />
  );
}
