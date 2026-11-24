/**
 * Sign-in error/message contracts (auth hardening F1–F5).
 *
 * Pure, framework-free module so the contracts are unit-testable offline
 * (tests/login-form-fixes.test.ts) without mounting Next.js client
 * components — same pattern as the camera error taxonomy
 * (src/components/identify/camera/plant-camera.tsx).
 *
 * PRIVACY STANDARD (UI_UX_DESIGN.md §6.6, preserved verbatim): messages
 * must never reveal whether an account exists. GoTrue's
 * `invalid_credentials` covers wrong password / unknown email / a username
 * typed into the email field — the app deliberately cannot distinguish
 * them. The rate-limit branch below is the ONE exception, and it is safe:
 * 429 `over_email_send_rate_limit` reflects the PROJECT's hourly email
 * budget (Supabase built-in sender = 2 emails/hour), not the existence of
 * any particular account.
 */

/** Email shape check — the SAME regex as signup-form and forgot-password-form. */
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export function isValidEmail(raw: string): boolean {
  return EMAIL_PATTERN.test(raw);
}

/**
 * Password sign-in: ALL failures map to this one generic message, by design.
 * Kept as a single exported constant so tests can pin the exact wording.
 */
export const PASSWORD_SIGN_IN_ERROR_MESSAGE =
  "Couldn't sign in. Check your email and password — if you just signed up, confirm your email first (the link may be in your inbox).";

/**
 * GoTrue error codes that mean "the project's hourly email budget is spent".
 * `over_email_send_rate_limit` = built-in email cap (429);
 * `over_request_rate_limit` = general endpoint throttle (429).
 * AuthApiError exposes these on `.code` (@supabase/auth-js errors.d.ts).
 */
const RATE_LIMIT_CODES: ReadonlySet<string> = new Set([
  "over_email_send_rate_limit",
  "over_request_rate_limit",
]);

export function isRateLimitError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && RATE_LIMIT_CODES.has(code);
}

/**
 * A failed fetch / timeout is not a credential failure. Supabase's retryable
 * fetch error has a stable `name`; plain network errors from a browser or
 * test double are matched by name/message only. The message never includes
 * the original error text (which could contain tokens or URLs).
 */
export function isNetworkAuthError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === "object") {
    const name = (error as { name?: unknown }).name;
    if (
      name === "AuthRetryableFetchError" ||
      name === "TypeError" ||
      name === "AbortError"
    ) {
      return true;
    }
    const status = (error as { status?: unknown }).status;
    if (status === 0 || status === 408 || status === 429) {
      // 429 is classified as a rate limit first by the callers; treat it as
      // network-retryable here only as a last resort.
      return true;
    }
  }
  if (error instanceof Error) {
    return /fetch|network|timeout|timed out|offline|ECONNRESET|ENOTFOUND/i.test(
      error.message
    );
  }
  return false;
}

/**
 * Password sign-in error mapping (F6). ALL non-rate-limit failures map to
 * the one generic message, by design (privacy standard). The ONE exception
 * is the endpoint throttle (429 `over_request_rate_limit` after repeated
 * attempts): throttle state is project/IP state, not account state, so an
 * honest "wait and retry" message leaks nothing and stops telling a
 * throttled user to double-check credentials they cannot change by
 * retyping. Kept as a function so the two branches are unit-testable.
 */
export function passwordSignInErrorMessage(error: unknown): string {
  if (isRateLimitError(error)) {
    return "Couldn't sign in — too many sign-in attempts have been made recently. Please wait a little and try again.";
  }
  if (isNetworkAuthError(error)) {
    return "Couldn't sign in right now — check your connection and try again.";
  }
  return PASSWORD_SIGN_IN_ERROR_MESSAGE;
}

/**
 * Magic-link (signInWithOtp) failure mapping. Never distinguishes
 * known/unknown addresses (an unknown address yields GoTrue's 422
 * `otp_disabled` when `shouldCreateUser: false` — mapped to the SAME
 * generic message as every other non-rate-limit failure).
 */
export function magicLinkErrorMessage(error: unknown): string {
  if (isRateLimitError(error)) {
    return "Couldn't send a sign-in link — too many sign-in emails have been requested this hour. Please wait a little and try again.";
  }
  if (isNetworkAuthError(error)) {
    return "Couldn't send a sign-in link right now — check your connection and try again.";
  }
  return "Couldn't send a sign-in link — check the address and try again.";
}

/**
 * Resend-confirmation failure mapping. Both branches are existence-neutral:
 * the success path shows the same line regardless of whether the address
 * has an account (identical to the forgot-password pattern).
 */
export function resendConfirmationErrorMessage(error: unknown): string {
  if (isRateLimitError(error)) {
    return "Couldn't send a confirmation email — too many emails have been requested this hour. Please wait a little and try again.";
  }
  if (isNetworkAuthError(error)) {
    return "Couldn't send a confirmation email right now — check your connection and try again.";
  }
  return "Couldn't send a confirmation email right now — please try again later.";
}

/**
 * Success line for a resend attempt — shown regardless of account state,
 * and HONEST about GoTrue's designed behavior (proven from
 * supabase/auth internal/api/resend.go): /resend silently no-ops (200, no
 * email) for already-confirmed AND nonexistent addresses, so "no email
 * arrived" does NOT mean the request failed. One neutral line covers both
 * realities without asserting which one applies.
 */
export const RESEND_CONFIRMATION_SENT_MESSAGE =
  "Request received — if that address still needs confirming, a new confirmation email is on its way. If it's already confirmed, you can simply sign in below.";

/**
 * Post-reset sign-in landing message (/login?reset=1). Only shown after a
 * SUCCESSFUL password update (F8: replaces the previous off-label reuse of
 * ?confirmed=1, which told a password-reset user "Email confirmed").
 */
export const PASSWORD_UPDATED_MESSAGE =
  "Password updated — sign in with your new password.";

/**
 * Recovery-link exchange failure mapping (F8). GoTrue's one-time links
 * fail with the same error shape whether the token is invalid, expired,
 * or ALREADY USED (e.g. consumed by an email scanner's prefetch or a
 * double click) — the app keeps them indistinguishable (same neutrality
 * rule as every auth error) and points the user to request a fresh link.
 */
export function recoveryLinkErrorMessage(_error?: unknown): string {
  void _error;
  return "That password reset link is invalid or has expired — request a fresh one from the forgot-password page.";
}

/**
 * Magic-link / sign-up-confirmation / resend-confirmation exchange failure
 * mapping (F9). Identical neutrality contract to the recovery message: an
 * invalid, expired, or already-consumed one-time code produces ONE message,
 * with a path back to the sign-in page (which offers both a fresh magic
 * link and a fresh confirmation resend). Never reveals account state.
 */
export function authLinkErrorMessage(_error?: unknown): string {
  void _error;
  return "That sign-in or confirmation link is invalid or has expired — request a new one from the sign-in page.";
}
