import {
  isNetworkAuthError,
  isRateLimitError,
} from "@/lib/auth/login-messages";

/**
 * Shared, framework-free auth contracts.
 *
 * These functions are deliberately pure so the offline Vitest suite can pin
 * validation, redirect safety and privacy-safe error wording without mounting
 * React components or contacting Supabase.
 */

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,24}$/;
export const MIN_PASSWORD_LENGTH = 8;
export const DEFAULT_AUTH_DESTINATION = "/dashboard";

export interface SignupFieldErrors {
  username?: string;
  email?: string;
  password?: string;
  confirm?: string;
}

export interface SignupFields {
  username: string;
  email: string;
  password: string;
  confirm: string;
}

export function isValidUsername(raw: string): boolean {
  return USERNAME_PATTERN.test(raw);
}

export function validateSignupFields(fields: SignupFields): SignupFieldErrors {
  const errors: SignupFieldErrors = {};

  if (!isValidUsername(fields.username.trim())) {
    errors.username = "3–24 characters; letters, numbers and underscores only.";
  }
  if (!/^\S+@\S+\.\S+$/.test(fields.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (fields.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (fields.password !== fields.confirm) {
    errors.confirm = "Passwords don't match.";
  }

  return errors;
}

/**
 * Same-origin relative-path guard for `?next=` values.
 *
 * A plain startsWith("/") check accepts `//evil.example`; browsers also
 * normalize `/\evil.example` into a protocol-relative URL. Decode and reject
 * both forms (plus control characters) before parsing, then re-parse to keep
 * only a local path/query/hash.
 */
export function safeAuthPath(
  raw: string | null | undefined,
  fallback: string = DEFAULT_AUTH_DESTINATION
): string {
  if (!raw) return fallback;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return fallback;
  }

  if (
    !decoded.startsWith("/") ||
    decoded.startsWith("//") ||
    decoded.includes("\\") ||
    /[\u0000-\u001F\u007F]/.test(decoded)
  ) {
    return fallback;
  }

  try {
    const url = new URL(decoded, "https://plantai.local");
    if (url.origin !== "https://plantai.local") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/** Append the validated `next` destination to a local auth path. */
export function withAuthNext(
  path: string,
  next: string | null | undefined
): string {
  const [pathname, queryAndHash = ""] = path.split("?");
  const hashIndex = queryAndHash.indexOf("#");
  const query = hashIndex === -1 ? queryAndHash : queryAndHash.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : queryAndHash.slice(hashIndex);

  const url = new URL(pathname, "https://plantai.local");
  for (const [key, value] of new URLSearchParams(query)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("next", safeAuthPath(next));

  return `${url.pathname}${url.search}${hash}`;
}

/** Origin-absolute PKCE landing URL (magic link, signup confirmation, resend). */
export function authLinkRedirectUrl(
  origin: string,
  next: string | null | undefined
): string {
  return `${origin}${withAuthNext("/auth/link", next)}`;
}

/** Origin-absolute password-reset landing URL. */
export function resetPasswordRedirectUrl(
  origin: string,
  next: string | null | undefined
): string {
  return `${origin}${withAuthNext("/reset-password", next)}`;
}

export const SIGNUP_CONFLICT_MESSAGE =
  "We couldn't create your account. Those details may already be in use — try a different username or sign in instead.";
export const SIGNUP_GENERIC_MESSAGE =
  "We couldn't create your account right now. Check your details and try again.";
export const PASSWORD_POLICY_MESSAGE =
  "We couldn't create your account — use a password of at least 8 characters.";

const SIGNUP_CONFLICT_CODES = new Set([
  "email_exists",
  "user_already_exists",
  "duplicate_key",
  "23505",
]);
export const PASSWORD_POLICY_CODES = new Set([
  "weak_password",
  "password_too_short",
  "password_too_weak",
]);
const EXPIRED_LINK_CODES = new Set([
  "otp_expired",
  "access_denied",
  "invalid_token",
  "code_expired",
]);

function errorCode(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : null;
}

/**
 * Signup failures stay privacy-neutral: duplicate email and duplicate
 * username produce the SAME message, and no other failure claims an account
 * was created. Rate limits and password policy get honest, non-revealing
 * guidance instead of the duplicate message.
 */
export function signUpErrorMessage(error: unknown): string {
  if (isRateLimitError(error)) {
    return "Too many account requests right now. Please wait a little and try again.";
  }
  if (isNetworkAuthError(error)) {
    return "We couldn't create your account right now — check your connection and try again.";
  }
  const code = errorCode(error);
  if (code && SIGNUP_CONFLICT_CODES.has(code)) return SIGNUP_CONFLICT_MESSAGE;
  if (code && PASSWORD_POLICY_CODES.has(code)) return PASSWORD_POLICY_MESSAGE;
  return SIGNUP_GENERIC_MESSAGE;
}

export function forgotPasswordErrorMessage(error: unknown): string {
  if (isRateLimitError(error)) {
    return "Too many reset emails have been requested. Please wait a little and try again.";
  }
  if (isNetworkAuthError(error)) {
    return "We couldn't send the reset email right now. Check your connection and try again.";
  }
  return "We couldn't send the reset email right now. Check the address and try again.";
}

/**
 * Password-update failures are no longer all called "expired link": rate
 * limits, password-policy rejections and expired links get honest guidance,
 * while genuine network failures get a connection-specific message. Nothing
 * here logs or echoes the underlying error.
 */
export function passwordUpdateErrorMessage(error?: unknown): string {
  if (isRateLimitError(error)) {
    return "Too many password-update attempts have been made. Please wait a little and try again.";
  }
  if (isNetworkAuthError(error)) {
    return "We couldn't update your password right now. Check your connection and try again.";
  }
  const code = errorCode(error);
  if (code && PASSWORD_POLICY_CODES.has(code)) {
    return `We couldn't update your password — use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (code && EXPIRED_LINK_CODES.has(code)) {
    return "That reset link has expired or was already used. Request a fresh one and try again.";
  }
  return "We couldn't update your password right now. Check your connection or request a fresh reset link and try again.";
}

export const SIGN_OUT_ERROR_MESSAGE =
  "We couldn't sign you out. Please try again.";

export type ResetLinkState = "verifying" | "ready" | "failed";

/**
 * Handler-level gate for the password-update form.
 *
 * The disabled submit button is only a UI hint; every async handler must
 * re-check authorization before doing work.
 */
export function canUpdatePassword(
  linkState: string | null | undefined
): boolean {
  return linkState === "ready";
}

interface RecoveryResultLike {
  error?: unknown;
  data?: { session?: unknown; redirectType?: unknown } | null;
}

/**
 * Supabase's installed auth-js marks PKCE recovery exchanges with
 * `redirectType: "recovery"` in the `exchangeCodeForSession()` result. The
 * value comes from the verifier stored by `resetPasswordForEmail()`; it is not
 * inferred from a URL flag or an assumed AMR claim.
 */
export function isVerifiedRecoveryCodeExchange(result: unknown): boolean {
  const value = result as RecoveryResultLike | null | undefined;
  if (!value || value.error || !value.data?.session) return false;
  return value.data.redirectType === "recovery";
}

/**
 * A token_hash verification only counts as recovery when the caller asked
 * `verifyOtp` for `type: "recovery"` and Supabase returned a session without
 * error. A normal session or a failed/expired token never satisfies this.
 */
export function isVerifiedRecoveryOtp(
  type: string | null | undefined,
  result: unknown
): boolean {
  const value = result as RecoveryResultLike | null | undefined;
  return type === "recovery" && !!value && !value.error && !!value.data?.session;
}
