import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * /auth/confirm — email-confirmation + token_hash recovery callback
 * (Phase 2 auth, FR-AUTH-004/006; unchanged by the F8 recovery fix).
 *
 * Handles links whose template puts `token_hash` + `type` in the QUERY
 * STRING (e.g. a customized sign-up template), verified SERVER-side with
 * `verifyOtp` (the token never touches client JS), establishing the cookie
 * session via @supabase/ssr. Then:
 *   - signup/invite/magiclink → /login?confirmed=1 (guest-only page;
 *     the proxy bounces verified sessions to /dashboard automatically,
 *     so a just-confirmed user lands signed-in on their dashboard). Note
 *     (F9): the app's own magic-link / sign-up emails now use the PKCE
 *     client-side landing (/auth/link), so this branch only serves
 *     token_hash-style templates — it stays for exactly that case.
 *   - recovery → /reset-password (session established; the user sets a
 *     new password there).
 *
 * It CANNOT handle PKCE `?code=…` links: a PKCE code can only be exchanged
 * by the browser client holding the matching code_verifier (stored at
 * request time), so a server route is structurally unable to consume it —
 * this exact mismatch sent every PKCE recovery click to /login?error=link
 * (Phase 5 incident). Password recovery therefore no longer routes through
 * here (redirectTo now points at /reset-password directly, which exchanges
 * the code client-side); all failures below remain generic and
 * non-revealing.
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
