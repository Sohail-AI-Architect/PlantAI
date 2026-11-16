import Link from "next/link";
import { getAuthContext } from "@/lib/auth/session";

/**
 * Mobile bottom navigation (Phase 2, UI_UX_DESIGN.md §5): persistent 5-item
 * bar, ≥64px tall incl. safe-area, with the raised 56px Identify button —
 * the product's core action, one thumb-tap from anywhere.
 *
 * My Plants gating is graceful (spec slot 4): signed-out users are sent to
 * the sign-in page with `next=/my-plants`, and the proxy/protected page
 * would redirect there anyway — no dead ends, no fake account state.
 *
 * Server component + verified claims; rendered inside <Suspense> in the
 * root layout (Cache Components — Next.js 16).
 */

const ITEM_CLASS =
  "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-foreground-muted";

const LABEL_CLASS = "leading-none";

export async function BottomNav() {
  const auth = await getAuthContext();
  const myPlantsHref = auth.userId ? "/my-plants" : "/login?next=%2Fmy-plants";
  const myPlantsLabel = auth.userId ? "My Plants" : "My Plants";

  return (
    <nav
      aria-label="Mobile navigation"
      className="border-border-muted bg-surface fixed inset-x-0 bottom-0 z-40 flex border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <Link href="/" className={ITEM_CLASS}>
        <span aria-hidden="true" className="text-lg leading-none">
          ⌂
        </span>
        <span className={LABEL_CLASS}>Home</span>
      </Link>

      {/* Raised core action — centered platform button (spec slot 2). */}
      <Link
        href="/identify"
        className="flex flex-1 flex-col items-center justify-start"
      >
        <span
          aria-hidden="true"
          className="bg-brand-600 text-surface shadow-card -mt-5 flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-lg"
        >
          🌿
        </span>
        <span className={`${LABEL_CLASS} text-brand-800 pb-2 font-semibold`}>
          Identify
        </span>
      </Link>

      <Link href="/library" className={ITEM_CLASS}>
        <span aria-hidden="true" className="text-lg leading-none">
          📚
        </span>
        <span className={LABEL_CLASS}>Library</span>
      </Link>

      <Link href={myPlantsHref} className={ITEM_CLASS}>
        <span aria-hidden="true" className="text-lg leading-none">
          🪴
        </span>
        <span className={LABEL_CLASS}>{myPlantsLabel}</span>
      </Link>

      <Link
        href={auth.userId ? "/account" : "/login?next=%2Faccount"}
        className={ITEM_CLASS}
      >
        <span aria-hidden="true" className="text-lg leading-none">
          {auth.userId ? "👤" : "🔑"}
        </span>
        <span className={LABEL_CLASS}>{auth.userId ? "Account" : "Sign in"}</span>
      </Link>
    </nav>
  );
}
