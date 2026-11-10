import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "@/lib/env";

/**
 * Browser Supabase client (SECURITY.md §4): uses only the publishable key;
 * all access is bounded by RLS policies (DATABASE_SCHEMA.md). Created lazily
 * so the build never requires env vars — Phase 2 is the first real consumer.
 *
 * @supabase/ssr handles cookie-based session storage for App Router.
 */
export function createSupabaseBrowserClient() {
  const { url, publishableKey } = getPublicSupabaseConfig();
  return createBrowserClient(url, publishableKey);
}
