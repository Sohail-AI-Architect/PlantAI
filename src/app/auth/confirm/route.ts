import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * /auth/confirm — email confirmation + password-recovery callback
 * (Phase 2 auth, FR-AUTH-004/006).
 *
 * Supabase's default email templates send `token_hash` + `type` as query
 * params. Verification happens SERVER-side with `verifyOtp` (the token
 * never touches client JS), establishing the cookie session via
 * @supabase/ssr. Then:
 *   - signup/invite/magiclink → /login?confirmed=1 (guest-only page;
 *     the proxy bounces verified sessions to /dashboard automatically,
 *     so a just-confirmed user lands signed-in on their dashboard).
 *   - recovery → /reset-password (session established; the user sets a
 *     new password there).
 *
 * All failures redirect to /login with a generic, non-revealing error flag
 * — invalid/expired/replayed tokens are indistinguishable to callers.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const loginWithError = () => {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?error=link";
    url.hash = "";
    return NextResponse.redirect(url);
  };

  if (!tokenHash || !type) return loginWithError();

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return loginWithError();

  const destination = type === "recovery" ? "/reset-password" : "/login?confirmed=1";
  return NextResponse.redirect(new URL(destination, origin));
}
