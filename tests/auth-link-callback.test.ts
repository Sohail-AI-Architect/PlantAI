import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  PASSWORD_UPDATED_MESSAGE,
  RESEND_CONFIRMATION_SENT_MESSAGE,
  authLinkErrorMessage,
  recoveryLinkErrorMessage,
} from "@/lib/auth/login-messages";

/*
 * Regression tests for the PKCE callback defects adjacent to the F8
 * recovery incident (Phase 6, 2026-11-18).
 *
 * PROVEN mechanism: the browser Supabase client is PKCE by default
 * (@supabase/ssr createBrowserClient hard-codes flowType "pkce"), so
 * `signInWithOtp` (magic link), `signUp` (confirmation) AND `resend`
 * (confirmation resend) all send a code_challenge and GoTrue emails
 * `{emailRedirectTo}?code=…`. The token_hash-only /auth/confirm route
 * cannot consume such links (a PKCE code is exchanged only by the browser
 * holding the code_verifier), so all three previously dead-ended at
 * /login?error=link — the same class of defect as the F8 recovery bug.
 *
 * The fix: all three flows now target /auth/link, a client-capable page
 * that exchanges the code exactly once. token_hash-style templates keep
 * using /auth/confirm untouched.
 *
 * Pure-function contracts + SOURCE contracts, simulated flows only. Real
 * GoTrue delivery needs owner E2E after deployment.
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

describe("magic link — PKCE redirect target", () => {
  it("emailRedirectTo points at the client-side exchange page (/auth/link)", () => {
    expect(loginSource()).toMatch(
      /emailRedirectTo:\s*`\$\{window\.location\.origin\}\/auth\/link`/
    );
  });

  it("never targets the token_hash-only callback in code (comments may explain the incident)", () => {
    expect(codeOnly(loginSource())).not.toMatch(/\/auth\/confirm/);
  });

  it("still refuses implicit account creation (shouldCreateUser: false preserved)", () => {
    expect(loginSource()).toMatch(/shouldCreateUser:\s*false/);
  });

  it("still maps OTP failures through the neutral, 429-aware mapper", () => {
    expect(loginSource()).toMatch(/magicLinkErrorMessage\(otpError\)/);
  });
});

describe("sign-up confirmation — PKCE redirect target", () => {
  it("signUp emailRedirectTo points at /auth/link", () => {
    expect(signupSource()).toMatch(
      /emailRedirectTo:\s*`\$\{window\.location\.origin\}\/auth\/link`/
    );
  });

  it("email confirmation remains required (confirmation-required path preserved)", () => {
    const code = codeOnly(signupSource());
    // No session returned by signUp → pending-confirmation state; the form
    // never treats signup as auto-signed-in when confirmation is required.
    expect(code).toMatch(/if \(data\.session\)/);
    expect(code).toMatch(/setPendingConfirmation\(true\)/);
  });

  it("the pending-confirmation copy matches the new auto-sign-in behaviour", () => {
    expect(signupSource()).toMatch(/sign you in\s*\n?\s*automatically|sign you in automatically/);
  });
});

describe("resend confirmation — PKCE redirect target", () => {
  it("resend emailRedirectTo points at /auth/link (resend also sends a PKCE challenge)", () => {
    expect(loginSource()).toMatch(
      /auth\.resend\(\{[\s\S]*?emailRedirectTo:\s*`\$\{window\.location\.origin\}\/auth\/link`/
    );
  });

  it("resend stays existence-neutral (success line unchanged)", () => {
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
  it("reads the one-time ?code= param and calls exchangeCodeForSession", () => {
    expect(handlerSource()).toMatch(/searchParams\.get\("code"\)/);
    expect(handlerSource()).toMatch(/exchangeCodeForSession\(code\)/);
  });

  it("the exchange runs EXACTLY once (ref-guarded against re-mounts)", () => {
    expect(handlerSource()).toMatch(/exchangedRef\.current/);
  });

  it("the consumed code is stripped from the URL immediately", () => {
    expect(handlerSource()).toMatch(
      /history\.replaceState\(null, "", "\/auth\/link"\)/
    );
  });

  it("a successful exchange establishes the session and navigates to the dashboard", () => {
    const code = codeOnly(handlerSource());
    expect(code).toMatch(/router\.replace\("\/dashboard"\)/);
    expect(code).toMatch(/router\.refresh\(\)/);
  });

  it("a missing code is a neutral failure state — never a silent blank page", () => {
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

  it("failures offer a fresh-link path (no dead end)", () => {
    const code = codeOnly(handlerSource());
    expect(code).toMatch(/href="\/login"/);
    expect(code).toMatch(/href="\/signup"/);
  });

  it("the page wraps the handler in Suspense (useSearchParams under Next 16)", () => {
    expect(linkPageSource()).toMatch(/<Suspense/);
    expect(linkPageSource()).toMatch(/AuthLinkHandler/);
  });

  it("the landing page is noindex and /auth/ is already robots-disallowed", () => {
    expect(linkPageSource()).toMatch(/index:\s*false/);
    expect(robotsSource()).toMatch(/"\/auth\/"/);
  });

  it("the exchange page is NOT guest-only (an existing session must not block the link)", () => {
    const guestOnly = proxySource().match(
      /const GUEST_ONLY_PREFIXES = \[([\s\S]*?)\] as const;/
    );
    expect(guestOnly).not.toBeNull();
    expect(guestOnly?.[1] ?? "").not.toMatch(/\/auth\/link/);
  });
});

describe("token_hash callback (/auth/confirm) stays UNAFFECTED", () => {
  it("still verifies token_hash server-side via verifyOtp", () => {
    expect(confirmRouteSource()).toMatch(
      /verifyOtp\(\{ type, token_hash: tokenHash \}\)/
    );
  });

  it("still routes recovery → /reset-password and others → /login?confirmed=1", () => {
    expect(confirmRouteSource()).toMatch(
      /type === "recovery" \? "\/reset-password" : "\/login\?confirmed=1"/
    );
  });

  it("still fails closed with the generic error flag", () => {
    expect(confirmRouteSource()).toMatch(/if \(!tokenHash \|\| !type\) return loginWithError\(\);/);
    expect(confirmRouteSource()).toMatch(/"\?error=link"/);
  });
});

describe("F8 recovery flow preserved by this phase", () => {
  it("forgot-password still redirects directly to /reset-password", () => {
    expect(forgotSource()).toMatch(
      /redirectTo:\s*`\$\{window\.location\.origin\}\/reset-password`/
    );
    expect(codeOnly(forgotSource())).not.toMatch(/\/auth\/confirm/);
  });

  it("reset-password still exchanges its own code client-side", () => {
    expect(resetSource()).toMatch(/exchangeCodeForSession\(code\)/);
    expect(resetSource()).toMatch(/router\.replace\("\/login\?reset=1"\)/);
    expect(PASSWORD_UPDATED_MESSAGE).toMatch(/password updated/i);
  });

  it("the two failure messages stay distinct and neutral (no account-state leak)", () => {
    expect(recoveryLinkErrorMessage()).not.toBe(authLinkErrorMessage());
    for (const message of [recoveryLinkErrorMessage(), authLinkErrorMessage()]) {
      expect(message).toMatch(/invalid or has expired/i);
      expect(message).not.toMatch(
        /not (registered|found|exist)|no account|already (used|confirmed)/i
      );
    }
  });
});

describe("neutrality of the auth-link failure message (privacy standard)", () => {
  it("invalid, expired, already-used and network failures are INDISTINGUISHABLE", () => {
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
