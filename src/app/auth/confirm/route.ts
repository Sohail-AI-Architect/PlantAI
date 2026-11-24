import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeAuthPath, withAuthNext } from "@/lib/auth/auth-contracts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * /auth/confirm — token_hash email-confirmation callback.
 *
 * Handles links whose template puts `token_hash` + `type` in the QUERY
 * STRING (e.g. a customized sign-up template):
 *   - signup/invite/magiclink → verified SERVER-side with `verifyOtp` (the
 *     token never touches client JS), establishing the cookie session via
 *     @supabase/ssr, then /login?confirmed=1 (proxy preserves the flag when
 *     bouncing an already-confirmed session to /dashboard). The app's own
 *     magic-link / sign-up emails use the PKCE client-side landing instead.
 *   - recovery → forwarded to /reset-password?token_hash=…&type=recovery.
 *     @supabase/auth-js reports PASSWORD_RECOVERY only in the browser that
 *     verifies the recovery token; consuming it here would lose that
 *     supported signal and leave only an ordinary session cookie.
 *
 * It CANNOT handle PKCE `?code=…` links: a PKCE code can only be exchanged
 * by the browser client holding the matching code_verifier (stored at
 * request time), so a server route is structurally unable to consume it —
 * this exact mismatch sent every PKCE recovery click to /login?error=link
 * (Phase 5 incident). The app's own recovery links point directly at
 * /reset-password, which exchanges the code client-side; all failures below
 * remain generic and non-revealing.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextPath = safeAuthPath(searchParams.get("next"));

  const loginWithError = () => {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?error=link";
    url.hash = "";
    return NextResponse.redirect(url);
  };

  if (!tokenHash || !type) return loginWithError();

  // Recovery tokens must be verified in the browser that will update the
  // password: @supabase/auth-js reports PASSWORD_RECOVERY / a recovery
  // redirectType there, which is the supported way to distinguish a genuine
  // recovery flow from an ordinary signed-in session. Do not consume the
  // one-time token in this server route first.
  if (type === "recovery") {
    const recoveryUrl = new URL(withAuthNext("/reset-password", nextPath), origin);
    recoveryUrl.searchParams.set("token_hash", tokenHash);
    recoveryUrl.searchParams.set("type", "recovery");
    return NextResponse.redirect(recoveryUrl);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return loginWithError();

  return NextResponse.redirect(new URL("/login?confirmed=1", origin));
}
