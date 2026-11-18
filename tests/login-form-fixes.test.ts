import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  PASSWORD_SIGN_IN_ERROR_MESSAGE,
  RESEND_CONFIRMATION_SENT_MESSAGE,
  isValidEmail,
  isRateLimitError,
  magicLinkErrorMessage,
  passwordSignInErrorMessage,
  resendConfirmationErrorMessage,
} from "@/lib/auth/login-messages";

/*
 * Offline contract tests for the login-form hardening (F1–F5).
 *
 * Two layers, matching the repo's established test patterns:
 * 1. PURE-FUNCTION contracts on src/lib/auth/login-messages.ts (the error
 *    mapping / validation logic) — simulated GoTrue errors, jsdom-free.
 * 2. SOURCE contracts on src/components/auth/login-form.tsx — the wiring
 *    (shouldCreateUser, resend params, param handling) is verified in the
 *    source text, exactly like tests/seo-canonicals.test.ts. These cannot
 *    verify real browser/GoTrue behavior; owner E2E covers that.
 *
 * Privacy invariant under test throughout: no message may reveal whether
 * an account exists (UI_UX_DESIGN.md §6.6). The single rate-limit branch is
 * project-state, not account-state.
 */

const formSource = () =>
  readFileSync(
    path.resolve(process.cwd(), "src/components/auth/login-form.tsx"),
    "utf8"
  );

describe("isValidEmail (F2/F5) — same shape check as signup/forgot-password", () => {
  it("accepts ordinary addresses", () => {
    expect(isValidEmail("owner@example.com")).toBe(true);
    expect(isValidEmail("owner+tag@sub.example.co.uk")).toBe(true);
  });

  it("rejects a USERNAME typed into the email field (Phase 2 probe case)", () => {
    expect(isValidEmail("monstera_fan")).toBe(false);
  });

  it("rejects empty/whitespace and malformed inputs", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("   ")).toBe(false);
    expect(isValidEmail("owner@")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
    expect(isValidEmail("owner@example")).toBe(false);
    expect(isValidEmail("owner example.com")).toBe(false);
  });
});

describe("isRateLimitError — GoTrue 429 email-budget codes", () => {
  it("matches over_email_send_rate_limit (built-in 2/hour cap)", () => {
    expect(isRateLimitError({ code: "over_email_send_rate_limit" })).toBe(true);
  });

  it("matches over_request_rate_limit (endpoint throttle)", () => {
    expect(isRateLimitError({ code: "over_request_rate_limit" })).toBe(true);
  });

  it("does not match other GoTrue codes or non-error shapes", () => {
    expect(isRateLimitError({ code: "otp_disabled" })).toBe(false);
    expect(isRateLimitError({ code: "invalid_credentials" })).toBe(false);
    expect(isRateLimitError(new Error("network down"))).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });
});

describe("magicLinkErrorMessage (F5) — account-existence-neutral mapping", () => {
  it("rate limit → HONEST wait-and-retry guidance mentioning the hourly window", () => {
    const message = magicLinkErrorMessage({
      code: "over_email_send_rate_limit",
    });
    expect(message).toMatch(/too many .*emails/i);
    expect(message).toMatch(/wait/i);
    expect(message).toMatch(/sign-in link/i);
  });

  it("any OTHER GoTrue failure → the SAME generic message (incl. 422 otp_disabled for unknown addresses)", () => {
    for (const err of [
      { code: "otp_disabled" },
      { code: "invalid_credentials" },
      new Error("fetch failed"),
      null,
      undefined,
    ]) {
      expect(magicLinkErrorMessage(err)).toBe(
        "Couldn't send a sign-in link — check the address and try again."
      );
    }
  });

  it("never reveals whether the address has an account", () => {
    for (const err of [
      { code: "over_email_send_rate_limit" },
      { code: "otp_disabled" },
    ]) {
      const message = magicLinkErrorMessage(err);
      expect(message).not.toMatch(/not (registered|found|exist)/i);
      expect(message).not.toMatch(/no account/i);
    }
  });
});

describe("resendConfirmationErrorMessage (F3) — neutral in every branch", () => {
  it("rate limit → honest wait guidance", () => {
    expect(resendConfirmationErrorMessage({ code: "over_email_send_rate_limit" })).toMatch(/wait/i);
  });

  it("any other failure → neutral 'try again later' (never account-existence wording)", () => {
    for (const err of [{ code: "email_not_confirmed" }, new Error("x"), null]) {
      const message = resendConfirmationErrorMessage(err);
      expect(message).toMatch(/try again later/i);
      expect(message).not.toMatch(/not (registered|found)|no account|doesn'?t exist/i);
    }
  });

  it("success line is unconditional AND honest about GoTrue's confirmed-user no-op (F7)", () => {
    // GoTrue /resend silently no-ops (200, no email) for already-confirmed
    // addresses (supabase/auth internal/api/resend.go) — the message must
    // state both realities neutrally instead of promising an email that
    // will never come for confirmed accounts.
    expect(RESEND_CONFIRMATION_SENT_MESSAGE).toMatch(/^Request received/);
    expect(RESEND_CONFIRMATION_SENT_MESSAGE).toMatch(/still needs confirming/i);
    expect(RESEND_CONFIRMATION_SENT_MESSAGE).toMatch(/already confirmed/i);
    expect(RESEND_CONFIRMATION_SENT_MESSAGE).toMatch(/simply sign in/i);
    expect(RESEND_CONFIRMATION_SENT_MESSAGE).not.toMatch(/account (exists|created)/i);
  });
});

describe("passwordSignInErrorMessage (F6) — throttle-aware, otherwise one generic message", () => {
  it("endpoint throttle (429) → HONEST wait-and-retry guidance, no credential advice", () => {
    for (const code of ["over_request_rate_limit", "over_email_send_rate_limit"]) {
      const message = passwordSignInErrorMessage({ code });
      expect(message).toMatch(/too many sign-in attempts/i);
      expect(message).toMatch(/wait/i);
      expect(message).not.toMatch(/check your email and password/i);
    }
  });

  it("every OTHER failure → the SAME generic message (incl. invalid_credentials, email_not_confirmed)", () => {
    for (const err of [
      { code: "invalid_credentials" },
      { code: "email_not_confirmed" },
      new Error("fetch failed"),
      null,
      undefined,
    ]) {
      expect(passwordSignInErrorMessage(err)).toBe(PASSWORD_SIGN_IN_ERROR_MESSAGE);
    }
  });

  it("never reveals whether the address has an account (throttle state ≠ account state)", () => {
    for (const err of [{ code: "over_request_rate_limit" }, { code: "invalid_credentials" }]) {
      const message = passwordSignInErrorMessage(err);
      expect(message).not.toMatch(/not (registered|found|exist)|no account/i);
    }
  });
});

describe("PASSWORD_SIGN_IN_ERROR_MESSAGE — the single generic mapping", () => {
  it("mentions confirmation-first guidance without asserting account state", () => {
    expect(PASSWORD_SIGN_IN_ERROR_MESSAGE).toMatch(/confirm your email first/i);
    expect(PASSWORD_SIGN_IN_ERROR_MESSAGE).not.toMatch(/invalid|wrong|incorrect/i);
  });
});

describe("login-form source contracts (F1–F5 wiring)", () => {
  it("F5: signInWithOtp sets shouldCreateUser: false — no implicit account creation from the login page", () => {
    expect(formSource()).toMatch(/shouldCreateUser:\s*false/);
  });

  it("F5: OTP failures map through magicLinkErrorMessage (429-aware, neutral otherwise)", () => {
    expect(formSource()).toMatch(/magicLinkErrorMessage\(otpError\)/);
  });

  it("F2: BOTH submissions validate the email format before any network call", () => {
    const src = formSource();
    expect(src).toMatch(/isValidEmail\(email\.trim\(\)\)/g);
  });

  it("F3/F9: resend uses type 'signup' with the same-origin /auth/link (PKCE) redirect", () => {
    const src = formSource();
    expect(src).toMatch(/auth\.resend\(\{[\s\S]*?type:\s*"signup"/);
    // F9: `resend` also sends a PKCE code_challenge, so its emailed link
    // must reach the client-side exchange page, not the token_hash-only
    // /auth/confirm route.
    expect(src).toMatch(
      /auth\.resend\(\{[\s\S]*?emailRedirectTo:\s*`\$\{window\.location\.origin\}\/auth\/link`/
    );
  });

  it("F3: resend success shows the existence-neutral message (not a confirmation promise)", () => {
    expect(formSource()).toMatch(/setInfo\(RESEND_CONFIRMATION_SENT_MESSAGE\)/);
  });

  it("F1: ?error=link surfaces the expired-link message instead of landing silently", () => {
    expect(formSource()).toMatch(/searchParams\.get\("error"\) === "link"/);
    expect(formSource()).toMatch(/invalid or has expired/);
  });

  it("F4: a failed password sign-in unlocks the passwordless recovery hint", () => {
    expect(formSource()).toMatch(/setSignInFailed\(true\)/);
    expect(formSource()).toMatch(/sign in without a password/);
  });

  it("password failures map through passwordSignInErrorMessage (F6: throttle-aware)", () => {
    expect(formSource()).toMatch(/setError\(passwordSignInErrorMessage\(signInError\)\)/);
    // The ONLY password-path branching is the throttle branch — no
    // credential-state branching (privacy standard preserved):
    expect(formSource()).not.toMatch(/signInError\.code === |email_not_confirmed/);
  });
});
