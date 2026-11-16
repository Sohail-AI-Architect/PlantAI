import Link from "next/link";

/*
 * Root 404 (mission requirement: sensible not-found state). Unknown
 * /plant/[slug] and /blog/[slug] routes land here with a real 404 status.
 */
export default function NotFound() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
      <p className="text-brand-700 text-sm font-semibold uppercase tracking-wide">
        404
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        This page doesn’t exist
      </h1>
      <p className="text-foreground-muted mt-4 text-sm leading-relaxed">
        The page you’re looking for was moved, renamed, or never existed. The
        plant you were after might not be published in the library yet.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/identify"
          className="bg-brand-600 hover:bg-brand-700 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          Identify a plant
        </Link>
        <Link
          href="/library"
          className="border-border-muted hover:bg-surface rounded-lg border px-5 py-2.5 text-sm font-semibold transition-colors"
        >
          Browse plant guides
        </Link>
      </div>
    </section>
  );
}
