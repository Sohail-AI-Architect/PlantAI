import { Suspense } from "react";
import type { Metadata } from "next";
import { RouteStub } from "@/components/layout/route-stub";

export const metadata: Metadata = { title: "Plant detail" };

/*
 * /plant/[slug] — canonical dynamic route stub (FR-TEC-006 URL set).
 * Real per-species content pages ship in Phase 3 from plant_library.
 *
 * Next 16 note (Cache Components): `params` access streams inside
 * <Suspense> so the static shell prerenders cleanly; the shell is
 * replaced by DB-driven content in Phase 3.
 */
async function SlugNote({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <RouteStub
      title="Plant detail"
      phase="Phase 3"
      description={`Species detail pages at /plant/${slug} will be generated from the plant library in Phase 3 — care sections, images with attribution, and related plants.`}
    />
  );
}

export default function PlantDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense
      fallback={
        <RouteStub
          title="Plant detail"
          phase="Phase 3"
          description="Species detail pages ship with the plant library in Phase 3."
        />
      }
    >
      <SlugNote params={params} />
    </Suspense>
  );
}
