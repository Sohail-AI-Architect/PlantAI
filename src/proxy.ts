import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "@/lib/env";

/**
 * Next.js 16 Proxy (formerly middleware; ARCHITECTURE.md ADR-10) —
 * Supabase session refresh + route protection.
 *
 * Per the current official Supabase SSR guidance
 * (supabase.com/docs/guides/auth/server-side/creating-a-client):
 * 1. Refreshes the Auth token by calling `supabase.auth.getClaims()`
 *    (never `getSession()` — its user data is unverified cookie content).
 * 2. Passes refreshed cookies to Server Components via `request.cookies.set`.
 * 3. Passes refreshed cookies to the browser via `response.cookies.set`,
 *    copying the cache headers `@supabase/ssr` supplies so no CDN can cache
 *    a response containing a session.
 *
 * Route protection here is UX (redirect to /login); data security is RLS +
 * per-page/per-handler `getClaims()` checks (defense in depth, SECURITY.md).
 */

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/my-plants",
  "/saved-plants",
  "/reminders",
  "/account",
] as const;

/** Guest-only routes: a verified session gets bounced to the dashboard. */
const GUEST_ONLY_PREFIXES = ["/login", "/signup", "/forgot-password"] as const;

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { url, publishableKey } = getPublicSupabaseConfig();

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // Verifies the token signature once per request and refreshes the session
  // when the access token is close to expiry (current SSR guidance). Reusing
  // the result avoids repeated auth-endpoint calls on HS256 projects.
  const { data: authData } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(authData?.claims);

  const pathname = request.nextUrl.pathname;

  if (
    PROTECTED_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    ) &&
    !isAuthenticated
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    // Preserve the original query string as well as the path (browser
    // fragments never reach the server, so they cannot be restored here).
    redirectUrl.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search}`
    );
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // Preserve refreshed cookies + cache headers on the redirect.
    for (const cookie of supabaseResponse.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    for (const header of ["cache-control", "expires", "pragma"]) {
      const value = supabaseResponse.headers.get(header);
      if (value) redirectResponse.headers.set(header, value);
    }
    return redirectResponse;
  }

  if (
    GUEST_ONLY_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    ) &&
    isAuthenticated
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    // Keep flags such as ?confirmed=1 / ?reset=1 so the dashboard can show
    // the success message instead of silently dropping it.
    const redirectResponse = NextResponse.redirect(redirectUrl);
    for (const cookie of supabaseResponse.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    for (const header of ["cache-control", "expires", "pragma"]) {
      const value = supabaseResponse.headers.get(header);
      if (value) redirectResponse.headers.set(header, value);
    }
    return redirectResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Run on all app pages + the auth callback, but skip static assets and
     * image optimization (current proxy matcher convention).
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
