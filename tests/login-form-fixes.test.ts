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
 * Offline contract tests for retained sign-in helpers and the Google-only
 * login UI. Pure helper behavior is preserved for rollback; source contracts
 * now verify that no password/magic-link control is rendered. No jsdom, no
 * browser E2E, no live Supabase calls.
 */

const formSource = () =>
  readFileSync(
    path.resolve(process.cwd(), "src/components/auth/login-form.tsx"),
    "utf8"
  );
const buttonSource = () =>
  readFileSync(
    path.resolve(process.cwd(), "src/components/auth/google-sign-in-button.tsx"),
    "utf8"
  );
const codeOnly = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

describe("isValidEmail — retained validation helper", () => {
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

describe("magicLinkErrorMessage — retained neutral, 429-aware mapper", () => {
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

  it("all other failures → the SAME generic message", () => {
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

describe("resendConfirmationErrorMessage — retained neutral mapper", () => {
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

  it("legacy success line remains honest about GoTrue's confirmed-user no-op", () => {
    expect(RESEND_CONFIRMATION_SENT_MESSAGE).toMatch(/^Request received/);
    expect(RESEND_CONFIRMATION_SENT_MESSAGE).toMatch(/still needs confirming/i);
    expect(RESEND_CONFIRMATION_SENT_MESSAGE).toMatch(/already confirmed/i);
  });
});

describe("passwordSignInErrorMessage — retained neutral mapper", () => {
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
      expect(passwordSignInErrorMessage(err)).not.toMatch(
        /not (registered|found|exist)|no account/i
      );
    }
  });
});

describe("Google-only login source contracts", () => {
  it("renders exactly one sign-in action and no credential form", () => {
    const source = codeOnly(formSource());
    expect(source.match(/<GoogleSignInButton \/>/g) ?? []).toHaveLength(1);
    expect(source).not.toMatch(/signInWithPassword|signInWithOtp|auth\.resend/);
    expect(source).not.toMatch(/type="(email|password)"|onSubmit|FormEvent/);
  });

  it("preserves validated next into the shared OAuth flow", () => {
    const source = codeOnly(formSource());
    expect(source).toMatch(/safeAuthPath\(searchParams\.get\("next"\)\)/);
    expect(source).toMatch(/withAuthNext\(/);
    expect(source).toMatch(/searchParams\.get\("notice"\)/);
  });

  it("uses accessible loading, error and duplicate-click states", () => {
    const source = codeOnly(buttonSource());
    expect(source).toMatch(/if \(!begin\(\)\) return;/);
    expect(source).toMatch(/disabled=\{busy\}/);
    expect(source).toMatch(/aria-busy=\{busy\}/);
    expect(source).toMatch(/role="alert"/);
    expect(source).toMatch(/aria-live="polite"/);
    expect(source).toMatch(/Continuing with Google…/);
  });

  it("does not surface raw provider errors", () => {
    const source = codeOnly(buttonSource());
    expect(source).toMatch(/googleOAuthErrorMessage\(/);
    expect(source).not.toMatch(/error\.message|String\(oauthError\)/);
  });

  it("has no temporary Demo Account / anonymous sign-in path", () => {
    const code = codeOnly(formSource() + buttonSource());
    expect(code).not.toMatch(/signInAnonymously|Try Demo Account|Demo Account/);
  });
});
