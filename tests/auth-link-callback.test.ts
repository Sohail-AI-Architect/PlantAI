import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  PASSWORD_UPDATED_MESSAGE,
  RESEND_CONFIRMATION_SENT_MESSAGE,
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
 * Regression tests for the PKCE callback defects (F8/F9 + 2026-11-24 repair).
 *
 * The browser Supabase client is PKCE by default, so signInWithOtp, signUp,
 * resend and password recovery all email a `?code=` that only the originating
 * browser can exchange. Magic-link/confirmation links land on /auth/link;
 * recovery lands on /reset-password; token_hash recovery is forwarded there
 * too so the browser can prove PASSWORD_RECOVERY, while other token_hash
 * templates stay server-verified in /auth/confirm.
 *
 * Pure-function contracts + SOURCE contracts, simulated flows only. Real
 * GoTrue delivery needs owner E2E and is not claimed here.
 */

const src = (rel: string) =>
  readFileSync(path.resolve(process.cwd(), rel), "utf8");

/** Strip block + line comments so assertions pin CODE, not documentation. */
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

  it("email links carry the validated next destination", () => {
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

describe("magic link — PKCE redirect target", () => {
  it("emailRedirectTo uses the client-side exchange helper (/auth/link)", () => {
    expect(loginSource()).toMatch(/emailRedirectTo:\s*authLinkRedirectUrl\(/);
  });

  it("never targets the token_hash-only callback in code", () => {
    expect(codeOnly(loginSource())).not.toMatch(/\/auth\/confirm/);
  });

  it("refuses implicit account creation", () => {
    expect(loginSource()).toMatch(/shouldCreateUser:\s*false/);
  });

  it("maps OTP failures through the neutral 429-aware mapper", () => {
    expect(loginSource()).toMatch(/magicLinkErrorMessage\(otpError\)/);
  });
});

describe("sign-up confirmation — PKCE redirect target", () => {
  it("signUp emailRedirectTo uses /auth/link with `next`", () => {
    expect(signupSource()).toMatch(/emailRedirectTo:\s*authLinkRedirectUrl\(/);
    expect(signupSource()).toMatch(/withAuthNext\(/g);
  });

  it("never claims an account was created unless Supabase returns success", () => {
    const code = codeOnly(signupSource());
    expect(code).toMatch(/if \(signUpError\)/);
    expect(code).toMatch(/if \(data\.session\)/);
    expect(code).toMatch(/setPendingConfirmation\(true\)/);
    expect(code).not.toMatch(/Account created/);
  });

  it("pending-confirmation copy matches auto-sign-in on link open", () => {
    expect(signupSource()).toMatch(/signed in automatically/);
  });
});

describe("resend confirmation — PKCE redirect target", () => {
  it("resend emailRedirectTo uses /auth/link (resend also sends a PKCE challenge)", () => {
    expect(loginSource()).toMatch(
      /auth\.resend\(\{[\s\S]*?emailRedirectTo:\s*authLinkRedirectUrl\(/
    );
  });

  it("resend stays existence-neutral", () => {
    expect(loginSource()).toMatch(/setInfo\(RESEND_CONFIRMATION_SENT_MESSAGE\)/);
    expect(RESEND_CONFIRMATION_SENT_MESSAGE).toMatch(
      /if that address still needs confirming/i
    );
    expect(RESEND_CONFIRMATION_SENT_MESSAGE).not.toMatch(
      /not (registered|found|exist)|no account/i
    );
  });
});

describe("/auth/link handler — client-side PKCE exchange", () => {
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

describe("password recovery flow preserved", () => {
  it("forgot-password redirects directly to /reset-password via the shared helper", () => {
    expect(forgotSource()).toMatch(
      /redirectTo:\s*resetPasswordRedirectUrl\(/
    );
    expect(codeOnly(forgotSource())).not.toMatch(/\/auth\/confirm/);
  });

  it("reset-password exchanges its own PKCE code and clears the session before landing", () => {
    expect(resetSource()).toMatch(/exchangeCodeForSession\(code\)/);
    expect(resetSource()).toMatch(/clearBrowserSession\(supabase\)/);
    expect(resetSource()).toMatch(
      /router\.replace\(withAuthNext\("\/login\?reset=1", nextPath\)\)/
    );
    expect(PASSWORD_UPDATED_MESSAGE).toMatch(/password updated/i);
  });

  it("the two failure messages stay distinct and neutral", () => {
    expect(recoveryLinkErrorMessage()).not.toBe(authLinkErrorMessage());
    for (const message of [recoveryLinkErrorMessage(), authLinkErrorMessage()]) {
      expect(message).toMatch(/invalid or has expired/i);
      expect(message).not.toMatch(
        /not (registered|found|exist)|no account|already (used|confirmed)/i
      );
    }
  });
});

describe("neutrality of the auth-link failure message", () => {
  it("invalid, expired, already-used and network failures are indistinguishable", () => {
    for (const err of [
      { code: "otp_expired" },
      { code: "invalid_credentials" },
      new Error("network"),
      undefined,
    ]) {
      expect(authLinkErrorMessage(err)).toBe(authLinkErrorMessage(undefined));
    }
  });
});
