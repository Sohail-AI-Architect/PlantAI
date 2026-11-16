"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { RateLimiter } from "@/lib/rate-limit";
import { getIpHashSalt } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Contact form pipeline (FR-CNT-001; DATABASE_SCHEMA.md §3.8;
 * API_DOCUMENTATION.md §"submitContact").
 *
 * Spam resistance, in order:
 *   1. Honeypot: a hidden `website` field that must stay empty. A filled
 *      honeypot returns a FAKE success (silently swallowed, nothing
 *      inserted) — bots see "sent", nothing is stored.
 *   2. Server-side zod validation (same constraints as the DB CHECKs:
 *      name 2–80, subject ≤120, message 10–4000). Failed validation does
 *      NOT consume the daily budget (same principle as the identify route).
 *   3. Rate limit: 3 messages / day / IP-hash (matches the seeded
 *      `contact.rate_limit.per_day = 3` in app_settings). In-memory
 *      per-instance limiter — the documented honest limitation
 *      (SECURITY.md §7); raw IPs are never stored, only SHA-256(ip+salt).
 *   4. Insert via the RLS `p_contact_messages_insert_anyone` policy —
 *      identity-independent, bounded to one insert per call.
 *
 * Errors return as plain { ok:false, message } — raw error strings and the
 * caller's IP never surface to users or logs (only the salted hash exists,
 * in-memory).
 */

export interface ContactResult {
  ok: boolean;
  message: string;
}

const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter your name (at least 2 characters).")
    .max(80, "Name is too long."),
  email: z.string().trim().email("Please enter a valid email address."),
  subject: z
    .string()
    .trim()
    .max(120, "Subject is too long.")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  message: z
    .string()
    .trim()
    .min(10, "Please write at least 10 characters so we can help.")
    .max(4000, "Message is too long (max 4000 characters)."),
});

const CONTACT_DAILY_LIMIT = 3;
const contactLimiter = new RateLimiter();

export async function submitContact(
  _prev: ContactResult | null,
  formData: FormData
): Promise<ContactResult> {
  // 1) Honeypot — silently swallow bot submissions.
  if ((formData.get("website") ?? "").toString().length > 0) {
    return { ok: true, message: "Message sent." };
  }

  // 2) Validation (no budget consumed on failure).
  const parsed = contactSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    subject: formData.get("subject") ?? undefined,
    message: formData.get("message") ?? "",
  });
  if (!parsed.success) {
    const first =
      parsed.error.issues[0]?.message ?? "Please check the form and try again.";
    return { ok: false, message: first };
  }

  // 3) Daily rate limit keyed by the salted IP hash (raw IP never stored).
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for") ?? "";
  const rawIp = forwarded.split(",")[0]?.trim() || "unknown";
  const ipHash = createHash("sha256")
    .update(`${rawIp}:${getIpHashSalt()}`)
    .digest("hex");
  const decision = contactLimiter.consume(`contact:${ipHash}`, CONTACT_DAILY_LIMIT);
  if (!decision.allowed) {
    return {
      ok: false,
      message: "You've sent several messages today — please try again tomorrow.",
    };
  }

  // 4) Insert through RLS (anon insert policy).
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("contact_messages").insert({
    name: parsed.data.name,
    email: parsed.data.email,
    subject: parsed.data.subject,
    message: parsed.data.message,
    ip_hash: ipHash,
  });

  if (error) {
    console.error(`[submitContact] insert failed (${error.code})`);
    return {
      ok: false,
      message: "Message couldn’t be sent — please try again shortly.",
    };
  }

  return {
    ok: true,
    message: "Message sent — thank you! We read every message.",
  };
}
