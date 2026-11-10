import type { Metadata } from "next";
import { RouteStub } from "@/components/layout/route-stub";

export const metadata: Metadata = { title: "Sign up" };

/*
 * /signup — canonical route stub. Supabase Auth signup (with username
 * metadata feeding handle_new_user) ships in Phase 2 (P2-07).
 */
export default function SignupPage() {
  return (
    <RouteStub
      title="Create an account"
      phase="Phase 2"
      description="Email sign-up with a public username, email confirmation, and an account you can delete at any time from /account (data erasure flow)."
    />
  );
}
