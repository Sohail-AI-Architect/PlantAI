/*
 * JSON-LD injector (SEO_STRATEGY.md §8): a single component that emits
 * one `<script type="application/ld+json">` per call, fed ONLY from
 * server-controlled page data (never user input) — so no untrusted content
 * can reach the script tag (SECURITY.md §10 discipline).
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
