import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  PASSWORD_UPDATED_MESSAGE,
  recoveryLinkErrorMessage,
} from "@/lib/auth/login-messages";

/*
 * Regression tests for the EXACT production incident (Phase 5, 2026-11-18):
 * a password-reset email link landed on /login?error=link instead of the
 * password update form.
 *
 * Root cause (proven): the browser Supabase client is PKCE by default
 * (@supabase/ssr createBrowserClient flowType "pkce"), so
 * resetPasswordForEmail sends a code_challenge and GoTrue's emailed link is
 * `{redirectTo}?code=…`. The old redirectTo (/auth/confirm?type=recovery)
 * can never succeed — that route only reads token_hash from the query
 * string, and a PKCE code can only be exchanged by the browser client that
 * holds the code_verifier. Result: verifyOtp was never reached; the route
 * bounced every recovery click to /login?error=link.
 *
 * Two layers (repo patterns): pure-function contracts on
 * src/lib/auth/login-messages.ts + SOURCE contracts pinning the fixed
 * wiring. Simulated flows only — real GoTrue behavior needs owner E2E.
 */

const src = (rel: string) => readFileSync(path.resolve(process.cwd(), rel), "utf8");
const forgotSource = () => src("src/components/auth/forgot-password-form.tsx");
const resetSource = () => src("src/components/auth/reset-password-form.tsx");
const confirmRouteSource = () => src("src/app/auth/confirm/route.ts");
const loginSource = () => src("src/components/auth/login-form.tsx");
const resetPageSource = () => src("src/app/(auth)/reset-password/page.tsx");

describe("THE incident — forgot-password redirect target (F8 fix pinned)", () => {
  it("the old broken redirectTo is gone (no token_hash-only callback for recovery)", () => {
    expect(forgotSource()).not.toMatch(/auth\/confirm\?type=recovery/);
  });

  it("the reset request never sends the user to a token_hash-only route — only comments may mention /auth/confirm", () => {
    // Every CODE occurrence of redirectTo in the form must target
    // /reset-password; /auth/confirm may appear in explanatory comments
    // documenting the incident only.
    const codeLines = forgotSource()
      .split("\n")
      .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//") && !l.trim().startsWith("/*"))
      .join("\n");
    expect(codeLines).not.toMatch(/\/auth\/confirm/);
  });
});

describe("PKCE exchange on the reset-password page (client-side only)", () => {
  it("reads the one-time ?code= param and calls exchangeCodeForSession", () => {
    expect(resetSource()).toMatch(/searchParams\.get\("code"\)/);
    expect(resetSource()).toMatch(/exchangeCodeForSession\(code\)/);
  });

  it("the code is stripped from the URL immediately (consumed codes are never re-submitted or shared)", () => {
    expect(resetSource()).toMatch(/history\.replaceState\(null, "", "\/reset-password"\)/);
  });

  it("the exchange runs EXACTLY once (ref-guarded against re-mounts)", () => {
    expect(resetSource()).toMatch(/exchangedRef\.current/);
  });

  it("exchange failure → the neutral invalid-link state, never raw error output", () => {
    expect(resetSource()).toMatch(/setLinkState\(error \? "failed" : "ready"\)/);
    expect(resetSource()).toMatch(/recoveryLinkErrorMessage\(\)/);
    expect(resetSource()).not.toMatch(/linkError\.message|error\.message/);
  });

  it("failed link → dedicated state with a fresh-request path (no dead end)", () => {
    expect(resetSource()).toMatch(/linkState === "failed"/);
    expect(resetSource()).toMatch(/href="\/forgot-password"/);
  });

  it("the page wraps the form in Suspense (useSearchParams under Next 16 Cache Components)", () => {
    expect(resetPageSource()).toMatch(/<Suspense/);
  });
});

describe("post-reset landing (success only, correctly worded)", () => {
  it("successful password update redirects to /login?reset=1 — no longer the off-label ?confirmed=1", () => {
    expect(resetSource()).toMatch(/router\.replace\("\/login\?reset=1"\)/);
    expect(resetSource()).not.toMatch(/login\?confirmed=1/);
  });

  it("the login form shows a password-specific success message for ?reset=1", () => {
    expect(loginSource()).toMatch(/searchParams\.get\("reset"\) === "1"/);
    expect(loginSource()).toMatch(/PASSWORD_UPDATED_MESSAGE/);
    expect(PASSWORD_UPDATED_MESSAGE).toMatch(/password updated/i);
  });
});

describe("normal sign-in/confirmation callback remains UNAFFECTED (/auth/confirm untouched)", () => {
  it("still verifies token_hash server-side and routes as before", () => {
    const s = confirmRouteSource();
    expect(s).toMatch(/verifyOtp\(\{ type, token_hash: tokenHash \}\)/);
    expect(s).toMatch(/type === "recovery" \? "\/reset-password" : "\/login\?confirmed=1"/);
    expect(s).toMatch(/"\?error=link"/);
  });
});

describe("neutrality of the recovery failure message (privacy standard)", () => {
  it("invalid, expired, and already-used links are INDISTINGUISHABLE — one message for every failure shape", () => {
    for (const err of [
      { code: "otp_expired" },
      { code: "invalid_credentials" },
      new Error("network"),
      undefined,
    ]) {
      expect(recoveryLinkErrorMessage(err)).toBe(recoveryLinkErrorMessage(undefined));
    }
    const message = recoveryLinkErrorMessage();
    expect(message).toMatch(/invalid or has expired/i);
    expect(message).not.toMatch(/not (registered|found|exist)|no account|already used/i);
  });
});
