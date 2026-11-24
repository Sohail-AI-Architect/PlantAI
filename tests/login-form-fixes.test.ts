import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  PASSWORD_SIGN_IN_ERROR_MESSAGE,
  RESEND_CONFIRMATION_SENT_MESSAGE,
  isValidEmail,
  isNetworkAuthError,
  isRateLimitError,
  magicLinkErrorMessage,
  passwordSignInErrorMessage,
  resendConfirmationErrorMessage,
} from "@/lib/auth/login-messages";

/*
 * Offline contract tests for sign-in hardening (F1–F6 + 2026-11-24 repair).
 *
 * PURE-FUNCTION contracts on src/lib/auth/login-messages.ts pin error/validation
 * behavior with simulated GoTrue errors. SOURCE contracts on the forms pin
 * wiring (redirect helpers, guards, accessible states) the same way the repo's
 * SEO tests do. No jsdom, no browser E2E, no live Supabase calls.
 *
 * Privacy invariant: messages never reveal whether an account exists. Rate
 * limits and network failures are project/transport state, not account state.
 */

const formSource = () =>
  readFileSync(
    path.resolve(process.cwd(), "src/components/auth/login-form.tsx"),
    "utf8"
  );

describe("isValidEmail — sign-in validation", () => {
  it("accepts ordinary addresses", () => {
    expect(isValidEmail("owner@example.com")).toBe(true);
    expect(isValidEmail("owner+tag@sub.example.co.uk")).toBe(true);
  });

  it("rejects a username typed into the email field", () => {
    expect(isValidEmail("monstera_fan")).toBe(false);
  });

  it("rejects empty/whitespace and malformed inputs", () => {
    for (const value of [
      "",
      "   ",
      "owner@",
      "@example.com",
      "owner@example",
      "owner example.com",
    ]) {
      expect(isValidEmail(value)).toBe(false);
    }
  });
});

describe("isRateLimitError — GoTrue 429 email-budget codes", () => {
  it("matches both built-in and endpoint throttle codes", () => {
    expect(isRateLimitError({ code: "over_email_send_rate_limit" })).toBe(true);
    expect(isRateLimitError({ code: "over_request_rate_limit" })).toBe(true);
  });

  it("does not match other code shapes", () => {
    for (const value of [
      { code: "otp_disabled" },
      { code: "invalid_credentials" },
      new Error("network down"),
      null,
      undefined,
    ]) {
      expect(isRateLimitError(value)).toBe(false);
    }
  });
});

describe("isNetworkAuthError — transport failures are not credentials", () => {
  it("recognizes Supabase retryable fetch and common browser network errors", () => {
    expect(isNetworkAuthError({ name: "AuthRetryableFetchError" })).toBe(true);
    expect(isNetworkAuthError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkAuthError({ name: "AbortError" })).toBe(true);
    expect(isNetworkAuthError(new Error("Network request timed out"))).toBe(true);
  });

  it("does not classify ordinary GoTrue auth codes as network failures", () => {
    for (const value of [
      { code: "invalid_credentials" },
      { code: "email_not_confirmed" },
      null,
      undefined,
    ]) {
      expect(isNetworkAuthError(value)).toBe(false);
    }
  });
});

describe("magicLinkErrorMessage — neutral, 429-aware, network-aware", () => {
  it("rate limit → honest hourly wait guidance", () => {
    const message = magicLinkErrorMessage({
      code: "over_email_send_rate_limit",
    });
    expect(message).toMatch(/too many .*emails/i);
    expect(message).toMatch(/wait/i);
    expect(message).toMatch(/sign-in link/i);
  });

  it("network failure → connection guidance, never credential advice", () => {
    expect(magicLinkErrorMessage(new TypeError("Failed to fetch"))).toMatch(
      /connection/i
    );
  });

  it("all other failures → the SAME generic message (unknown address included)", () => {
    for (const err of [
      { code: "otp_disabled" },
      { code: "invalid_credentials" },
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

describe("resendConfirmationErrorMessage — neutral in every branch", () => {
  it("rate limit → honest wait guidance", () => {
    expect(
      resendConfirmationErrorMessage({ code: "over_email_send_rate_limit" })
    ).toMatch(/wait/i);
  });

  it("network failure → connection guidance", () => {
    expect(
      resendConfirmationErrorMessage({ name: "AuthRetryableFetchError" })
    ).toMatch(/connection/i);
  });

  it("other failures → neutral try-again (never account-existence wording)", () => {
    for (const err of [{ code: "email_not_confirmed" }, null]) {
      const message = resendConfirmationErrorMessage(err);
      expect(message).toMatch(/try again later/i);
      expect(message).not.toMatch(
        /not (registered|found)|no account|doesn'?t exist/i
      );
    }
  });

  it("success line is unconditional and honest about GoTrue's confirmed-user no-op", () => {
    expect(RESEND_CONFIRMATION_SENT_MESSAGE).toMatch(/^Request received/);
    expect(RESEND_CONFIRMATION_SENT_MESSAGE).toMatch(/still needs confirming/i);
    expect(RESEND_CONFIRMATION_SENT_MESSAGE).toMatch(/already confirmed/i);
    expect(RESEND_CONFIRMATION_SENT_MESSAGE).toMatch(/simply sign in/i);
    expect(RESEND_CONFIRMATION_SENT_MESSAGE).not.toMatch(
      /account (exists|created)/i
    );
  });
});

describe("passwordSignInErrorMessage — throttle/network aware, otherwise one message", () => {
  it("endpoint throttle (429) → wait guidance with no credential advice", () => {
    for (const code of ["over_request_rate_limit", "over_email_send_rate_limit"]) {
      const message = passwordSignInErrorMessage({ code });
      expect(message).toMatch(/too many sign-in attempts/i);
      expect(message).toMatch(/wait/i);
      expect(message).not.toMatch(/check your email and password/i);
    }
  });

  it("network failure → connection guidance", () => {
    expect(passwordSignInErrorMessage(new TypeError("Failed to fetch"))).toMatch(
      /connection/i
    );
  });

  it("invalid credentials and unconfirmed email → the SAME neutral message", () => {
    for (const err of [
      { code: "invalid_credentials" },
      { code: "email_not_confirmed" },
      null,
      undefined,
    ]) {
      expect(passwordSignInErrorMessage(err)).toBe(
        PASSWORD_SIGN_IN_ERROR_MESSAGE
      );
    }
  });

  it("never reveals whether the address has an account", () => {
    for (const err of [
      { code: "over_request_rate_limit" },
      { code: "invalid_credentials" },
    ]) {
      const message = passwordSignInErrorMessage(err);
      expect(message).not.toMatch(/not (registered|found|exist)|no account/i);
    }
  });
});

describe("PASSWORD_SIGN_IN_ERROR_MESSAGE — the single credential mapping", () => {
  it("mentions confirmation-first without asserting account state", () => {
    expect(PASSWORD_SIGN_IN_ERROR_MESSAGE).toMatch(/confirm your email first/i);
    expect(PASSWORD_SIGN_IN_ERROR_MESSAGE).not.toMatch(
      /invalid|wrong|incorrect/i
    );
  });
});

describe("login-form source contracts — sign-in success and safety wiring", () => {
  it("uses password sign-in and navigates to the validated next path", () => {
    const src = formSource();
    expect(src).toMatch(/signInWithPassword\(\s*buildPasswordSignInPayload\(/);
    expect(src).toMatch(/router\.replace\(nextPath\)/);
    expect(src).toMatch(/router\.refresh\(\)/);
    expect(src).toMatch(/safeAuthPath\(searchParams\.get\("next"\)\)/);
  });

  it("validates BOTH submissions before any network call", () => {
    const src = formSource();
    expect(src).toMatch(/isValidEmail\(normalizedEmail\)/g);
    expect(src).toMatch(/password\.length < 8/);
  });

  it("normalizes email with the shared helper and sends the password unchanged", () => {
    const src = formSource();
    expect(src).toMatch(/normalizeAuthEmail\(email\)/g);
    expect(src).toMatch(/email: normalizedEmail/g);
    expect(src).not.toMatch(/email:\s*username/);
    expect(src).not.toMatch(/password\.(?:trim|toLowerCase|toUpperCase)\(/);
  });

  it("marks email as the browser login username, not the display name", () => {
    const src = formSource();
    expect(src).toMatch(/autoComplete="username"/);
    expect(src).not.toMatch(/autoComplete="email"/);
    expect(src).not.toMatch(/name="username"/);
  });

  it("guards duplicate submissions at handler level with an action-specific busy state", () => {
    const src = formSource();
    expect(src).toMatch(/if \(!begin\("(password|magic|resend)"\)\) return;/);
    expect(src).toMatch(/pendingRef\.current/);
    expect(src).toMatch(/type PendingAction =/);
    expect(src).not.toMatch(/const \[busy, setBusy\]/);
  });

  it("F5: signInWithOtp sets shouldCreateUser: false", () => {
    expect(formSource()).toMatch(/shouldCreateUser:\s*false/);
  });

  it("all emailed links carry `next` through the shared redirect helpers", () => {
    const src = formSource();
    expect(src).toMatch(/authLinkRedirectUrl\(/g);
    expect(src).toMatch(/withAuthNext\(/g);
  });

  it("resend stays existence-neutral and maps failures through the 429-aware helper", () => {
    const src = formSource();
    expect(src).toMatch(/auth\.resend\(\{[\s\S]*?type:\s*"signup"/);
    expect(src).toMatch(/resendConfirmationErrorMessage\(resendError\)/);
    expect(src).toMatch(/setInfo\(RESEND_CONFIRMATION_SENT_MESSAGE\)/);
  });

  it("F1: ?error=link surfaces the expired-link message", () => {
    const src = formSource();
    expect(src).toMatch(/searchParams\.get\("error"\) === "link"/);
    expect(src).toMatch(/invalid or has expired/);
  });

  it("F4: a failed password sign-in unlocks the passwordless recovery hint", () => {
    const src = formSource();
    expect(src).toMatch(/setSignInFailed\(true\)/);
    expect(src).toMatch(/sign in without a password/);
  });

  it("password failures map through the throttle/network-aware helper only", () => {
    const src = formSource();
    expect(src).toMatch(/setError\(passwordSignInErrorMessage\(signInError\)\)/);
    expect(src).not.toMatch(/signInError\.code === |email_not_confirmed/);
  });

  it("exposes accessible loading states and keeps Forgot password / Create account links", () => {
    const src = formSource();
    expect(src).toMatch(/aria-busy=\{busy\}/);
    expect(src).toMatch(/aria-busy=\{pendingAction === "password"\}/);
    expect(src).toMatch(/Forgot password\?/);
    expect(src).toMatch(/Create account/);
  });

  it("has no temporary Demo Account / anonymous sign-in path", () => {
    const code = formSource()
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    expect(code).not.toMatch(/signInAnonymously|Try Demo Account|Demo Account/);
  });
});
