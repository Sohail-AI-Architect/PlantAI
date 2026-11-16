import Link from "next/link";
import { getAuthContext } from "@/lib/auth/session";
import { SignOutButton } from "@/components/auth/sign-out-button";

/**
 * Auth-aware header slot (Phase 2 auth, FR-AUTH-008/010). Server component:
 * identity comes from verified claims (getClaims) server-side — the UI
 * never decides session state from client storage alone.
 *
 * Rendered inside a <Suspense> boundary in the header (Cache Components:
 * runtime cookie reads must stream, Next.js 16).
 */
export async function AuthNav() {
  const auth = await getAuthContext();

  if (!auth.userId) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="hover:bg-brand-50 hover:text-brand-800 rounded-md px-3 py-2 text-sm font-medium transition-colors"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="bg-brand-600 hover:bg-brand-700 rounded-md px-3 py-2 text-sm font-semibold text-white transition-colors"
        >
          Create account
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/dashboard"
        className="hover:bg-brand-50 hover:text-brand-800 rounded-md px-3 py-2 text-sm font-medium transition-colors"
      >
        Dashboard
      </Link>
      <SignOutButton />
    </div>
  );
}
