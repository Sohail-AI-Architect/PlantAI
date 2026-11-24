/**
 * Browser-session cleanup shared by explicit Sign Out and post-reset landing.
 *
 * Supabase's default `signOut()` scope is global: it attempts server-side
 * refresh-token revocation, but while offline it returns an error and leaves
 * the browser session intact. We try global revocation first, then always fall
 * back to `scope: "local"`, which clears the cookies in this browser even when
 * the auth endpoint cannot be reached.
 */
interface SignOutClient {
  auth: {
    signOut(options?: {
      scope?: "global" | "local" | "others";
    }): Promise<{ error: unknown }>;
  };
}

export interface SessionCleanupResult {
  ok: boolean;
  usedLocalFallback: boolean;
  error: unknown;
}

export async function clearBrowserSession(
  client: SignOutClient
): Promise<SessionCleanupResult> {
  try {
    const { error } = await client.auth.signOut({ scope: "global" });
    if (!error) {
      return { ok: true, usedLocalFallback: false, error: null };
    }
  } catch {
    // Network/offline failure: fall through to the guaranteed local clear.
  }

  try {
    const { error } = await client.auth.signOut({ scope: "local" });
    return {
      ok: !error,
      usedLocalFallback: true,
      error: error ?? null,
    };
  } catch (error) {
    return { ok: false, usedLocalFallback: true, error };
  }
}
