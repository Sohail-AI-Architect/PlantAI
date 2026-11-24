import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  authLinkErrorMessage,
  recoveryLinkErrorMessage,
} from "@/lib/auth/login-messages";
import {
  authLinkRedirectUrl,
  resetPasswordRedirectUrl,
  safeAuthPath,
  withAuthNext,
} from "@/lib/auth/auth-contracts";

/*
 * Legacy callback rollback coverage plus the Google cutover boundary.
 *
 * /auth/link and /auth/confirm remain intact for outstanding emails and
 * rollback. Email/password, magic-link, resend and recovery forms are no
 * longer normal-use UI. Pure-function + SOURCE contracts only; no live
 * GoTrue delivery or real account state is claimed.
 */

const src = (rel: string) =>
  readFileSync(path.resolve(process.cwd(), rel), "utf8");

function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const loginSource = () => src("src/components/auth/login-form.tsx");
const signupSource = () => src("src/components/auth/signup-form.tsx");
const handlerSource = () => src("src/components/auth/auth-link-handler.tsx");
const linkPageSource = () => src("src/app/auth/link/page.tsx");
const confirmRouteSource = () => src("src/app/auth/confirm/route.ts");
const forgotSource = () => src("src/components/auth/forgot-password-form.tsx");
const resetSource = () => src("src/components/auth/reset-password-form.tsx");
const proxySource = () => src("src/proxy.ts");
const robotsSource = () => src("src/app/robots.ts");

describe("safe redirect helpers — no open redirects, intent preserved", () => {
  it("rejects protocol-relative and backslash-normalized attacks", () => {
    for (const bad of [
      "//evil.example",
      "/\\evil.example",
      "/%5Cevil.example",
      "https://evil.example",
      "javascript:alert(1)",
      "/\u0001evil",
    ]) {
      expect(safeAuthPath(bad)).toBe("/dashboard");
    }
  });

  it("keeps same-origin paths with query and hash", () => {
    expect(safeAuthPath("/saved-plants?category=fern#top")).toBe(
      "/saved-plants?category=fern#top"
    );
    expect(safeAuthPath(null)).toBe("/dashboard");
  });

  it("legacy email helpers remain available for rollback", () => {
    expect(authLinkRedirectUrl("https://plantai.test", "/saved-plants?x=1")).toBe(
      "https://plantai.test/auth/link?next=%2Fsaved-plants%3Fx%3D1"
    );
    expect(
      resetPasswordRedirectUrl("https://plantai.test", "/reminders")
    ).toBe("https://plantai.test/reset-password?next=%2Freminders");
  });

  it("withAuthNext preserves existing query flags", () => {
    expect(withAuthNext("/login?confirmed=1", "/dashboard")).toBe(
      "/login?confirmed=1&next=%2Fdashboard"
    );
  });
});

describe("normal-use screens no longer send email flows", () => {
  it("login has no magic-link or resend action", () => {
    const code = codeOnly(loginSource());
    expect(code).not.toMatch(/signInWithOtp|auth\.resend|emailRedirectTo/);
    expect(code).not.toMatch(/\/auth\/confirm/);
    expect(code).toMatch(/GoogleSignInButton/);
  });

  it("signup has no email confirmation form", () => {
    const code = codeOnly(signupSource());
    expect(code).not.toMatch(/signUp\(|emailRedirectTo|setPendingConfirmation/);
    expect(code).not.toMatch(/Account created|signed in automatically/);
    expect(code).toMatch(/GoogleSignInButton/);
  });

  it("forgot and reset screens redirect to the shared Google flow", () => {
    for (const source of [forgotSource(), resetSource()]) {
      expect(codeOnly(source)).toMatch(/router\.replace\(loginPath\)/);
      expect(codeOnly(source)).not.toMatch(/resetPasswordForEmail|updateUser\(/);
    }
  });
});

describe("/auth/link handler stays available for outstanding email links", () => {
  it("reads the one-time ?code= and calls exchangeCodeForSession", () => {
    expect(handlerSource()).toMatch(/searchParams\.get\("code"\)/);
    expect(handlerSource()).toMatch(/exchangeCodeForSession\(code\)/);
  });

  it("the exchange runs EXACTLY once (ref-guarded against re-mounts)", () => {
    expect(handlerSource()).toMatch(/exchangedRef\.current/);
  });

  it("the consumed code is stripped after the exchange settles, before navigation", () => {
    const code = codeOnly(handlerSource());
    expect(code).toMatch(/removeCodeFromUrl\(\)/);
    expect(code).toMatch(/replaceState\(null, "", cleanupPath\)/);
    expect(code).not.toMatch(/\.finally\(/);
  });

  it("success navigates to the validated next path (default /dashboard)", () => {
    const code = codeOnly(handlerSource());
    expect(code).toMatch(/router\.replace\(nextPath\)/);
    expect(code).toMatch(/router\.refresh\(\)/);
  });

  it("a missing code is a neutral failure state — never a blank page", () => {
    expect(handlerSource()).toMatch(
      /useState\(\(\) => !searchParams\.get\("code"\)\)/
    );
  });

  it("exchange failure shows the neutral message, never raw error output", () => {
    const code = codeOnly(handlerSource());
    expect(code).toMatch(/setFailed\(true\)/);
    expect(code).toMatch(/authLinkErrorMessage\(\)/);
    expect(code).not.toMatch(/error\.message|String\(error\)/);
  });

  it("failures offer fresh-link and account paths (no dead end)", () => {
    const code = codeOnly(handlerSource());
    expect(code).toMatch(/href=\{withAuthNext\("\/login", nextPath\)\}/);
    expect(code).toMatch(/href=\{withAuthNext\("\/signup", nextPath\)\}/);
  });

  it("the page wraps the handler in Suspense and is noindex", () => {
    expect(linkPageSource()).toMatch(/<Suspense/);
    expect(linkPageSource()).toMatch(/AuthLinkHandler/);
    expect(linkPageSource()).toMatch(/index:\s*false/);
    expect(robotsSource()).toMatch(/"\/auth\/"/);
  });

  it("/auth/link is NOT guest-only (an existing session must not block the link)", () => {
    const guestOnly = proxySource().match(
      /const GUEST_ONLY_PREFIXES = \[([\s\S]*?)\] as const;/
    );
    expect(guestOnly).not.toBeNull();
    expect(guestOnly?.[1] ?? "").not.toMatch(/\/auth\/link/);
  });
});

describe("token_hash callback (/auth/confirm) stays available", () => {
  it("still verifies token_hash server-side via verifyOtp", () => {
    expect(confirmRouteSource()).toMatch(
      /verifyOtp\(\{ type, token_hash: tokenHash \}\)/
    );
  });

  it("forwards recovery → /reset-password and routes others → /login?confirmed=1", () => {
    const source = confirmRouteSource();
    expect(source).toMatch(/if \(type === "recovery"\)/);
    expect(source).toMatch(/\/reset-password/);
    expect(source).toMatch(/"\/login\?confirmed=1"/);
  });

  it("still fails closed with the generic error flag", () => {
    expect(confirmRouteSource()).toMatch(
      /if \(!tokenHash \|\| !type\) return loginWithError\(\);/
    );
    expect(confirmRouteSource()).toMatch(/"\?error=link"/);
  });
});

describe("new OAuth callback is separate from legacy callbacks", () => {
  it("does not overwrite /auth/confirm or /auth/link", () => {
    const callback = src("src/app/auth/callback/route.ts");
    expect(callback).toMatch(/GOOGLE_OAUTH_CALLBACK_PATH|\/auth\/callback/);
    expect(confirmRouteSource()).toMatch(/verifyOtp/);
    expect(handlerSource()).toMatch(/exchangeCodeForSession\(code\)/);
  });
});

describe("neutrality of retained link failure messages", () => {
  it("invalid, expired, already-used and network failures are indistinguishable", () => {
    for (const err of [
      { code: "otp_expired" },
      { code: "invalid_credentials" },
      new Error("network"),
      undefined,
    ]) {
      expect(authLinkErrorMessage(err)).toBe(authLinkErrorMessage(undefined));
      expect(recoveryLinkErrorMessage(err)).toBe(
        recoveryLinkErrorMessage(undefined)
      );
    }
    expect(authLinkErrorMessage()).toMatch(/invalid or has expired/i);
    expect(recoveryLinkErrorMessage()).toMatch(/invalid or has expired/i);
  });
});
