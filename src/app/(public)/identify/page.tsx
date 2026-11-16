import { Suspense } from "react";
import type { Metadata } from "next";
import { getAuthContext } from "@/lib/auth/session";
import { IdentifyWidget } from "@/components/identify/identify-widget";
import { PlanteNetAttribution } from "@/components/identify/attribution";
import { MockDemoBanner } from "@/components/identify/mock-demo-banner";

export const metadata: Metadata = {
  title: "Identify a plant",
  description:
    "Upload 1–3 photos of a plant and get likely species matches with honest confidence scores, plus practical care basics. Demo mode identifies a limited set of species.",
  alternates: { canonical: "/identify" },
};

/*
 * /identify — Phase 2 (roadmap tasks 2.1/2.6, FR-UP-*, FR-ID-*).
 *
 * The auth context streams inside <Suspense> (verified claims read cookies —
 * runtime data under Cache Components, Next.js 16). The demo-mode notice is
 * shown honestly BEFORE any upload: this phase runs the mock provider.
 */
async function IdentifySection() {
  const auth = await getAuthContext();
  return (
    <div className="space-y-6">
      <MockDemoBanner />
      <IdentifyWidget isAuthenticated={auth.userId !== null} />
      <PlanteNetAttribution />
    </div>
  );
}

export default function IdentifyPage() {
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Identify a plant</h1>
      <p className="text-foreground-muted mt-2 text-sm leading-relaxed">
        Photos of the <em>same</em> plant, up to 3. Best organs: leaf, flower,
        fruit.
      </p>
      <div className="mt-8">
        <Suspense
          fallback={
            <p className="text-foreground-muted text-sm">Loading identify…</p>
          }
        >
          <IdentifySection />
        </Suspense>
      </div>
    </section>
  );
}
