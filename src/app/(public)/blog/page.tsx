import type { Metadata } from "next";
import { RouteStub } from "@/components/layout/route-stub";

export const metadata: Metadata = { title: "Blog" };

/*
 * /blog — canonical route stub. Publishing per CONTENT_STRATEGY.md lands in
 * Phase 4+ (blog_posts table already defined in DATABASE_SCHEMA.md).
 */
export default function BlogPage() {
  return (
    <RouteStub
      title="Plant care blog"
      phase="Phase 4+"
      description="Seasonal and topic articles — watering mistakes, repotting basics and more — written to our editorial quality standards. Publishing starts alongside the content library in Phase 4."
    />
  );
}
