import Link from "next/link";

/*
 * Homepage — Phase 1 skeleton slice.
 *
 * Honest-by-design placeholder: identification goes live in Phase 2
 * (DEVELOPMENT_ROADMAP.md §4); library/search content in Phase 3. No fake
 * UI mock of an identification flow is shown.
 */

const COMING_FEATURES = [
  {
    title: "AI plant identification",
    phase: "Phase 2",
    body: "Upload a photo and get likely species matches powered by the Pl@ntNet recognition engine, with honest confidence scores.",
  },
  {
    title: "Growing plant library",
    phase: "Phase 3",
    body: "Human-written care guides: watering, sunlight, soil and fertilizer basics for common houseplants and garden species.",
  },
  {
    title: "Personal plant care",
    phase: "Phase 4",
    body: "Save plants, keep notes and get care reminders so nothing dries out while you look the other way.",
  },
] as const;

export default function HomePage() {
  return (
    <div>
      <section className="bg-surface-muted border-border-muted border-b">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <p className="text-brand-700 text-sm font-semibold uppercase tracking-wide">
            In development
          </p>
          <h1 className="mt-2 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Identify your plants — and learn how to keep them healthy
          </h1>
          <p className="text-foreground-muted mt-4 max-w-2xl text-lg leading-relaxed">
            AI-assisted plant identification and care platform
            under active construction. The core identification experience
            launches in Phase 2; until then you can watch this space.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6" aria-label="Coming features">
        <h2 className="text-2xl font-bold tracking-tight">What’s coming</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {COMING_FEATURES.map((feature) => (
            <li
              key={feature.title}
              className="border-border-muted bg-surface rounded-xl border p-5"
            >
              <p className="text-brand-700 text-xs font-semibold uppercase tracking-wide">
                {feature.phase}
              </p>
              <h3 className="mt-2 font-semibold">{feature.title}</h3>
              <p className="text-foreground-muted mt-2 text-sm leading-relaxed">
                {feature.body}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-8">
          <Link
            href="/about"
            className="text-brand-700 hover:text-brand-800 text-sm font-semibold"
          >
            Learn more about the project →
          </Link>
        </p>
      </section>
    </div>
  );
}
