import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  DEFAULT_AUTH_DESTINATION,
  PASSWORD_POLICY_MESSAGE,
  SIGNUP_CONFLICT_MESSAGE,
  SIGNUP_GENERIC_MESSAGE,
  canUpdatePassword,
  forgotPasswordErrorMessage,
  isVerifiedRecoveryCodeExchange,
  isVerifiedRecoveryOtp,
  safeAuthPath,
  signUpErrorMessage,
  validateSignupFields,
} from "@/lib/auth/auth-contracts";
import { clearBrowserSession } from "@/lib/auth/session-cleanup";
import {
  authLinkErrorMessage,
  passwordSignInErrorMessage,
  recoveryLinkErrorMessage,
} from "@/lib/auth/login-messages";

/*
 * 2026-11-24 auth repair regression coverage (12 requested categories).
 * Offline only: pure helpers + source contracts + an in-memory sign-out fake.
 * No jsdom, no browser E2E, no Supabase/Netlify calls, no real accounts.
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

const login = () => src("src/components/auth/login-form.tsx");
const signup = () => src("src/components/auth/signup-form.tsx");
const forgot = () => src("src/components/auth/forgot-password-form.tsx");
const reset = () => src("src/components/auth/reset-password-form.tsx");
const signOut = () => src("src/components/auth/sign-out-button.tsx");
const authNav = () => src("src/components/auth/auth-nav.tsx");
const session = () => src("src/lib/auth/session.ts");
const proxy = () => src("src/proxy.ts");
const dashboard = () => src("src/app/(user)/dashboard/page.tsx");
const account = () => src("src/app/(user)/account/page.tsx");
const submitGate = () => src("src/lib/auth/use-submit-gate.ts");

// 1. Sign-in success -------------------------------------------------------
describe("1. sign-in success", () => {
  it("calls Supabase password sign-in and navigates to the validated destination", () => {
    const source = codeOnly(login());
    expect(source).toMatch(/supabase\.auth\.signInWithPassword\(\{/);
    expect(source).toMatch(/router\.replace\(nextPath\)/);
    expect(source).toMatch(/router\.refresh\(\)/);
    expect(source).toMatch(/if \(signInError\)/);
  });

  it("opens a fresh full navigation so proxy/RSC see the new cookies", () => {
    expect(login()).toMatch(
      /Full navigation so the proxy \+ server components see the new session/
    );
  });
});

// 2. Invalid credentials ---------------------------------------------------
describe("2. invalid credentials", () => {
  it("invalid credentials, unknown email and unconfirmed email are indistinguishable", () => {
    const invalid = passwordSignInErrorMessage({ code: "invalid_credentials" });
    expect(invalid).toBe(
      passwordSignInErrorMessage({ code: "email_not_confirmed" })
    );
    expect(invalid).toBe(passwordSignInErrorMessage(null));
    expect(invalid).not.toMatch(/wrong|incorrect|not found|no account/i);
  });

  it("rate limits and network failures get honest, non-account-state guidance", () => {
    expect(passwordSignInErrorMessage({ code: "over_request_rate_limit" })).toMatch(
      /too many sign-in attempts/i
    );
    expect(passwordSignInErrorMessage(new TypeError("Failed to fetch"))).toMatch(
      /connection/i
    );
  });
});

// 3. Signup validation -----------------------------------------------------
describe("3. signup validation", () => {
  it("enforces username, email, minimum password and confirmation rules", () => {
    expect(
      validateSignupFields({
        username: "monstera_fan",
        email: "owner@example.com",
        password: "long-enough",
        confirm: "long-enough",
      })
    ).toEqual({});

    const errors = validateSignupFields({
      username: "a!",
      email: "not-an-email",
      password: "short",
      confirm: "different",
    });
    expect(errors.username).toMatch(/3–24 characters/);
    expect(errors.email).toMatch(/valid email/i);
    expect(errors.password).toMatch(/at least 8 characters/i);
    expect(errors.confirm).toMatch(/don't match/);
  });

  it("the form validates before any call and shows per-field accessible errors", () => {
    const source = signup();
    expect(source).toMatch(/validateSignupFields\(\{ username, email, password, confirm \}\)/);
    expect(source).toMatch(/if \(Object\.keys\(errors\)\.length > 0\)/);
    expect(source).toMatch(/aria-invalid=/g);
    expect(source).toMatch(/aria-describedby=/g);
  });
});

// 4. Account creation response ---------------------------------------------
describe("4. account creation response", () => {
  it("duplicate email/username share one privacy-safe message", () => {
    for (const code of ["email_exists", "user_already_exists", "duplicate_key", "23505"]) {
      expect(signUpErrorMessage({ code })).toBe(SIGNUP_CONFLICT_MESSAGE);
    }
    expect(SIGNUP_CONFLICT_MESSAGE).not.toMatch(/created|success/i);
  });

  it("rate limit, password policy, network and generic failures never claim success", () => {
    expect(signUpErrorMessage({ code: "over_email_send_rate_limit" })).toMatch(
      /too many account requests/i
    );
    expect(signUpErrorMessage({ code: "weak_password" })).toBe(
      PASSWORD_POLICY_MESSAGE
    );
    expect(signUpErrorMessage(new TypeError("Failed to fetch"))).toMatch(
      /connection/i
    );
    expect(signUpErrorMessage(new Error("unknown"))).toBe(SIGNUP_GENERIC_MESSAGE);
    for (const message of [
      SIGNUP_CONFLICT_MESSAGE,
      PASSWORD_POLICY_MESSAGE,
      SIGNUP_GENERIC_MESSAGE,
    ]) {
      expect(message).not.toMatch(/account (has been )?created/i);
    }
  });

  it("treats a returned session as success and every no-session response as confirmation pending", () => {
    const source = codeOnly(signup());
    expect(source).toMatch(/if \(signUpError\)/);
    expect(source).toMatch(/if \(data\.session\)/);
    expect(source).toMatch(/router\.replace\(nextPath\)/);
    expect(source).toMatch(/setPendingConfirmation\(true\)/);
  });
});

// 5. Confirmation handling -------------------------------------------------
describe("5. confirmation handling", () => {
  it("confirmation links carry next through the shared helper", () => {
    expect(signup()).toMatch(
      /withAuthNext\("\/login\?confirmed=1", nextPath\)/
    );
    expect(login()).toMatch(/searchParams\.get\("confirmed"\) === "1"/);
    expect(login()).toMatch(/Email confirmed — sign in below to continue\./);
    expect(dashboard()).toMatch(/query\.confirmed === "1"/);
  });

  it("proxy keeps success flags when bouncing a confirmed session to the dashboard", () => {
    const source = proxy();
    expect(source).not.toMatch(/redirectUrl\.search = ""/);
    expect(source).toMatch(/Keep flags such as \?confirmed=1 \/ \?reset=1/);
  });

  it("auth-link handler exchanges a PKCE confirmation exactly once", () => {
    const source = codeOnly(src("src/components/auth/auth-link-handler.tsx"));
    expect(source).toMatch(/exchangedRef\.current/);
    expect(source).toMatch(/exchangeCodeForSession\(code\)/);
  });
});

// 6. Sign-out / session invalidation --------------------------------------
describe("6. sign-out and session invalidation", () => {
  it("attempts global revocation, then always falls back to local cookie clearing", async () => {
    const scopes: Array<string | undefined> = [];
    const client = {
      auth: {
        async signOut(options?: { scope?: "global" | "local" | "others" }) {
          scopes.push(options?.scope);
          if (scopes.length === 1) throw new Error("offline");
          return { error: null };
        },
      },
    };

    const result = await clearBrowserSession(client);
    expect(scopes).toEqual(["global", "local"]);
    expect(result).toMatchObject({ ok: true, usedLocalFallback: true });
    expect(result.error).toBeNull();
  });

  it("reports failure if even the local clear fails (no false success)", async () => {
    const client = {
      auth: {
        async signOut() {
          return { error: new Error("still signed in") };
        },
      },
    };
    const result = await clearBrowserSession(client);
    expect(result.ok).toBe(false);
    expect(result.usedLocalFallback).toBe(true);
  });

  it("sign-out button clears the session, refreshes, and lands on /login", () => {
    const source = codeOnly(signOut());
    expect(source).toMatch(/clearBrowserSession\(supabase\)/);
    expect(source).toMatch(/router\.replace\("\/login"\)/);
    expect(source).toMatch(/router\.refresh\(\)/);
    expect(source).toMatch(/if \(!result\.ok\)/);
    expect(source).toMatch(/aria-describedby=\{error \? errorId : undefined\}/);
    expect(source).toMatch(/role="alert"/);
  });

  it("authenticated header exposes an accessible account menu with Sign out", () => {
    const source = authNav();
    expect(source).toMatch(/<details className="relative">/);
    expect(source).toMatch(/<summary/);
    expect(source).toMatch(/aria-label="Account menu"/);
    expect(source).toMatch(/<SignOutButton/);
    expect(account()).toMatch(/<SignOutButton \/>/);
  });
});

// 7. Protected routes ------------------------------------------------------
describe("7. protected routes", () => {
  it("proxy protects every authenticated prefix and bounces guests from auth pages", () => {
    const source = proxy();
    for (const prefix of [
      "/dashboard",
      "/my-plants",
      "/saved-plants",
      "/reminders",
      "/account",
    ]) {
      expect(source).toContain(`"${prefix}"`);
    }
    for (const prefix of ["/login", "/signup", "/forgot-password"]) {
      expect(source).toContain(`"${prefix}"`);
    }
  });

  it("dashboard and account re-check claims server-side (defense in depth)", () => {
    expect(dashboard()).toMatch(/requireAuthRedirect\("\/dashboard"\)/);
    expect(account()).toMatch(/requireAuthRedirect\("\/account"\)/);
    expect(codeOnly(session())).toMatch(/supabase\.auth\.getClaims\(\)/);
    expect(codeOnly(session())).not.toMatch(/getSession\(\).*user/);
  });

  it("proxy verifies claims once per request and preserves query in next", () => {
    expect((codeOnly(proxy()).match(/getClaims\(\)/g) ?? []).length).toBe(1);
    expect(proxy()).toMatch(/`\$\{pathname\}\$\{request\.nextUrl\.search\}`/);
  });
});

// 8. Forgot-password submission -------------------------------------------
describe("8. forgot-password submission", () => {
  it("uses resetPasswordForEmail with the shared reset URL and next path", () => {
    const source = codeOnly(forgot());
    expect(source).toMatch(/resetPasswordForEmail\(/);
    expect(source).toMatch(/redirectTo:\s*resetPasswordRedirectUrl\(/);
    expect(source).toMatch(/safeAuthPath\(searchParams\.get\("next"\)\)/);
  });

  it("rate limit and network errors are honest and neutral", () => {
    expect(forgotPasswordErrorMessage({ code: "over_email_send_rate_limit" })).toMatch(
      /too many reset emails/i
    );
    expect(forgotPasswordErrorMessage(new TypeError("Failed to fetch"))).toMatch(
      /connection/i
    );
    for (const message of [
      forgotPasswordErrorMessage({ code: "otp_disabled" }),
      forgotPasswordErrorMessage(null),
    ]) {
      expect(message).not.toMatch(/not found|no account/i);
    }
  });
});

// 9. Password-reset completion --------------------------------------------
describe("9. password-reset completion", () => {
  it("unlocks only on SDK-verified recovery authorization, never an ordinary session", () => {
    const source = codeOnly(reset());
    expect(source).toMatch(/linkState === "verifying"/);
    expect(source).toMatch(/linkState === "failed"/);
    expect(source).toMatch(/exchangeCodeForSession\(code\)/);
    expect(source).toMatch(/isVerifiedRecoveryCodeExchange\(result\)/);
    expect(source).toMatch(/type === "recovery"/);
    expect(source).toMatch(
      /verifyOtp\(\{ type: "recovery", token_hash: tokenHash \}\)/
    );
    expect(source).toMatch(/isVerifiedRecoveryOtp\("recovery", result\)/);
    expect(source).not.toMatch(/\.getUser\(\)/);
    expect(reset()).toMatch(/No recovery code or recovery token_hash/);
  });

  it("accepts a valid PKCE recovery exchange and rejects ordinary/invalid results", () => {
    const session = { access_token: "fake-offline-session" };
    expect(
      isVerifiedRecoveryCodeExchange({
        data: { session, redirectType: "recovery" },
        error: null,
      })
    ).toBe(true);

    expect(
      isVerifiedRecoveryCodeExchange({
        data: { session, redirectType: null },
        error: null,
      })
    ).toBe(false);
    expect(
      isVerifiedRecoveryCodeExchange({
        data: { session, redirectType: "magiclink" },
        error: null,
      })
    ).toBe(false);
    expect(
      isVerifiedRecoveryCodeExchange({
        data: { session: null, redirectType: "recovery" },
        error: null,
      })
    ).toBe(false);
    expect(isVerifiedRecoveryCodeExchange(null)).toBe(false);
  });

  it("accepts a valid token_hash recovery OTP and rejects expired/ordinary results", () => {
    const session = { access_token: "fake-offline-session" };
    expect(
      isVerifiedRecoveryOtp("recovery", {
        data: { session, user: { id: "offline-user" } },
        error: null,
      })
    ).toBe(true);

    expect(
      isVerifiedRecoveryOtp("email", {
        data: { session, user: { id: "offline-user" } },
        error: null,
      })
    ).toBe(false);
    expect(
      isVerifiedRecoveryOtp("recovery", {
        data: { session: null, user: null },
        error: null,
      })
    ).toBe(false);
    expect(
      isVerifiedRecoveryOtp("recovery", {
        data: { session, user: null },
        error: { code: "otp_expired" },
      })
    ).toBe(false);
    expect(isVerifiedRecoveryOtp("recovery", undefined)).toBe(false);
  });

  it("handler rejects every non-ready state before begin() or updateUser()", () => {
    const source = codeOnly(reset());
    const guardIndex = source.indexOf("if (!canUpdatePassword(linkState))");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(source.indexOf("if (!begin()) return;"));
    expect(guardIndex).toBeLessThan(source.indexOf("supabase.auth.updateUser"));

    for (const state of [
      "verifying",
      "failed",
      "",
      "READY",
      "ready ",
      null,
      undefined,
    ]) {
      expect(canUpdatePassword(state), String(state)).toBe(false);
    }
    expect(canUpdatePassword("ready")).toBe(true);
    expect(source).toMatch(
      /disabled=\{busy \|\| !canUpdatePassword\(linkState\)\}/
    );
  });

  it("updates the password, clears the session and lands on /login?reset=1", () => {
    const source = codeOnly(reset());
    expect(source).toMatch(/supabase\.auth\.updateUser\(\{/);
    expect(source).toMatch(/clearBrowserSession\(supabase\)/);
    expect(source).toMatch(/if \(!cleanup\.ok\)/);
    expect(source).toMatch(
      /router\.replace\(withAuthNext\("\/login\?reset=1", nextPath\)\)/
    );
  });
});

// 10. Invalid / expired links ---------------------------------------------
describe("10. invalid and expired links", () => {
  it("all failure shapes share one neutral message per link type", () => {
    for (const err of [
      { code: "otp_expired" },
      { code: "invalid_credentials" },
      new Error("network"),
      undefined,
    ]) {
      expect(authLinkErrorMessage(err)).toBe(authLinkErrorMessage());
      expect(recoveryLinkErrorMessage(err)).toBe(recoveryLinkErrorMessage());
    }
    expect(authLinkErrorMessage()).toMatch(/invalid or has expired/i);
    expect(recoveryLinkErrorMessage()).toMatch(/invalid or has expired/i);
  });

  it("reset form offers a fresh-link path instead of a dead end", () => {
    expect(reset()).toMatch(/Request a new reset email →/);
    expect(
      src("src/components/auth/auth-link-handler.tsx")
    ).toMatch(/Request a new sign-in link →/);
  });

  it("redirect helper falls back safely for malformed link state", () => {
    expect(safeAuthPath("javascript:alert(1)")).toBe(
      DEFAULT_AUTH_DESTINATION
    );
  });
});

// 11. Duplicate submissions -----------------------------------------------
describe("11. duplicate submissions", () => {
  it("shared hook uses a ref so two same-tick submits cannot both start", () => {
    const source = submitGate();
    expect(source).toMatch(/const inFlight = useRef\(false\)/);
    expect(source).toMatch(/if \(inFlight\.current\) return false/);
    expect(source).toMatch(/inFlight\.current = true/);
  });

  it("every async auth handler checks begin() before doing work", () => {
    expect(login()).toMatch(/if \(!begin\("password"\)\) return;/);
    expect(login()).toMatch(/if \(!begin\("magic"\)\) return;/);
    expect(login()).toMatch(/if \(!begin\("resend"\)\) return;/);
    for (const source of [signup(), forgot(), reset(), signOut()]) {
      expect(source).toMatch(/if \(!begin\(\)\) return;/);
    }
  });

  it("busy state disables buttons and exposes aria-busy", () => {
    for (const source of [login(), signup(), forgot(), reset(), signOut()]) {
      expect(source).toMatch(/disabled=\{busy/);
      expect(source).toMatch(/aria-busy=/);
    }
  });
});

// 12. Complete demo-auth removal ------------------------------------------
describe("12. complete temporary Demo Account auth removal", () => {
  const authCodeFiles = [
    "src/components/auth/login-form.tsx",
    "src/components/auth/signup-form.tsx",
    "src/components/auth/forgot-password-form.tsx",
    "src/components/auth/reset-password-form.tsx",
    "src/components/auth/auth-link-handler.tsx",
    "src/components/auth/auth-nav.tsx",
    "src/components/auth/sign-out-button.tsx",
    "src/lib/auth/session.ts",
    "src/lib/auth/auth-contracts.ts",
    "src/lib/auth/session-cleanup.ts",
    "src/lib/auth/use-submit-gate.ts",
    "src/app/(user)/account/page.tsx",
    "src/app/(user)/dashboard/page.tsx",
    "src/app/auth/confirm/route.ts",
    "src/app/auth/link/page.tsx",
    "src/proxy.ts",
  ];

  it("no auth source calls anonymous sign-in or renders a demo control/badge", () => {
    for (const file of authCodeFiles) {
      const code = codeOnly(src(file));
      expect(code, file).not.toMatch(
        /signInAnonymously|Try Demo Account|Demo guest|isAnonymous|demo[A-Za-z -]*session/i
      );
    }
  });

  it("anonymous sign-ins remain disabled in local config", () => {
    expect(src("supabase/config.toml")).toMatch(
      /enable_anonymous_sign_ins\s*=\s*false/
    );
  });

  it("docs no longer advertise a demo login as available", () => {
    for (const file of [
      "README.md",
      "SECURITY.md",
      "API_DOCUMENTATION.md",
      "ARCHITECTURE.md",
      "TESTING_PLAN.md",
      "PHASE_2_COMPLETION_REPORT.md",
      "CHANGELOG.md",
    ]) {
      expect(src(file), file).not.toMatch(
        /try demo account|demo guest|signInAnonymously|1-click demo|temporary demo session/i
      );
    }
  });

  it("PlantNet mock identification behavior is untouched by auth removal", () => {
    expect(
      src("src/components/identify/mock-demo-banner.tsx")
    ).toMatch(/mock/i);
    expect(src("src/lib/plantnet/provider.ts")).toMatch(/getProvider/);
    expect(src("src/lib/plantnet/provider.ts")).toMatch(/mock/i);
  });
});
