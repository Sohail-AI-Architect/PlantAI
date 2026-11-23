import type { MetadataRoute } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/*
 * Sitemap (SEO_STRATEGY.md §9): static public routes + every PUBLISHED
 * plant slug with its real `updated_at` as lastmod (never build time —
 * fake churn is a misuse signal).
 *
 * Built with the session client so the query runs request-time (cookies →
 * dynamic generation; the build never touches the database). A database
 * failure degrades gracefully to the static routes — the sitemap must not
 * 500 the whole /sitemap.xml.
 */

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/*
 * Fixed last-modified date for the static routes. Using `new Date()` here
 * changed on every request and sent Google a fake "fresh content" signal.
 * Bump this value when the static pages actually change (plant entries keep
 * their real database `updated_at`).
 */
const STATIC_LAST_MODIFIED = new Date("2026-11-23");

const STATIC_ROUTES = [
  { path: "/", priority: 1.0 },
  { path: "/identify", priority: 0.9 },
  { path: "/library", priority: 0.9 },
  { path: "/blog", priority: 0.7 },
  { path: "/about", priority: 0.4 },
  { path: "/contact", priority: 0.4 },
  { path: "/privacy", priority: 0.2 },
  { path: "/terms", priority: 0.2 },
  { path: "/cookie-policy", priority: 0.2 },
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: new URL(route.path, siteUrl).toString(),
    lastModified: STATIC_LAST_MODIFIED,
    changeFrequency: route.path === "/" ? "weekly" : "monthly",
    priority: route.priority,
  }));

  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("plant_library")
      .select("slug, updated_at")
      .eq("is_published", true)
      .order("updated_at", { ascending: false })
      .limit(1000);

    for (const row of (data ?? []) as { slug: string; updated_at: string }[]) {
      entries.push({
        url: new URL(`/plant/${row.slug}`, siteUrl).toString(),
        lastModified: row.updated_at ? new Date(row.updated_at) : undefined,
        changeFrequency: "monthly",
        priority: 0.8,
      });
    }
  } catch {
    // Graceful degradation: static routes only (documented behavior).
  }

  return entries;
}
