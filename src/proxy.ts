import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "@/lib/env";

/**
 * Next.js 16 Proxy (formerly middleware; ARCHITECTURE.md ADR-10) —
 * Supabase session refresh + route protection + pre-render published-slug
 * checks for the two dynamic public content routes.
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

/** Matches the canonical slug format enforced by both content tables. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface PublishedSlugRoute {
  kind: "plant" | "blog";
  slug: string;
  valid: boolean;
}

/**
 * Recognises only the two dynamic public routes. A malformed slug is still a
 * route match; it is rejected below without a database query because no
 * published row can carry it (schema CHECK constraint).
 */
function parsePublishedSlugRoute(
  pathname: string
): PublishedSlugRoute | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 2) return null;

  const [prefix, slug] = segments;
  if (prefix !== "plant" && prefix !== "blog") return null;

  return { kind: prefix, slug, valid: SLUG_PATTERN.test(slug) };
}

/** Copies refreshed Supabase session state onto a response we create here. */
function copySessionState(
  source: NextResponse,
  target: NextResponse
): NextResponse {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(header);
    if (value) target.headers.set(header, value);
  }
  return target;
}

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
    return copySessionState(supabaseResponse, redirectResponse);
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
    return copySessionState(supabaseResponse, redirectResponse);
  }

  /*
   * Cache Components streams the shell with a 200 before request-time
   * notFound() can set a status. Check the published slug here, before any
   * response starts, so unknown slugs are genuine 404s. A database error must
   * never be treated as "missing" — let the page render (and keep its own
   * notFound() safeguard) instead of hiding a valid published row.
   */
  const slugRoute = parsePublishedSlugRoute(pathname);
  if (slugRoute) {
    let publishedExists: boolean | null = slugRoute.valid ? null : false;

    if (slugRoute.valid) {
      try {
        if (slugRoute.kind === "plant") {
          const { data, error } = await supabase
            .from("plant_library")
            .select("slug")
            .eq("slug", slugRoute.slug)
            .eq("is_published", true)
            .maybeSingle();
          if (error) {
            console.error(
              "[proxy] plant slug lookup failed; allowing render:",
              error.message
            );
          } else {
            publishedExists = data !== null;
          }
        } else {
          const { data, error } = await supabase
            .from("blog_posts")
            .select("slug")
            .eq("slug", slugRoute.slug)
            .eq("status", "published")
            .maybeSingle();
          if (error) {
            console.error(
              "[proxy] blog slug lookup failed; allowing render:",
              error.message
            );
          } else {
            publishedExists = data !== null;
          }
        }
      } catch (error) {
        console.error(
          "[proxy] published slug lookup threw; allowing render:",
          error instanceof Error ? error.message : "unknown error"
        );
        publishedExists = null;
      }
    }

    if (publishedExists === false) {
      const notFoundResponse = NextResponse.rewrite(
        new URL("/not-found", request.url),
        { status: 404 }
      );
      return copySessionState(supabaseResponse, notFoundResponse);
    }
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
