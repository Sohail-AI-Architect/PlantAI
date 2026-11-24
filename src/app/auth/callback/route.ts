import { NextResponse, type NextRequest } from "next/server";
import {
  isSuccessfulOAuthExchange,
  oauthDestination,
  oauthFailurePath,
} from "@/lib/auth/google-oauth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * /auth/callback — Supabase Google OAuth PKCE landing.
 *
 * `signInWithOAuth` starts the flow from the browser with the SDK's PKCE
 * verifier in the same cookie jar. Google returns `?code=` here; this Route
 * Handler exchanges it with the SERVER Supabase client, so the verified
 * session and refresh token are written through @supabase/ssr cookies before
 * the redirect. The existing proxy and `getClaims()` guards then see the
 * session exactly as they do for any other Supabase Auth session.
 *
 * This is separate from /auth/confirm (email token_hash) and /auth/link
 * (email PKCE), which remain untouched for rollback/outstanding emails.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const nextPath = oauthDestination(searchParams.get("next"));

  const fail = () =>
    NextResponse.redirect(new URL(oauthFailurePath(nextPath), origin));

  const code = searchParams.get("code");
  if (!code || searchParams.has("error")) return fail();

  // Supabase can append a PKCE flow id to the redirect URL; pass it through
  // when present so the matching verifier is used.
  const flowId = searchParams.get("sb_flow_id") ?? undefined;

  try {
    const supabase = await createSupabaseServerClient();
    const result = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined
    );
    if (!isSuccessfulOAuthExchange(result)) return fail();
  } catch {
    return fail();
  }

  // `next` was re-validated above; never redirect to a raw query value.
  return NextResponse.redirect(new URL(nextPath, origin));
}
