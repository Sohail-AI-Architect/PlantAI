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
 * Offline regression coverage after the Google OAuth cutover.
 *
 * Normal-use UI is Google-only. The pure legacy email-flow helpers and the
 * /auth/confirm + /auth/link rollback callbacks are retained and tested; no
 * password UI is shown. No jsdom, no browser E2E, no Supabase/Netlify calls.
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

const signOut = () => src("src/components/auth/sign-out-button.tsx");
const authNav = () => src("src/components/auth/auth-nav.tsx");
const session = () => src("src/lib/auth/session.ts");
const proxy = () => src("src/proxy.ts");
const dashboard = () => src("src/app/(user)/dashboard/page.tsx");
const account = () => src("src/app/(user)/account/page.tsx");
const submitGate = () => src("src/lib/auth/use-submit-gate.ts");
const googleButton = () => src("src/components/auth/google-sign-in-button.tsx");

describe("1. Google-only sign-in UI", () => {
  it("uses the shared button with validated next and no credential inputs", () => {
    for (const form of [
      src("src/components/auth/login-form.tsx"),
      src("src/components/auth/signup-form.tsx"),
    ]) {
      expect(form).toMatch(/<GoogleSignInButton \/>/);
      expect(form).toMatch(/safeAuthPath\(searchParams\.get\("next"\)\)/);
      expect(form).not.toMatch(/type="(email|password)"/);
    }
    const code = codeOnly(googleButton());
    expect(code).toMatch(/if \(!begin\(\)\) return;/);
    expect(code).toMatch(/disabled=\{busy\}/);
    expect(code).toMatch(/aria-busy=\{busy\}/);
    expect(code).toMatch(/Continuing with Google…/);
  });

  it("keeps the safe next guard", () => {
    expect(safeAuthPath("javascript:alert(1)")).toBe(
      DEFAULT_AUTH_DESTINATION
    );
  });
});

describe("2. legacy neutral error helpers stay privacy-safe", () => {
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

describe("3. retained signup helpers stay offline-testable", () => {
  it("validates username, email, minimum password and confirmation rules", () => {
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

  it("signup failure messages never claim success", () => {
    for (const code of ["email_exists", "user_already_exists", "duplicate_key", "23505"]) {
      expect(signUpErrorMessage({ code })).toBe(SIGNUP_CONFLICT_MESSAGE);
    }
    expect(signUpErrorMessage({ code: "weak_password" })).toBe(
      PASSWORD_POLICY_MESSAGE
    );
    expect(signUpErrorMessage(new Error("unknown"))).toBe(SIGNUP_GENERIC_MESSAGE);
    expect(SIGNUP_CONFLICT_MESSAGE).not.toMatch(/created|success/i);
  });
});

describe("4. legacy callbacks preserved for rollback", () => {
  it("confirmation links keep their shared helpers and success flag", () => {
    expect(dashboard()).toMatch(/query\.confirmed === "1"/);
    expect(proxy()).toMatch(/Keep flags such as \?confirmed=1 \/ \?reset=1/);
  });

  it("auth-link handler exchanges a PKCE confirmation exactly once", () => {
    const source = codeOnly(src("src/components/auth/auth-link-handler.tsx"));
    expect(source).toMatch(/exchangedRef\.current/);
    expect(source).toMatch(/exchangeCodeForSession\(code\)/);
  });

  it("token_hash callback still verifies and forwards recovery", () => {
    const source = src("src/app/auth/confirm/route.ts");
    expect(source).toMatch(/verifyOtp\(\{ type, token_hash: tokenHash \}\)/);
    expect(source).toMatch(/if \(type === "recovery"\)/);
    expect(source).toMatch(/"\/login\?confirmed=1"/);
  });
});

describe("5. sign-out / session invalidation", () => {
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
    expect(source).toMatch(/aria-label="Account menu"/);
    expect(source).toMatch(/<SignOutButton/);
    expect(account()).toMatch(/<SignOutButton \/>/);
  });
});

describe("6. protected routes after sign-out", () => {
  it("proxy protects every authenticated prefix and keeps guest routes", () => {
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

describe("7. retired password screens do not render password UI", () => {
  it("forgot and reset routes redirect to Google sign-in", () => {
    for (const source of [
      src("src/components/auth/forgot-password-form.tsx"),
      src("src/components/auth/reset-password-form.tsx"),
    ]) {
      expect(source).toMatch(/router\.replace\(loginPath\)/);
      expect(source).not.toMatch(/resetPasswordForEmail|updateUser\(|type="password"/);
    }
  });

  it("legacy recovery helpers are unchanged and neutral", () => {
    expect(forgotPasswordErrorMessage({ code: "over_email_send_rate_limit" })).toMatch(
      /too many reset emails/i
    );
    expect(recoveryLinkErrorMessage()).toMatch(/invalid or has expired/i);
    expect(authLinkErrorMessage()).not.toBe(recoveryLinkErrorMessage());
  });

  it("recovery verification helpers reject ordinary sessions", () => {
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
  });

  it("recovery update guard only accepts ready", () => {
    for (const state of ["verifying", "failed", "", "READY", null, undefined]) {
      expect(canUpdatePassword(state), String(state)).toBe(false);
    }
    expect(canUpdatePassword("ready")).toBe(true);
  });
});

describe("8. duplicate submissions", () => {
  it("shared hook uses a ref so two same-tick submits cannot both start", () => {
    const source = submitGate();
    expect(source).toMatch(/const inFlight = useRef\(false\)/);
    expect(source).toMatch(/if \(inFlight\.current\) return false/);
    expect(source).toMatch(/inFlight\.current = true/);
  });

  it("every async auth action checks begin() before doing work", () => {
    expect(googleButton()).toMatch(/if \(!begin\(\)\) return;/);
    for (const source of [signOut()]) {
      expect(source).toMatch(/if \(!begin\(\)\) return;/);
      expect(source).toMatch(/disabled=\{busy/);
      expect(source).toMatch(/aria-busy=/);
    }
  });
});

describe("9. complete temporary Demo Account auth removal", () => {
  const authCodeFiles = [
    "src/components/auth/login-form.tsx",
    "src/components/auth/signup-form.tsx",
    "src/components/auth/forgot-password-form.tsx",
    "src/components/auth/reset-password-form.tsx",
    "src/components/auth/google-sign-in-button.tsx",
    "src/components/auth/auth-link-handler.tsx",
    "src/components/auth/auth-nav.tsx",
    "src/components/auth/sign-out-button.tsx",
    "src/lib/auth/google-oauth.ts",
    "src/lib/auth/session.ts",
    "src/lib/auth/auth-contracts.ts",
    "src/lib/auth/session-cleanup.ts",
    "src/lib/auth/use-submit-gate.ts",
    "src/app/(user)/account/page.tsx",
    "src/app/(user)/dashboard/page.tsx",
    "src/app/auth/callback/route.ts",
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
    expect(src("src/components/identify/mock-demo-banner.tsx")).toMatch(
      /mock/i
    );
  });
});
