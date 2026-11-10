import type { Metadata } from "next";
import { RouteStub } from "@/components/layout/route-stub";

export const metadata: Metadata = { title: "Sign in" };

/*
 * /login — canonical route stub. Supabase Auth (email/password + magic
 * link) flows ship in Phase 2 (P2-07).
 */
export default function LoginPage() {
  return (
    <RouteStub
      title="Sign in"
      phase="Phase 2"
      description="Email/password and magic-link sign-in on Supabase Auth, with a live account for saving plants and (later) care reminders."
    />
  );
}
