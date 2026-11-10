import Link from "next/link";

/*
 * Global header — Phase 1 skeleton slice (UI_UX_DESIGN.md §5 navigation).
 * Desktop links only for now; the mobile bottom-navigation pattern
 * (5-item bar with raised Identify button) is a Phase 2 task because it
 * belongs with the live identification flow.
 *
 * Marketing claim discipline: no identification is offered yet — the
 * Identify link points to a clearly-labelled Phase 2 stub.
 */

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/identify", label: "Identify" },
  { href: "/library", label: "Library" },
  { href: "/about", label: "About" },
] as const;

export function SiteHeader() {
  return (
    <header className="border-border-muted bg-surface border-b">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold tracking-tight"
        >
          <span
            aria-hidden="true"
            className="bg-brand-600 inline-block h-6 w-6 rounded-full"
          />
          <span>
            Plant<span className="text-brand-700">AI</span>
          </span>
        </Link>

        <nav aria-label="Main navigation">
          <ul className="flex items-center gap-1 sm:gap-3">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="hover:bg-brand-50 hover:text-brand-800 rounded-md px-3 py-2 text-sm font-medium transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="hidden sm:block">
              <Link
                href="/login"
                className="bg-brand-600 hover:bg-brand-700 rounded-md px-3 py-2 text-sm font-semibold text-white transition-colors"
              >
                Sign in
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
