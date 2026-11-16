"use client";

import { useActionState } from "react";
import { submitContact, type ContactResult } from "@/actions/contact";

/*
 * Contact form (FR-CNT-001). Client validation is convenience only — the
 * Server Action re-validates everything server-side (double validation,
 * NFR-S-004). The `website` field is the honeypot: visually and
 * programmatically hidden from humans, expected empty by the action.
 */
export function ContactForm() {
  const [state, formAction, pending] = useActionState<ContactResult | null, FormData>(
    submitContact,
    null
  );

  return (
    <form action={formAction} className="mt-6 space-y-4" noValidate>
      {/* Honeypot — hidden from humans and assistive tech */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input
          type="text"
          id="website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            maxLength={80}
            autoComplete="name"
            className="border-border-muted bg-surface focus:border-brand-600 mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
          />
        </div>
        <div>
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            autoComplete="email"
            className="border-border-muted bg-surface focus:border-brand-600 mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
          />
        </div>
      </div>

      <div>
        <label htmlFor="subject" className="text-sm font-medium">
          Subject <span className="text-foreground-muted">(optional)</span>
        </label>
        <input
          type="text"
          id="subject"
          name="subject"
          maxLength={120}
          className="border-border-muted bg-surface focus:border-brand-600 mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
        />
      </div>

      <div>
        <label htmlFor="message" className="text-sm font-medium">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          minLength={10}
          maxLength={4000}
          className="border-border-muted bg-surface focus:border-brand-600 mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
        />
      </div>

      {state && (
        <p
          role={state.ok ? "status" : "alert"}
          aria-live="polite"
          className={`rounded-lg border px-4 py-3 text-sm ${
            state.ok
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-brand-600 hover:bg-brand-700 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send message"}
      </button>

      <p className="text-foreground-muted text-xs leading-relaxed">
        Your name and email are used only to read and reply to your message.
        They’re stored in the contact inbox and deleted after it’s resolved.
      </p>
    </form>
  );
}
