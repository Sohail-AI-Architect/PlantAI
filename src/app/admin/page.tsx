import type { Metadata } from "next";
import { RouteStub } from "@/components/layout/route-stub";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/*
 * /admin — canonical route stub, deliberately sparse.
 * The admin moderation panel (plant library + blog + contact inbox) ships
 * in Phase 3–4 behind the profiles.role='admin' check (DATABASE_SCHEMA.md
 * is_admin()). SEO_STRATEGY.md robots rules exclude /admin from indexing;
 * the metadata directive already enforces noindex here.
 */
export default function AdminPage() {
  return (
    <RouteStub
      title="Admin"
      phase="Phase 3–4"
      description="Role-gated moderation area. Before the panel exists, admin updates happen via SQL migrations only — by design (see DATABASE_SCHEMA.md profiles notes)."
    />
  );
}
