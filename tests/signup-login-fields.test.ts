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
 * Offline contracts after the Google OAuth cutover. The legacy payload helpers
 * remain pinned for rollback, while source assertions verify that /login and
 * /signup no longer expose email, username, password or confirmation fields.
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

describe("retained field helpers", () => {
  it("normalizes email with the shared helper", () => {
    expect(normalizeAuthEmail("  Owner.Name+Tag@Example.COM  ")).toBe(
      "owner.name+tag@example.com"
    );
  });

  it("signup validation accepts a mixed-case email", () => {
    expect(
      validateSignupFields({
        username: "monstera_fan",
        email: "Owner.Name@Example.com",
        password: "long-enough",
        confirm: "long-enough",
      })
    ).toEqual({});
  });

  it("legacy signup payload keeps username metadata for the rollback trigger", () => {
    const payload = buildSignUpPayload({
      username: "  Monstera_Fan  ",
      email: "  Owner@Example.com ",
      password: "exact-password",
      emailRedirectTo: "https://plant.test/auth/link",
    });
    expect(payload).toMatchObject({
      email: "owner@example.com",
      password: "exact-password",
      options: {
        data: { username: "Monstera_Fan" },
        emailRedirectTo: "https://plant.test/auth/link",
      },
    });
    expect(profileTrigger()).toMatch(/raw_user_meta_data->>'username'/);
  });

  it("legacy password sign-in payload normalizes email and keeps password unchanged", () => {
    const payload = buildPasswordSignInPayload({
      email: "  Owner@Example.com ",
      password: "exact-password",
    });
    expect(payload).toEqual({
      email: "owner@example.com",
      password: "exact-password",
    });
  });

  it("legacy credential errors remain existence-neutral", () => {
    expect(passwordSignInErrorMessage({ code: "invalid_credentials" })).toBe(
      PASSWORD_SIGN_IN_ERROR_MESSAGE
    );
    expect(passwordSignInErrorMessage({ code: "email_not_confirmed" })).toBe(
      PASSWORD_SIGN_IN_ERROR_MESSAGE
    );
    expect(PASSWORD_SIGN_IN_ERROR_MESSAGE).not.toMatch(/not found|no account/i);
  });
});

describe("Google-only normal-use screens", () => {
  it("render one Google action and no account fields", () => {
    for (const source of [signup(), login()]) {
      expect((source.match(/<GoogleSignInButton \/>/g) ?? []).length).toBe(1);
      expect(source).not.toMatch(
        /type="(email|password|text)"|name="(username|email|password|confirm)"/
      );
      expect(source).not.toMatch(/autoComplete="(username|email|current-password|new-password)"/);
    }
  });

  it("do not call any email/password Supabase method", () => {
    const code = codeOnly(signup() + login());
    expect(code).not.toMatch(
      /signInWithPassword|signInWithOtp|auth\.resend|signUp\(|resetPasswordForEmail|verifyOtp\(|updateUser\(/
    );
    expect(code).toMatch(/buildGoogleOAuthRequest|GoogleSignInButton/);
  });

  it("do not add an email allowlist or domain gate", () => {
    const code = codeOnly(signup() + login());
    expect(code).not.toMatch(/@gmail\.com|@example\.com|allowedDomain/i);
    expect(src("supabase/config.toml")).toMatch(/enable_signup\s*=\s*true/);
  });

  it("retain the existing UUID profile ownership schema untouched", () => {
    expect(profileSchema()).toMatch(
      /id\s+uuid primary key references auth\.users \(id\) on delete cascade/
    );
    expect(profileSchema()).toMatch(
      /username\s+text not null unique check \(char_length\(username\) between 3 and 24\)/
    );
    expect(profileTrigger()).toMatch(/new\.id/);
    expect(profileTrigger()).toMatch(/'user'/);
  });
});
