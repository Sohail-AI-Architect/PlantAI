import Link from "next/link";
import { getAuthContext } from "@/lib/auth/session";
import { SignOutButton } from "@/components/auth/sign-out-button";

/**
 * Auth-aware header slot (FR-AUTH-005/008/010). Server component: identity
 * comes from verified claims server-side, never client storage. The native
 * <details>/<summary> account menu is keyboard accessible without extra
 * client JavaScript and exposes Create/Sign in links or account + sign out.
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

  const accountName = auth.displayName ?? auth.email ?? "Your account";

  return (
    <details className="relative">
      <summary
        aria-label="Account menu"
        className="hover:bg-brand-50 hover:text-brand-800 flex max-w-[12rem] cursor-pointer items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors"
      >
        <span className="truncate">{accountName}</span>
        <span aria-hidden="true" className="text-[10px]">
          ▾
        </span>
      </summary>
      <div className="border-border-muted bg-surface absolute right-0 z-20 mt-2 w-56 rounded-lg border p-2 shadow-lg">
        <p className="text-foreground-muted truncate px-3 py-1.5 text-xs">
          {accountName}
        </p>
        <Link
          href="/dashboard"
          className="hover:bg-brand-50 block rounded-md px-3 py-2 text-sm transition-colors"
        >
          Dashboard
        </Link>
        <Link
          href="/account"
          className="hover:bg-brand-50 block rounded-md px-3 py-2 text-sm transition-colors"
        >
          Account settings
        </Link>
        <div className="border-border-muted mt-1 border-t pt-1">
          <SignOutButton className="hover:bg-brand-50 hover:text-brand-800 block w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors disabled:opacity-60" />
        </div>
      </div>
    </details>
  );
}
