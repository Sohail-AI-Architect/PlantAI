import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Offline contract tests for the contact Server Action (FR-CNT-001):
 * validation, honeypot swallowing, rate limiting, and the exact insert
 * payload (incl. the salted ip_hash — raw IPs never reach the database
 * unhashed). The Supabase server client and next/headers are module mocks;
 * no real database, no real network.
 */

type ContactResult = import("@/actions/contact").ContactResult;

const testState = vi.hoisted(() => ({ ip: "203.0.113.9" }));

const insertMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: (table: string) => {
      if (table !== "contact_messages") {
        throw new Error(`unexpected table in test: ${table}`);
      }
      return { insert: insertMock };
    },
  }),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": testState.ip }),
}));

/*
 * Fresh module per test: the action's RateLimiter is deliberately
 * module-level singleton state (production behavior), so each test imports
 * a clean instance via vi.resetModules() + dynamic import — mock
 * registrations (vi.mock) still apply after a module-registry reset.
 */
let submitContactUnderTest: typeof import("@/actions/contact").submitContact;

beforeEach(async () => {
  vi.resetModules();
  ({ submitContact: submitContactUnderTest } = await import(
    "@/actions/contact"
  ));
});

function formData(overrides: Record<string, string | undefined> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    website: "",
    name: "Test Person",
    email: "test@example.com",
    subject: "Feedback",
    message: "This is a perfectly reasonable test message.",
    ...overrides,
  };
  for (const [key, value] of Object.entries(base)) {
    if (value !== undefined) fd.set(key, value);
  }
  return fd;
}

function resultOf(promise: Promise<ContactResult>): Promise<ContactResult> {
  return promise;
}

beforeEach(() => {
  insertMock.mockReset();
  insertMock.mockResolvedValue({ error: null });
  testState.ip = "203.0.113.9";
});

describe("submitContactUnderTest — validation", () => {
  it("accepts a valid submission and inserts the exact payload", async () => {
    const result = await resultOf(submitContactUnderTest(null, formData()));
    expect(result.ok).toBe(true);
    expect(insertMock).toHaveBeenCalledTimes(1);
    const payload = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      name: "Test Person",
      email: "test@example.com",
      subject: "Feedback",
      message: "This is a perfectly reasonable test message.",
    });
    expect(typeof payload.ip_hash).toBe("string");
    expect((payload.ip_hash as string).length).toBe(64); // SHA-256 hex
    expect(payload.ip_hash).not.toContain("203.0.113.9"); // raw IP never stored
  });

  it("stores a null subject when the field is empty", async () => {
    await resultOf(submitContactUnderTest(null, formData({ subject: "" })));
    expect(insertMock.mock.calls[0][0]).toMatchObject({ subject: null });
  });

  it.each([
    ["name too short", formData({ name: "A" })],
    ["message too short", formData({ message: "hi" })],
    ["message too long", formData({ message: "x".repeat(4001) })],
    ["invalid email", formData({ email: "not-an-email" })],
    ["subject too long", formData({ subject: "s".repeat(121) })],
  ])("rejects: %s", async (_label, fd) => {
    const result = await resultOf(submitContactUnderTest(null, fd));
    expect(result.ok).toBe(false);
    expect(result.message.length).toBeGreaterThan(0);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("trims surrounding whitespace from inputs", async () => {
    await resultOf(
      submitContactUnderTest(null, formData({ name: "  Test Person  ", message: "  Another reasonable test message.  " }))
    );
    expect(insertMock.mock.calls[0][0]).toMatchObject({
      name: "Test Person",
      message: "Another reasonable test message.",
    });
  });
});

describe("submitContactUnderTest — honeypot", () => {
  it("returns a FAKE success and inserts NOTHING when the honeypot is filled", async () => {
    const result = await resultOf(
      submitContactUnderTest(null, formData({ website: "http://spam.example" }))
    );
    expect(result.ok).toBe(true); // bots see success...
    expect(insertMock).not.toHaveBeenCalled(); // ...but nothing is stored
  });
});

describe("submitContactUnderTest — rate limiting", () => {
  it("failed validation does NOT consume the daily budget", async () => {
    await resultOf(submitContactUnderTest(null, formData({ message: "hi" })));
    const result = await resultOf(submitContactUnderTest(null, formData()));
    expect(result.ok).toBe(true);
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("allows 3 messages per IP per day, then rejects the 4th without inserting", async () => {
    for (let i = 0; i < 3; i++) {
      const result = await resultOf(submitContactUnderTest(null, formData()));
      expect(result.ok).toBe(true);
    }
    expect(insertMock).toHaveBeenCalledTimes(3);

    const fourth = await resultOf(submitContactUnderTest(null, formData()));
    expect(fourth.ok).toBe(false);
    expect(fourth.message).toMatch(/try again tomorrow/i);
    expect(insertMock).toHaveBeenCalledTimes(3); // no 4th insert
  });

  it("a different IP address is limited independently", async () => {
    for (let i = 0; i < 3; i++) {
      await resultOf(submitContactUnderTest(null, formData()));
    }
    testState.ip = "198.51.100.42";
    const result = await resultOf(submitContactUnderTest(null, formData()));
    expect(result.ok).toBe(true);
    expect(insertMock).toHaveBeenCalledTimes(4);
  });
});

describe("submitContactUnderTest — error surfacing", () => {
  it("maps a database failure to a generic safe message (no raw error text)", async () => {
    insertMock.mockResolvedValue({
      error: { code: "42501", message: "row-level security violation boom" },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await resultOf(submitContactUnderTest(null, formData()));
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain("42501");
    expect(result.message).not.toContain("row-level");
    expect(errorSpy).toHaveBeenCalled(); // logged server-side (code only pattern)
    errorSpy.mockRestore();
  });
});

describe("submitContactUnderTest — mock hygiene", () => {
  it("only ever writes to contact_messages", async () => {
    await resultOf(submitContactUnderTest(null, formData()));
    expect(insertMock.mock.calls.length).toBeGreaterThan(0);
  });
});
