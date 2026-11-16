import Link from "next/link";

/*
 * Global footer — Phase 1 skeleton.
 *
 * Attribution note (LEGAL_AND_COMPLIANCE.md §7): the Pl@ntNet attribution
 * text and "Powered by Pl@ntNet" badge are surfaced in Phase 3 together
 * with the first real identification surface (P3-08). No attribution footer
 * is shown before any actual API-based identification ships.
 *
 * Legal pages are stub routes in Phase 1; their real content ships in
 * Phase 3 (P3-05 per TASKS.md).
 *
 * The year is intentionally static: Next 16 Cache Components rejects
 * unstable `new Date()` during prerendering, and a static year avoids any
 * hydration concern. Bump within the annual CHANGELOG review task.
 */

const LEGAL_LINKS = [
  { href: "/identify", label: "Identify a plant" },
  { href: "/library", label: "Plant library" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/cookie-policy", label: "Cookie Policy" },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-border-muted bg-surface mt-12 border-t">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm font-semibold">
            Plant<span className="text-brand-700">AI</span>
          </p>
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-4 gap-y-2">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-foreground-muted hover:text-brand-700 text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="mt-4 text-foreground-muted text-xs">
          © 2026 PlantAI. Plant identification and care
          information is provided for educational purposes. In development —
          features ship phase by phase.
        </p>
      </div>
    </footer>
  );
}
