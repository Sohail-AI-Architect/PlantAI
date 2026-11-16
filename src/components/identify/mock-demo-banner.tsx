/*
 * Mock-mode transparency banner (owner requirement: a mock result must
 * NEVER be presented as a real AI identification).
 *
 * Shown in the results view whenever `mode === "mock"`, mirroring the
 * API's `mockNotice` field (API_DOCUMENTATION.md §2.6 additive fields).
 */
export function MockDemoBanner() {
  return (
    <div
      role="status"
      className="border-warning/30 bg-warning/10 text-warning rounded-lg border px-4 py-3 text-sm"
    >
      <p className="font-semibold">Demo result — testing mode</p>
      <p className="mt-1">
        PlantAI is running in demonstration mode. This is{" "}
        <strong>not a real AI identification</strong> — results come from
        built-in example data. Real Pl@ntNet identification is switched on in
        a later phase.
      </p>
    </div>
  );
}
