import {
  DEFAULT_AUTH_DESTINATION,
  safeAuthPath,
  withAuthNext,
} from "@/lib/auth/auth-contracts";

/**
 * Framework-free contracts for the single Supabase Google OAuth flow.
 *
 * Supabase Auth owns account creation, automatic identity linking and the
 * PKCE session. These helpers only build the same-origin callback URL, keep
 * `?next=` inside the app, and interpret the SDK result without trusting any
 * client-supplied identity data. No provider secrets and no email addresses
 * are ever passed from the browser.
 */
export const GOOGLE_OAUTH_PROVIDER = "google" as const;
export const GOOGLE_OAUTH_CALLBACK_PATH = "/auth/callback" as const;
export const GOOGLE_OAUTH_ERROR_MESSAGE =
  "We couldn't continue with Google. Please try again.";
export const GOOGLE_OAUTH_CALLBACK_ERROR_MESSAGE =
  "Google sign-in couldn't be completed. Please try again.";

export interface GoogleOAuthRequest {
  provider: typeof GOOGLE_OAUTH_PROVIDER;
  options: { redirectTo: string };
}

/** Origin-absolute PKCE callback URL, with a validated `next` destination. */
export function googleOAuthRedirectUrl(
  origin: string,
  next: string | null | undefined
): string {
  return `${origin}${withAuthNext(GOOGLE_OAUTH_CALLBACK_PATH, next)}`;
}

/** Exact `signInWithOAuth` request shared by /login and /signup. */
export function buildGoogleOAuthRequest(
  origin: string,
  next: string | null | undefined
): GoogleOAuthRequest {
  return {
    provider: GOOGLE_OAUTH_PROVIDER,
    options: { redirectTo: googleOAuthRedirectUrl(origin, next) },
  };
}

/** Failure text never echoes provider error details or account state. */
export function googleOAuthErrorMessage(_error?: unknown): string {
  void _error;
  return GOOGLE_OAUTH_ERROR_MESSAGE;
}

interface OAuthExchangeResultLike {
  error?: unknown;
  data?: {
    session?: unknown;
    user?: { id?: unknown } | null;
  } | null;
}

/**
 * Supabase returns a verified session and user after a successful PKCE
 * exchange. First-time Google users and returning Google users are both
 * represented this way; account creation/linking is Auth's job, not ours.
 */
export function isSuccessfulOAuthExchange(result: unknown): boolean {
  const value = result as OAuthExchangeResultLike | null | undefined;
  if (!value || value.error || !value.data?.session) return false;
  return typeof value.data.user?.id === "string" && value.data.user.id.length > 0;
}

/** Re-validate `next` at the callback so a URL edit cannot create an open redirect. */
export function oauthDestination(next: string | null | undefined): string {
  return safeAuthPath(next, DEFAULT_AUTH_DESTINATION);
}

/** Generic failure landing, still carrying the safe `next` value. */
export function oauthFailurePath(next: string | null | undefined): string {
  return withAuthNext("/login?error=oauth", oauthDestination(next));
}
