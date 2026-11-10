import type { Metadata } from "next";
import { RouteStub } from "@/components/layout/route-stub";

export const metadata: Metadata = { title: "Contact" };

/*
 * /contact — canonical route stub. Form → contact_messages (with rate
 * limiting + honeypot) ships in Phase 3 (P3-05).
 */
export default function ContactPage() {
  return (
    <RouteStub
      title="Contact"
      phase="Phase 3"
      description="A contact form delivered through a spam-resistant pipeline (rate-limited, validated server-side). Messages reach the team directly — no third-party service required."
    />
  );
}
