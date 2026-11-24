import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseConfig } from "@/lib/env";

/**
 * Server-side (Server Component / Server Action) Supabase client with
 * cookie-based session propagation, per @supabase/ssr App Router pattern.
 *
 * Key protection (SECURITY.md §2): the publishable key is browser-safe; the
 * service/secret key is NEVER used here. Server has RLS-bounded access just
 * like the browser unless a dedicated admin client (Phase 2, service-role,
 * server-only) is created for the `/api/identify` pipeline.
 */
export async function createSupabaseServerClient() {
  const { url, publishableKey } = getPublicSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component render pass where cookies are
          // read-only; the proxy refreshes cookies on the response. Log only
          // this generic fact — never cookie names, values or tokens.
          console.warn(
            "[auth] server cookie write unavailable; relying on proxy refresh"
          );
        }
      },
    },
  });
}
