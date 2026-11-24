import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  PASSWORD_UPDATED_MESSAGE,
  recoveryLinkErrorMessage,
} from "@/lib/auth/login-messages";
import { passwordUpdateErrorMessage } from "@/lib/auth/auth-contracts";

/*
 * Regression tests for the production recovery incident (F8) and the
 * 2026-11-24 repair: PKCE recovery lands on /reset-password, the one-time code
 * is exchanged by this browser, a recovery session is required, and the
 * session is cleared before the guest-only success landing.
 *
 * Pure-function contracts + SOURCE contracts only. Simulated flows; real
 * GoTrue delivery needs owner E2E and is not claimed.
 */

const src = (rel: string) => readFileSync(path.resolve(process.cwd(), rel), "utf8");
const forgotSource = () => src("src/components/auth/forgot-password-form.tsx");
const resetSource = () => src("src/components/auth/reset-password-form.tsx");
const confirmRouteSource = () => src("src/app/auth/confirm/route.ts");
const loginSource = () => src("src/components/auth/login-form.tsx");
const resetPageSource = () => src("src/app/(auth)/reset-password/page.tsx");

describe("forgot-password submission", () => {
  it("no longer points recovery at the token_hash-only callback", () => {
    expect(forgotSource()).not.toMatch(/auth\/confirm\?type=recovery/);
    const codeLines = forgotSource()
      .split("\n")
      .filter(
        (line) =>
          !line.trim().startsWith("*") &&
          !line.trim().startsWith("//") &&
          !line.trim().startsWith("/*")
      )
      .join("\n");
    expect(codeLines).not.toMatch(/\/auth\/confirm/);
  });

  it("uses resetPasswordRedirectUrl with the validated next path", () => {
    expect(forgotSource()).toMatch(/resetPasswordRedirectUrl\(/);
    expect(forgotSource()).toMatch(/resetPasswordForEmail\(/);
    expect(forgotSource()).toMatch(/safeAuthPath\(searchParams\.get\("next"\)\)/);
  });

  it("shows the same neutral success copy whether or not the address exists", () => {
    expect(forgotSource()).toMatch(/If an account exists for/);
    expect(forgotSource()).not.toMatch(/account not found|no account/i);
  });
});

describe("PKCE exchange and recovery-session guard on /reset-password", () => {
  it("reads the one-time ?code= and calls exchangeCodeForSession", () => {
    expect(resetSource()).toMatch(/searchParams\.get\("code"\)/);
    expect(resetSource()).toMatch(/exchangeCodeForSession\(code\)/);
  });

  it("strips one-time params only after the exchange settles, before any navigation", () => {
    const source = resetSource();
    expect(source).toMatch(/removeSensitiveParams\(\)/);
    expect(source).toMatch(/replaceState\(null, "", redirectPath\)/);
    expect(source).not.toMatch(/\.finally\(/);
  });

  it("the exchange runs EXACTLY once (ref-guarded against re-mounts)", () => {
    expect(resetSource()).toMatch(/linkCheckedRef\.current/);
  });

  it("rejects an ordinary signed-in session and verifies token_hash recovery in this browser", () => {
    const source = resetSource();
    expect(source).not.toMatch(/\.getUser\(\)/);
    expect(source).toMatch(/searchParams\.get\("token_hash"\)/);
    expect(source).toMatch(/tokenHash && type === "recovery"/);
    expect(source).toMatch(
      /verifyOtp\(\{ type: "recovery", token_hash: tokenHash \}\)/
    );
    expect(source).toMatch(/No recovery code or recovery token_hash/);
  });

  it("exchange failure or non-recovery result → neutral invalid-link state", () => {
    const source = resetSource();
    expect(source).toMatch(
      /setLinkState\(isVerifiedRecoveryCodeExchange\(result\) \? "ready" : "failed"\)/
    );
    expect(source).toMatch(
      /setLinkState\(isVerifiedRecoveryOtp\("recovery", result\) \? "ready" : "failed"\)/
    );
    expect(source).toMatch(/setLinkState\("failed"\)/);
    expect(source).not.toMatch(/setLinkState\(exchangeError \? "failed" : "ready"\)/);
    expect(source).toMatch(/recoveryLinkErrorMessage\(\)/);
    expect(source).not.toMatch(/linkError\.message|error\.message/);
  });

  it("failed link → dedicated state with a fresh-request path", () => {
    expect(resetSource()).toMatch(/linkState === "failed"/);
    expect(resetSource()).toMatch(/href=\{withAuthNext\("\/forgot-password", nextPath\)\}/);
  });

  it("the page wraps the form in Suspense (Next 16 Cache Components)", () => {
    expect(resetPageSource()).toMatch(/<Suspense/);
  });
});

describe("password update completion and post-reset landing", () => {
  it("updates the password only when a handler-level guard confirms ready", () => {
    const source = resetSource();
    expect(source).toMatch(/supabase\.auth\.updateUser\(\{/);
    expect(source).toMatch(/if \(updateError\)/);
    expect(source).toMatch(/if \(!canUpdatePassword\(linkState\)\)/);
    expect(source).toMatch(
      /disabled=\{busy \|\| !canUpdatePassword\(linkState\)\}/
    );
    expect(source).not.toMatch(/linkState !== "ready"/);
  });

  it("clears the local session before redirecting to guest-only /login?reset=1", () => {
    const source = resetSource();
    expect(source).toMatch(/clearBrowserSession\(supabase\)/);
    expect(source).toMatch(/if \(!cleanup\.ok\)/);
    expect(source).toMatch(
      /router\.replace\(withAuthNext\("\/login\?reset=1", nextPath\)\)/
    );
    expect(source).not.toMatch(/login\?confirmed=1/);
  });

  it("login and dashboard can both surface the password-specific success message", () => {
    expect(loginSource()).toMatch(/searchParams\.get\("reset"\) === "1"/);
    expect(loginSource()).toMatch(/PASSWORD_UPDATED_MESSAGE/);
    expect(src("src/app/(user)/dashboard/page.tsx")).toMatch(
      /PASSWORD_UPDATED_MESSAGE/
    );
    expect(PASSWORD_UPDATED_MESSAGE).toMatch(/password updated/i);
  });
});

describe("password-update errors are honest, not all 'expired link'", () => {
  it("rate limit, policy, expired link and network failures get distinct guidance", () => {
    expect(
      passwordUpdateErrorMessage({ code: "over_request_rate_limit" })
    ).toMatch(/too many/i);
    expect(passwordUpdateErrorMessage({ code: "weak_password" })).toMatch(
      /at least 8 characters/i
    );
    expect(passwordUpdateErrorMessage({ code: "otp_expired" })).toMatch(
      /expired or was already used/i
    );
    expect(passwordUpdateErrorMessage(new TypeError("Failed to fetch"))).toMatch(
      /connection/i
    );
  });

  it("never echoes or logs the underlying error", () => {
    const message = passwordUpdateErrorMessage(new Error("secret-token-should-not-appear"));
    expect(message).not.toMatch(/secret-token/);
  });
});

describe("token_hash callback keeps non-recovery verification server-side", () => {
  it("forwards recovery tokens to the browser but verifies other OTPs server-side", () => {
    const source = confirmRouteSource();
    expect(source).toMatch(/if \(type === "recovery"\)/);
    expect(source).toMatch(
      /recoveryUrl\.searchParams\.set\("token_hash", tokenHash\)/
    );
    expect(source).toMatch(/recoveryUrl\.searchParams\.set\("type", "recovery"\)/);
    expect(source).toMatch(/verifyOtp\(\{ type, token_hash: tokenHash \}\)/);
    expect(source).toMatch(/"\/login\?confirmed=1"/);
    expect(source).toMatch(/"\?error=link"/);
  });
});

describe("neutrality of the recovery failure message", () => {
  it("invalid, expired and already-used links are indistinguishable", () => {
    for (const err of [
      { code: "otp_expired" },
      { code: "invalid_credentials" },
      new Error("network"),
      undefined,
    ]) {
      expect(recoveryLinkErrorMessage(err)).toBe(
        recoveryLinkErrorMessage(undefined)
      );
    }
    const message = recoveryLinkErrorMessage();
    expect(message).toMatch(/invalid or has expired/i);
    expect(message).not.toMatch(
      /not (registered|found|exist)|no account|already used/i
    );
  });
});
