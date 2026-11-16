import type { MetadataRoute } from "next";

/*
 * robots.txt (SEO_STRATEGY.md §10): allow the public site; disallow the
 * private/admin/API surfaces. Private routes additionally carry
 * `robots: { index: false }` metadata — robots.txt is a courtesy for
 * well-behaved crawlers, the metadata is the actual noindex control.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/account",
        "/my-plants",
        "/saved-plants",
        "/dashboard",
        "/reminders",
        "/api/",
        "/auth/",
      ],
    },
  };
}
