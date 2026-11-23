import type { ReactNode } from "react";
import Link from "next/link";

interface LegalPageProps {
  title: string;
  updated: string;
  summary?: string;
  children: ReactNode;
}

/*
 * Shared shell for the public legal/policy pages (/about, /privacy,
 * /terms, /cookie-policy). Keeps the breadcrumb, heading, "last updated"
 * line and long-form typography consistent without pulling in a prose
 * plugin. The `.legal-prose` styles live in globals.css.
 */
export function LegalPage({ title, updated, summary, children }: LegalPageProps) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-foreground-muted text-xs">
        <Link href="/" className="underline hover:text-foreground">
          Home
        </Link>{" "}
        › <span aria-current="page">{title}</span>
      </nav>

      <header className="mt-4">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-foreground-muted mt-2 text-xs">
          Last updated: {updated}
        </p>
        {summary ? (
          <p className="text-foreground-muted mt-4 text-sm leading-relaxed">
            {summary}
          </p>
        ) : null}
      </header>

      <div className="legal-prose mt-8">{children}</div>
    </article>
  );
}
