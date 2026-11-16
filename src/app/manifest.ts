import type { MetadataRoute } from "next";

/*
 * PWA manifest (Phase 6 PWA groundwork; PROJECT_PLAN product = "responsive
 * website + PWA"). Instability guard: static values only. The SVG icon is
 * resolution-independent; PNG icon exports are a Phase 6 polish task.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PlantAI — Identify and Care for Your Plants",
    short_name: "PlantAI",
    description:
      "Identify plants from photos with AI-powered plant identification, then learn watering, sunlight, soil and fertilizer basics from a growing plant library.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#059669",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
