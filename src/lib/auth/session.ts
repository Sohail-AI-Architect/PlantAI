import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Server-side identity verification helpers (Phase 2 auth, SECURITY.md §4).
 *
 * Rule (current official Supabase SSR guidance): the session cookie can be
 * forged client-side, so `getSession()` user data must never be trusted for
 * authorization. Identity is verified with `auth.getClaims()` — the token's
 * signature is verified on every call (locally via JWKS on asymmetric-key
 * projects, the default for new projects). `auth.getUser()` (fresh,
 * server-confirmed user record) is used where an up-to-date user record is
 * genuinely required (e.g. the identify pipeline's user_id).
 *
 * The proxy (src/proxy.ts) refreshes sessions + redirects for UX; these
 * helpers are the security check for Server Components, Server Actions and
 * Route Handlers — defense in depth (ARCHITECTURE.md §7, SECURITY.md).
 */

export interface AuthContext {
  /** Verified user id, or null when anonymous. */
  userId: string | null;
  email: string | null;
}

/** Verified claims for any server context; null user when anonymous. */
export async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return { userId: null, email: null };
  const claims = data.claims as { sub?: string; email?: string };
  return {
    userId: claims.sub ?? null,
    email: claims.email ?? null,
  };
}

export async function isAuthenticated(): Promise<boolean> {
  const { userId } = await getAuthContext();
  return userId !== null;
}

/**
 * Server Component guard: redirects to /login when no verified session.
 * `redirectTo` lets the login form send the user back after signing in.
 */
export async function requireAuthRedirect(
  redirectTo: string
): Promise<AuthContext & { userId: string }> {
  const auth = await getAuthContext();
  if (!auth.userId) {
    redirect(`/login?next=${encodeURIComponent(redirectTo)}`);
  }
  return auth as AuthContext & { userId: string };
}

/**
 * Server Component guard for guest-only pages (login/signup): verified
 * session present → send the user to their dashboard instead.
 */
export async function redirectIfAuthenticated(): Promise<void> {
  if (await isAuthenticated()) redirect("/dashboard");
}

/**
 * Wrapper for protected page content: the guard runs inside a Suspense
 * boundary (Cache Components — Next.js 16; runtime cookie reads must stream
 * inside a Suspense boundary, node_modules/next docs §Caching).
 */
export async function withAuthGuard(
  redirectTo: string,
  children: (auth: AuthContext & { userId: string }) => ReactNode
): Promise<ReactNode> {
  const auth = await requireAuthRedirect(redirectTo);
  return children(auth);
}
