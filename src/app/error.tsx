"use client";

/*
 * Root error boundary (mission requirement: sensible error state). Renders
 * a retry affordance; the real cause is logged server/console-side by Next,
 * never shown raw to users (privacy-safe error surfaces, SECURITY.md §4).
 */
export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Something went wrong</h1>
      <p className="text-foreground-muted mt-4 text-sm leading-relaxed">
        An unexpected error occurred while loading this page. Please try
        again — if it keeps happening, we’d appreciate a{" "}
        <a href="/contact" className="underline hover:text-foreground">
          bug report
        </a>
        .
      </p>
      <button
        type="button"
        onClick={reset}
        className="bg-brand-600 hover:bg-brand-700 mt-8 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-colors"
      >
        Try again
      </button>
      {process.env.NODE_ENV === "development" && error.digest && (
        <p className="text-foreground-muted mt-4 text-xs">
          Error digest: {error.digest}
        </p>
      )}
    </section>
  );
}
