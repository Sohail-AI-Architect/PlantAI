/*
 * Sample-data notice for the mock provider.
 *
 * Live identification requires explicit PLANTNET_MODE=live plus a valid
 * server-only key; a key by itself never enables it. This banner is shown
 * whenever the response used mock identification, keeping that honest
 * without claiming live identification is "coming later".
 */
export function MockDemoBanner() {
  return (
    <div
      role="status"
      className="border-warning/30 bg-warning/10 text-warning rounded-lg border px-4 py-3 text-sm"
    >
      <p className="font-semibold">Sample data — not a live identification</p>
      <p className="mt-1">
        Live Pl@ntNet identification isn&apos;t active for these results — it
        requires explicit opt-in and a valid server-side key — so the matches
        below come from built-in sample data.
      </p>
    </div>
  );
}
