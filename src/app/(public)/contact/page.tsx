import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Questions, feedback or a plant-care correction? Send the PlantAI team a message — every message is read.",
  alternates: { canonical: "/contact" },
};

/*
 * /contact — completed MVP slice (FR-CNT-001): form → `submitContact`
 * Server Action → contact_messages (honeypot + server validation +
 * 3/day per-IP rate limit). No third-party form service; messages land in
 * the project's own database under RLS.
 */
export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Contact</h1>
      <p className="text-foreground-muted mt-2 text-sm leading-relaxed">
        Questions about a plant, a correction for a guide, feedback, or a bug
        report — send it here. Please note we can’t diagnose sick plants from
        photos; the{" "}
        <a href="/identify" className="underline hover:text-foreground">
          identify tool
        </a>{" "}
        is for species identification only.
      </p>
      <ContactForm />
    </div>
  );
}
