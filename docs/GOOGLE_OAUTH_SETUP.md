# Direct Supabase Google OAuth — owner setup

Status: **code implemented locally; provider configuration and real sign-in E2E are owner-only and not yet verified.**

PlantAI now uses Supabase Auth's direct Google provider with PKCE and Next.js App Router SSR cookies. `/login` and `/signup` share one **Continue with Google** action. There is no Firebase dependency, no custom JWT/identity bridge, and no client-supplied user id, email, role or profile data.

Reference: <https://supabase.com/docs/guides/auth/social-sign-in/auth-google>

## What the code does

1. The browser calls `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })`.
2. `redirectTo` is the current site's `/auth/callback` URL plus a `safeAuthPath()`-validated `next`.
3. Supabase Auth performs the Google redirect and creates or links the user under its own canonical UUID.
4. `/auth/callback` exchanges `?code=` with the **server** Supabase client (`exchangeCodeForSession`) using `@supabase/ssr` cookies.
5. `src/proxy.ts`, `getClaims()`, `requireAuthRedirect()`, RLS, Storage policies, and all UUID foreign keys continue to use the same `auth.users.id`.

`/auth/confirm` and `/auth/link` are retained unchanged for outstanding email links and rollback. The retired forgot/reset screens now redirect to Google sign-in, so completing an outstanding **recovery** link additionally requires restoring the previous reset-password form from version control during rollback. No user, UUID, identity or data change is needed for that restoration.

## Owner-only Google Cloud Console steps

Do these in the owner's own console. Never paste client IDs/secrets into chat, docs, `.env.local`, git, or screenshots.

1. Select or create a Google Cloud project.
2. Configure the **OAuth consent screen** for the application.
3. Create an OAuth client ID of type **Web application**.
4. Add Supabase's callback URL to **Authorized redirect URIs**. Use the exact callback URL shown by Supabase (normally `https://<project-ref>.supabase.co/auth/v1/callback`). Do not use a PlantAI route as the Google redirect URI.
5. Copy the generated client ID and client secret directly into the Supabase provider form in the next section. PlantAI application code needs neither value.

## Owner-only Supabase Dashboard steps

1. Open **Authentication → Providers → Google**, enable it, and enter the Google client ID and secret from the previous section. Save.
2. Open **Authentication → URL Configuration** and allow the exact origins that can start the flow:
   - local: `http://127.0.0.1:3000/**` and `http://localhost:3000/**`
   - production: `https://strong-mochi-e3869f.netlify.app/**`
   - any Netlify preview host the owner intends to use
   - the Supabase project's own callback URL is handled by the provider form, not by this allowlist
3. Set the site URL to the canonical production origin. The code builds `redirectTo` from the browser's current origin, so that origin must be allowlisted.
4. Keep **Email** provider enabled for rollback. Do not delete users, identities, passwords, profiles, RLS policies, Storage policies, or data.
5. Keep signups enabled. Supabase owns account creation/linking; no custom merge, unverified-email linking, username overwrite, or destructive repair is performed by PlantAI.
6. Confirm the Google account's email is verified at Google. Supabase's automatic identity linking uses verified provider email state; if the pre-existing PlantAI account's email is unconfirmed or the provider email cannot be linked, Supabase will report the failure and the callback fails closed.

## Owner verification (not yet performed by the agent)

After configuration, the owner should manually confirm:

1. `/login` and `/signup` each show one accessible **Continue with Google** button with loading and error states.
2. A never-before-seen verified Google email creates a new PlantAI UUID and lands on `?next=` (default `/dashboard`).
3. The same Google account signs back in to the same UUID.
4. The existing account with the same verified email resolves to its original UUID through Supabase automatic identity linking; different Google emails remain separate accounts.
5. Sign-out clears SSR cookies, and protected routes redirect back to `/login?next=…`.
6. No email, password, magic-link, resend-confirmation, forgot-password or reset-password form appears in normal use.
7. Existing plants, saved plants, reminders, roles and Storage access remain attached to the original UUIDs.

Do not treat offline tests as proof of any real Google/Supabase sign-in.

## Known pre-existing schema limitation

Google OAuth metadata contains no `username`. The existing `handle_new_user()` trigger falls back to `email local-part + "_" + first 6 UUID characters`, and `profiles.username` allows at most 24 characters. A Google email whose local part exceeds 17 characters can therefore fail profile creation.

No migration was created or applied for this cutover. The owner must decide separately whether to relax/truncate that fallback; this implementation does not overwrite usernames or profiles and does not trust Google display-name fields.

## Rollback

- Keep the Email provider enabled; it was not disabled by this work.
- The legacy email callback routes and helpers remain in the codebase. `/auth/confirm` still verifies/forwards tokens and `/auth/link` still exchanges confirmation codes; recovery completion requires restoring the retired reset-password form.
- Reverting the client/callback code (and the reset form, if recovery links must be completed) restores the previous normal-use UI without changing users, UUIDs, data, RLS or Storage.
