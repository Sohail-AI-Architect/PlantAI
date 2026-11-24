import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildPasswordSignInPayload,
  buildSignUpPayload,
  normalizeAuthEmail,
  validateSignupFields,
} from "@/lib/auth/auth-contracts";
import {
  PASSWORD_SIGN_IN_ERROR_MESSAGE,
  passwordSignInErrorMessage,
} from "@/lib/auth/login-messages";

/*
 * 2026-11-24 signup/login field-mapping regression coverage.
 * Offline only: pure helpers + committed source contracts. No jsdom, no
 * browser E2E, no Supabase calls, no real accounts and no real credentials.
 */

const src = (rel: string) =>
  readFileSync(path.resolve(process.cwd(), rel), "utf8");
const signup = () => src("src/components/auth/signup-form.tsx");
const login = () => src("src/components/auth/login-form.tsx");
const profileTrigger = () =>
  src("supabase/migrations/20260101000001_001_functions_triggers.sql");
const profileSchema = () =>
  src("supabase/migrations/20260101000000_000_initial_schema.sql");

function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

function payloadCall(
  source: string,
  method: "signUp" | "signInWithPassword",
  builder: "buildSignUpPayload" | "buildPasswordSignInPayload"
): string {
  const pattern = new RegExp(
    `auth\\.${method}\\(\\s*${builder}\\(\\{[\\s\\S]*?\\}\\)\\s*\\)`
  );
  const match = source.match(pattern);
  if (!match) throw new Error(`Missing auth.${method} payload call`);
  return match[0];
}

function inputFor(source: string, id: string): string {
  const idIndex = source.indexOf(`id="${id}"`);
  if (idIndex === -1) throw new Error(`Missing input id=${id}`);
  const start = source.lastIndexOf("<input", idIndex);
  const end = source.indexOf("/>", idIndex);
  if (start === -1 || end === -1) throw new Error(`Malformed input id=${id}`);
  return source.slice(start, end + 2);
}

function attributeValues(source: string, attribute: "id" | "name"): string[] {
  return (source.match(new RegExp(`\\b${attribute}="[^"]+"`, "g")) ?? []).map(
    (value) => value.slice(attribute.length + 2, -1)
  );
}

describe("shared email normalization", () => {
  it("trims and lowercases before validation or Supabase calls", () => {
    expect(normalizeAuthEmail("  Owner.Name+Tag@Example.COM  ")).toBe(
      "owner.name+tag@example.com"
    );
    expect(normalizeAuthEmail(" MONSTERA_FAN ")).toBe("monstera_fan");
  });

  it("accepts a mixed-case address with the shared signup validator", () => {
    expect(
      validateSignupFields({
        username: "monstera_fan",
        email: "  Owner@Example.COM  ",
        password: "long-enough",
        confirm: "long-enough",
      })
    ).toEqual({});
  });
});

describe("signup field mapping", () => {
  it("sends normalized email as Auth identity and display name as metadata", () => {
    const call = payloadCall(signup(), "signUp", "buildSignUpPayload");
    expect(call).toMatch(/\n\s*email: normalizedEmail,\n/);
    expect(call).toMatch(/username:\s*normalizedUsername/);
    expect(call).not.toMatch(/email:\s*(?:username|normalizedUsername)/);
    expect(signup()).toMatch(/const normalizedUsername = username\.trim\(\)/);
  });

  it("uses the established profiles.username field and auth trigger", () => {
    expect(profileSchema()).toMatch(/username\s+text not null unique/);
    expect(profileTrigger()).toMatch(/raw_user_meta_data->>'username'/);
  });

  it("sends the signup password unchanged", () => {
    const call = payloadCall(signup(), "signUp", "buildSignUpPayload");
    expect(call).toMatch(/\n\s*password,\n/);
    expect(call).not.toMatch(
      /password\.(?:trim|toLowerCase|toUpperCase)\(/
    );
    expect(call).not.toMatch(/password:\s*confirm/);
  });
});

describe("login field mapping", () => {
  it("signs in with normalized email and unchanged password", () => {
    const call = payloadCall(login(), "signInWithPassword", "buildPasswordSignInPayload");
    expect(call).toMatch(/email:\s*normalizedEmail/);
    expect(call).toMatch(/\bpassword\b/);
    expect(call).not.toMatch(/email:\s*(?:username|email)\b/);
    expect(call).not.toMatch(
      /password\.(?:trim|toLowerCase|toUpperCase)\(/
    );
    expect(login()).toMatch(/normalizeAuthEmail\(email\)/);
  });

  it("has no Name field in the credential form", () => {
    const code = codeOnly(login());
    expect(code).not.toMatch(
      /name="username"|id="username"|autoComplete="name"|autoComplete="nickname"/
    );
    expect(inputFor(code, "email")).toMatch(/type="email"/);
    expect(inputFor(code, "password")).toMatch(/name="password"/);
  });
});

/*
 * Fake visitor records are offline payload mocks: these tests exercise the
 * production builders with synthetic reserved domains and never call Supabase.
 */
describe("public multi-user registration — offline synthetic visitors", () => {
  const visitors = [
    {
      name: "Aster",
      email: "Aster.Visitor@alpha.example",
      password: "fake-password-1",
    },
    { name: "Fern", email: "fern@beta.test", password: "fake-password-2" },
    {
      name: "Moss",
      email: "MOSS+plant@gamma.example.org",
      password: "fake-password-3",
    },
    {
      name: "Lotus",
      email: "lotus@delta.example.net",
      password: "fake-password-4",
    },
  ];

  for (const visitor of visitors) {
    it(`registers and signs in ${visitor.email} independently`, () => {
      const redirectTo = "https://plant.test/auth/link";
      const signUpPayload = buildSignUpPayload({
        username: visitor.name,
        email: visitor.email,
        password: visitor.password,
        emailRedirectTo: redirectTo,
      });

      expect(signUpPayload.email).toBe(visitor.email.toLowerCase());
      expect(signUpPayload.email).not.toBe(visitor.name);
      expect(signUpPayload.options.data.username).toBe(visitor.name);
      expect(signUpPayload.password).toBe(visitor.password);
      expect(signUpPayload.options.emailRedirectTo).toBe(redirectTo);

      const signInPayload = buildPasswordSignInPayload({
        email: signUpPayload.email,
        password: signUpPayload.password,
      });
      expect(signInPayload).toEqual({
        email: visitor.email.toLowerCase(),
        password: visitor.password,
      });
      expect(signInPayload.email).not.toBe(visitor.name);
    });
  }

  it("auth code has no hardcoded email, owner allowlist or domain gate", () => {
    for (const source of [
      signup(),
      login(),
      src("src/lib/auth/auth-contracts.ts"),
    ]) {
      const code = codeOnly(source);
      expect(code).not.toMatch(
        /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
      );
      expect(code).not.toMatch(
        /ownerEmail|owner_email|allowedDomains|allowlist|whitelist/i
      );
      expect(code).not.toMatch(/email\s*===|email\s*!==/);
    }
    expect(src("supabase/config.toml")).toMatch(/enable_signup\s*=\s*true/);
  });
});

describe("browser autofill semantics", () => {
  it("signup maps nickname, email and two new-password inputs", () => {
    const source = signup();
    expect(inputFor(source, "username")).toMatch(/name="username"/);
    expect(inputFor(source, "username")).toMatch(/autoComplete="nickname"/);
    expect(inputFor(source, "username")).not.toMatch(/autoComplete="username"/);
    expect(inputFor(source, "email")).toMatch(/type="email"/);
    expect(inputFor(source, "email")).toMatch(/name="email"/);
    expect(inputFor(source, "email")).toMatch(/autoComplete="email"/);
    expect(inputFor(source, "password")).toMatch(/name="password"/);
    expect(inputFor(source, "password")).toMatch(/autoComplete="new-password"/);
    expect(inputFor(source, "confirm-password")).toMatch(
      /name="confirmPassword"/
    );
    expect(inputFor(source, "confirm-password")).toMatch(
      /autoComplete="new-password"/
    );
  });

  it("login maps email as the auth username and password as current", () => {
    const source = login();
    expect(inputFor(source, "email")).toMatch(/type="email"/);
    expect(inputFor(source, "email")).toMatch(/name="email"/);
    expect(inputFor(source, "email")).toMatch(/autoComplete="username"/);
    expect(inputFor(source, "email")).not.toMatch(/autoComplete="email"/);
    expect(inputFor(source, "password")).toMatch(/name="password"/);
    expect(inputFor(source, "password")).toMatch(/autoComplete="current-password"/);
  });

  it("uses no hidden/stale controls and no duplicate ids or names", () => {
    for (const source of [signup(), login()]) {
      expect(source).not.toMatch(/type="hidden"/);
      expect(source).not.toMatch(/autoComplete="off"/);
      for (const attribute of ["id", "name"] as const) {
        const values = attributeValues(source, attribute);
        expect(new Set(values).size, `${attribute} values`).toBe(values.length);
      }
    }
  });
});

describe("confirmation and credential errors", () => {
  it("does not gate confirmed accounts on profile confirmation state", () => {
    const code = codeOnly(login());
    expect(code).toMatch(/signInWithPassword/);
    expect(code).not.toMatch(/email_not_confirmed|email_confirmed|profiles/);
  });

  it("treats unconfirmed and invalid credentials with the same neutral message", () => {
    expect(passwordSignInErrorMessage({ code: "email_not_confirmed" })).toBe(
      PASSWORD_SIGN_IN_ERROR_MESSAGE
    );
    expect(passwordSignInErrorMessage({ code: "invalid_credentials" })).toBe(
      PASSWORD_SIGN_IN_ERROR_MESSAGE
    );
  });

  it("incorrect credentials get an honest, non-account-revealing error", () => {
    const message = passwordSignInErrorMessage({ code: "invalid_credentials" });
    expect(message).toMatch(/Check your email and password/i);
    expect(message).not.toMatch(/not (registered|found|exist)|no account/i);
    expect(message).not.toMatch(/account (exists|created)/i);
    expect(message).not.toMatch(/correct password/i);
    expect(login()).toMatch(/setError\(passwordSignInErrorMessage\(signInError\)\)/);
  });
});

describe("duplicate submissions", () => {
  it("signup uses the shared ref gate and disables the button", () => {
    const source = signup();
    expect(source).toMatch(/const \{ busy, begin, finish \} = useSubmitGate\(\)/);
    expect(source).toMatch(/if \(!begin\(\)\) return;/);
    expect(source).toMatch(/disabled=\{busy\}/);
  });

  it("login uses the action-specific ref gate before password sign-in", () => {
    const source = login();
    expect(source).toMatch(/if \(!begin\("password"\)\) return;/);
    expect(source).toMatch(/pendingRef\.current/);
    expect(source).toMatch(/disabled=\{busy\}/);
  });
});
