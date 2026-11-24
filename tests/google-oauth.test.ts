import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import {
  GOOGLE_OAUTH_CALLBACK_PATH,
  GOOGLE_OAUTH_PROVIDER,
  GOOGLE_OAUTH_CALLBACK_ERROR_MESSAGE,
  buildGoogleOAuthRequest,
  googleOAuthErrorMessage,
  googleOAuthRedirectUrl,
  isSuccessfulOAuthExchange,
  oauthDestination,
  oauthFailurePath,
} from "@/lib/auth/google-oauth";
import { safeAuthPath } from "@/lib/auth/auth-contracts";
import {
  getPlantnetMode,
  isIdentificationPersistenceEnabled,
} from "@/lib/env";

/*
 * Offline Google OAuth contracts. No real Supabase/Google calls, no jsdom,
 * no provider credentials, and no production account state is claimed. The
 * route test mocks only the server client; identity linking is modelled by an
 * in-memory fake so first/returning and separate-email behavior can be
 * exercised without a project.
 */

const authMock = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession: authMock.exchangeCodeForSession },
  })),
}));

import { GET } from "@/app/auth/callback/route";

const src = (rel: string) =>
  readFileSync(path.resolve(process.cwd(), rel), "utf8");

function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const okExchange = {
  data: {
    session: { access_token: "offline-fake-session" },
    user: { id: "00000000-0000-4000-8000-000000000001" },
  },
  error: null,
};

function callbackRequest(query: string): NextRequest {
  return new NextRequest(
    `https://plantai.test${GOOGLE_OAUTH_CALLBACK_PATH}${query}`
  );
}

beforeEach(() => {
  authMock.exchangeCodeForSession.mockReset();
  authMock.exchangeCodeForSession.mockResolvedValue(okExchange);
});

describe("provider selection and redirect contract", () => {
  it("selects Google only and sends no email, password, user id or metadata", () => {
    const request = buildGoogleOAuthRequest(
      "https://plantai.test",
      "/saved-plants?x=1"
    );
    expect(request.provider).toBe("google");
    expect(GOOGLE_OAUTH_PROVIDER).toBe("google");
    expect(Object.keys(request).sort()).toEqual(["options", "provider"]);
    expect(Object.keys(request.options)).toEqual(["redirectTo"]);
    expect(JSON.stringify(request)).not.toMatch(
      /email|password|user[_-]?id|user_metadata|data/i
    );
  });

  it("builds an origin-absolute callback URL with a safe next destination", () => {
    expect(
      googleOAuthRedirectUrl("https://plantai.test", "/saved-plants?x=1")
    ).toBe(
      "https://plantai.test/auth/callback?next=%2Fsaved-plants%3Fx%3D1"
    );
    expect(buildGoogleOAuthRequest("https://plantai.test", null).options.redirectTo).toBe(
      "https://plantai.test/auth/callback?next=%2Fdashboard"
    );
  });

  it("re-validates next at the callback and never accepts an off-app destination", () => {
    for (const bad of [
      "//evil.example",
      "/\\evil.example",
      "/%5Cevil.example",
      "https://evil.example",
      "javascript:alert(1)",
      "/\u0001evil",
    ]) {
      expect(safeAuthPath(bad)).toBe("/dashboard");
      expect(oauthDestination(bad)).toBe("/dashboard");
    }
    expect(safeAuthPath("/saved-plants?category=fern#top")).toBe(
      "/saved-plants?category=fern#top"
    );
  });

  it("uses one generic provider error and one generic callback error", () => {
    for (const error of [
      undefined,
      { code: "access_denied", message: "google-secret-detail" },
      new Error("provider-secret-detail"),
      null,
    ]) {
      expect(googleOAuthErrorMessage(error)).toBe(
        "We couldn't continue with Google. Please try again."
      );
      expect(googleOAuthErrorMessage(error)).not.toMatch(/secret-detail/);
    }
    expect(GOOGLE_OAUTH_CALLBACK_ERROR_MESSAGE).toMatch(
      /try again/i
    );
  });
});

describe("shared Google button source contracts", () => {
  const button = () => src("src/components/auth/google-sign-in-button.tsx");
  const login = () => src("src/components/auth/login-form.tsx");
  const signup = () => src("src/components/auth/signup-form.tsx");
  const oauthContracts = () => src("src/lib/auth/google-oauth.ts");

  it("gives /login and /signup the same single accessible action", () => {
    expect(login()).toMatch(/<GoogleSignInButton \/>/);
    expect(signup()).toMatch(/<GoogleSignInButton \/>/);
    expect(codeOnly(button())).toMatch(
      /label = "Continue with Google"/
    );
    expect(button()).toMatch(/aria-live="polite"/);
    expect(button()).toMatch(/role="alert"/);
    expect(button()).toMatch(/aria-busy=\{busy\}/);
    expect(button()).toMatch(/aria-describedby=\{error \? errorId : undefined\}/);
  });

  it("starts the official Supabase OAuth redirect with a ref-guarded click", () => {
    const code = codeOnly(button());
    expect(code).toMatch(/supabase\.auth\.signInWithOAuth\(/);
    expect(code).toMatch(
      /buildGoogleOAuthRequest\(window\.location\.origin, nextPath\)/
    );
    expect(code).toMatch(/if \(!begin\(\)\) return;/);
    expect(code).toMatch(/disabled=\{busy\}/);
    expect(code).toMatch(/if \(oauthError\)/);
    expect(code).toMatch(/googleOAuthErrorMessage\(oauthError\)/);
    expect(code).not.toMatch(/error\.message|String\(oauthError\)/);
  });

  it("keeps the request limited to provider + redirectTo and carries next", () => {
    const code = codeOnly(oauthContracts());
    expect(code).toMatch(/provider: GOOGLE_OAUTH_PROVIDER/);
    expect(code).toMatch(/options: \{ redirectTo: googleOAuthRedirectUrl\(/);
    expect(code).toMatch(/safeAuthPath\(next, DEFAULT_AUTH_DESTINATION\)/);
    expect(code).not.toMatch(/\bdata:/);
    expect(code).not.toMatch(/emailRedirectTo|user_metadata|provider_id/);
  });

  it("shows no email, password, magic-link, resend or recovery control", () => {
    const normalUseForms = [
      login(),
      signup(),
      src("src/components/auth/forgot-password-form.tsx"),
      src("src/components/auth/reset-password-form.tsx"),
    ];
    for (const source of normalUseForms) {
      expect(source).not.toMatch(/type="(email|password)"/);
      expect(source).not.toMatch(/autoComplete="(email|current-password|new-password)"/);
    }
    const code = normalUseForms.map(codeOnly).join("\n");
    expect(code).not.toMatch(
      /signInWithPassword|signInWithOtp|auth\.resend|signUp\(|resetPasswordForEmail|updateUser\(|verifyOtp\(/
    );
    expect(code).not.toMatch(/shouldCreateUser|RESEND_CONFIRMATION_SENT_MESSAGE/);
  });
});

describe("server PKCE callback", () => {
  const callback = () => src("src/app/auth/callback/route.ts");

  it("uses the SSR server client and never a privileged client", () => {
    const code = codeOnly(callback());
    expect(code).toMatch(/createSupabaseServerClient\(\)/);
    expect(code).toMatch(
      /exchangeCodeForSession\(\s*code,\s*flowId \? \{ flowId \} : undefined\s*\)/
    );
    expect(code).toMatch(/isSuccessfulOAuthExchange\(result\)/);
    expect(code).toMatch(/oauthDestination\(searchParams\.get\("next"\)\)/);
    expect(code).not.toMatch(/createClient\(|SUPABASE_SECRET_KEY|SERVICE_ROLE/);
    expect(code).not.toMatch(/getSession\(\)|\.getUser\(\)/);
    expect(code).not.toMatch(/searchParams\.get\("(email|user|user_id|id)"\)/);
  });

  it("exchanges the code and writes SSR cookies before redirecting to safe next", async () => {
    const response = await GET(
      callbackRequest("?code=fake-code&next=%2Fsaved-plants%3Fx%3D1")
    );
    expect(authMock.exchangeCodeForSession).toHaveBeenCalledWith(
      "fake-code",
      undefined
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://plantai.test/saved-plants?x=1"
    );
  });

  it("passes through a PKCE flow id when Supabase appends one", async () => {
    await GET(callbackRequest("?code=fake-code&sb_flow_id=offline-flow"));
    expect(authMock.exchangeCodeForSession).toHaveBeenCalledWith("fake-code", {
      flowId: "offline-flow",
    });
  });

  it("falls back to dashboard when next is manipulated", async () => {
    const response = await GET(
      callbackRequest("?code=fake-code&next=%2F%2Fevil.example")
    );
    expect(response.headers.get("location")).toBe("https://plantai.test/dashboard");
  });

  it("fails closed without exchanging on missing code or provider error", async () => {
    for (const query of [
      "?next=%2Fsaved-plants",
      "?code=fake-code&error=access_denied&next=%2Fsaved-plants",
    ]) {
      const response = await GET(callbackRequest(query));
      expect(authMock.exchangeCodeForSession).not.toHaveBeenCalled();
      expect(response.headers.get("location")).toBe(
        `https://plantai.test${oauthFailurePath("/saved-plants")}`
      );
    }
  });

  it("fails closed when the verified exchange has no session/user id", async () => {
    authMock.exchangeCodeForSession.mockResolvedValue({
      data: { session: null, user: null },
      error: { code: "bad_code" },
    });
    const response = await GET(callbackRequest("?code=fake-code"));
    expect(response.headers.get("location")).toBe(
      `https://plantai.test${oauthFailurePath(null)}`
    );
  });
});

describe("offline identity compatibility model", () => {
  interface FakeAuth {
    googleSignIn(
      providerVerifiedEmail: string
    ): { kind: "first" | "returning"; userId: string } | null;
  }

  function createFakeAuth(seed: Record<string, string> = {}): FakeAuth {
    const usersByVerifiedEmail = new Map(Object.entries(seed));
    return {
      googleSignIn(providerVerifiedEmail) {
        const email = providerVerifiedEmail.trim().toLowerCase();
        // A fake of Supabase's verified-email automatic linking: it links by
        // provider-verified email only; the caller cannot supply a user id.
        const existing = usersByVerifiedEmail.get(email);
        if (existing) return { kind: "returning", userId: existing };
        if (!email.includes("@")) return null;
        const userId = `00000000-0000-4000-8000-${String(
          usersByVerifiedEmail.size + 1
        ).padStart(12, "0")}`;
        usersByVerifiedEmail.set(email, userId);
        return { kind: "first", userId };
      },
    };
  }

  it("creates on first Google sign-in and returns the same UUID next time", () => {
    const auth = createFakeAuth();
    const first = auth.googleSignIn("owner@example.com");
    const returning = auth.googleSignIn("owner@example.com");
    expect(first?.kind).toBe("first");
    expect(returning).toEqual({ kind: "returning", userId: first?.userId });
    expect(isSuccessfulOAuthExchange(okExchange)).toBe(true);
  });

  it("links a verified Google identity to an existing confirmed email account", () => {
    const existingUuid = "11111111-1111-4111-8111-111111111111";
    const auth = createFakeAuth({ "owner@example.com": existingUuid });
    expect(auth.googleSignIn("  OWNER@EXAMPLE.COM ")).toEqual({
      kind: "returning",
      userId: existingUuid,
    });
  });

  it("keeps different verified Google emails as independent UUID accounts", () => {
    const auth = createFakeAuth();
    const first = auth.googleSignIn("owner@example.com");
    const other = auth.googleSignIn("other@example.com");
    expect(first?.userId).not.toBe(other?.userId);
  });

  it("rejects an unverified identity result shape", () => {
    expect(
      isSuccessfulOAuthExchange({
        data: { session: { access_token: "fake" }, user: null },
        error: null,
      })
    ).toBe(false);
    expect(
      isSuccessfulOAuthExchange({
        data: { session: { access_token: "fake" }, user: { id: 42 } },
        error: null,
      })
    ).toBe(false);
    expect(
      isSuccessfulOAuthExchange({
        data: okExchange.data,
        error: { code: "access_denied" },
      })
    ).toBe(false);
  });
});

describe("unrelated safety invariants", () => {
  it("adds no Firebase dependency, SDK, env or JWT integration", () => {
    const sourceFiles: string[] = [];
    const walk = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx|js|mjs|json|toml)$/.test(entry.name)) {
          sourceFiles.push(full);
        }
      }
    };
    walk(path.resolve(process.cwd(), "src"));
    sourceFiles.push(path.resolve(process.cwd(), "package.json"));

    for (const file of sourceFiles) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/firebase/i);
    }
  });

  it("leaves PlantNet mock default and persistence-off default unchanged", () => {
    const controlled = [
      "PLANTNET_MODE",
      "PLANTNET_API_KEY",
      "PLANTAI_PERSISTENCE_ENABLED",
    ] as const;
    const saved = controlled.map((key) => process.env[key]);
    for (const key of controlled) delete process.env[key];
    try {
      expect(getPlantnetMode()).toBe("mock");
      expect(isIdentificationPersistenceEnabled()).toBe(false);
    } finally {
      for (const [index, key] of controlled.entries()) {
        const value = saved[index];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});

afterEach(() => {
  authMock.exchangeCodeForSession.mockReset();
});
