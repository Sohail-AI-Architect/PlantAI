/*
 * Sample-data notice for the local/dev mock provider.
 *
 * Live identification runs whenever PLANTNET_API_KEY is configured, so this
 * banner is only shown when the app is running on built-in sample data. It
 * keeps that honest without claiming live identification is "coming later".
 */
export function MockDemoBanner() {
  return (
    <div
      role="status"
      className="border-warning/30 bg-warning/10 text-warning rounded-lg border px-4 py-3 text-sm"
    >
      <p className="font-semibold">Sample data — not a live identification</p>
      <p className="mt-1">
        Live Pl@ntNet identification isn&apos;t enabled on this server right
        now, so the matches below come from built-in sample data.
      </p>
    </div>
  );
}
