import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  PASSWORD_UPDATED_MESSAGE,
  recoveryLinkErrorMessage,
} from "@/lib/auth/login-messages";
import { passwordUpdateErrorMessage } from "@/lib/auth/auth-contracts";

/*
 * Retained recovery rollback contracts after the Google OAuth cutover.
 *
 * The old password screen is gone from normal use, but /auth/confirm recovery
 * forwarding and the neutral helper contracts remain for outstanding links.
 * Pure-function + SOURCE contracts only; no live GoTrue delivery is claimed.
 */

const src = (rel: string) =>
  readFileSync(path.resolve(process.cwd(), rel), "utf8");
const forgotSource = () => src("src/components/auth/forgot-password-form.tsx");
const resetSource = () => src("src/components/auth/reset-password-form.tsx");
const confirmRouteSource = () => src("src/app/auth/confirm/route.ts");
const resetPageSource = () => src("src/app/(auth)/reset-password/page.tsx");

function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

describe("retired password screens", () => {
  it("forgot-password no longer sends a recovery email", () => {
    const code = codeOnly(forgotSource());
    expect(code).not.toMatch(/auth\/confirm|resetPasswordForEmail/);
    expect(code).toMatch(/router\.replace\(loginPath\)/);
  });

  it("reset-password no longer verifies or writes a new password", () => {
    const code = codeOnly(resetSource());
    expect(code).not.toMatch(
      /exchangeCodeForSession|verifyOtp|updateUser\(|clearBrowserSession/
    );
    expect(code).toMatch(/router\.replace\(loginPath\)/);
  });

  it("both pages remain guest-safe with Suspense and a validated next", () => {
    for (const source of [forgotSource(), resetSource()]) {
      expect(source).toMatch(/safeAuthPath\(searchParams\.get\("next"\)\)/);
      expect(source).toMatch(/aria-live="polite"/);
    }
    expect(resetPageSource()).toMatch(/<Suspense/);
  });

  it("success banner helper is retained for old callback links", () => {
    expect(PASSWORD_UPDATED_MESSAGE).toMatch(/password updated/i);
    expect(src("src/app/(user)/dashboard/page.tsx")).toMatch(
      /PASSWORD_UPDATED_MESSAGE/
    );
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
    const message = passwordUpdateErrorMessage(
      new Error("secret-token-should-not-appear")
    );
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
