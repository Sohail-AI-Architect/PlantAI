/*
 * Shared placeholder for stubbed canonical routes (roadmap task 1.6).
 *
 * Every route stub states honestly what ships in which phase — per the
 * project rule "never claim an incomplete feature is complete" and
 * "never create fake functionality".
 */

interface PhaseStubProps {
  title: string;
  phase: string;
  description: string;
}

export function RouteStub({ title, phase, description }: PhaseStubProps) {
  return (
    <section className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="text-brand-700 text-sm font-semibold uppercase tracking-wide">
        {phase}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-foreground-muted mt-4 text-base leading-relaxed">
        {description}
      </p>
    </section>
  );
}
