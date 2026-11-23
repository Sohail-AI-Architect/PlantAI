import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "A clear inventory of the cookies PlantAI uses: essential sign-in cookies, any analytics, and Google AdSense advertising cookies — plus how to control them.",
  alternates: { canonical: "/cookie-policy" },
  openGraph: {
    title: "Cookie Policy | PlantAI",
    description:
      "Which cookies PlantAI sets, why, how long they last, and how to manage essential, analytics and advertising cookies.",
    url: "/cookie-policy",
  },
};

export default function CookiePolicyPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      updated="22 November 2026"
      summary="This page explains what cookies and similar technologies PlantAI uses, why we use them, and how you can control them. It should be read together with our Privacy Policy."
    >
      <h2>1. What are cookies?</h2>
      <p>
        Cookies are small text files that a website stores in your browser. They
        allow a site to remember information between page loads — for example,
        that you are signed in. Similar technologies such as local storage and
        pixels work in comparable ways, and we refer to them collectively as
        &quot;cookies&quot; in this policy.
      </p>

      <h2>2. Essential cookies</h2>
      <p>
        These cookies are required for the site to function and cannot be
        switched off through our interface. They are set when you sign in or use
        an authenticated feature.
      </p>
      <table>
        <thead>
          <tr>
            <th>Cookie</th>
            <th>Purpose</th>
            <th>Typical duration</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>sb-&lt;project-ref&gt;-auth-token</code> (and related
              chunked variants)
            </td>
            <td>
              Stores your Supabase authentication session so you stay signed in
              and authenticated requests can be verified.
            </td>
            <td>Session to a few weeks, depending on the sign-in flow</td>
          </tr>
          <tr>
            <td>
              <code>sb-&lt;project-ref&gt;-auth-token-code-verifier</code>
            </td>
            <td>
              Temporary PKCE verifier used during email-link and password-reset
              sign-in flows.
            </td>
            <td>Short-lived (until the flow completes or expires)</td>
          </tr>
        </tbody>
      </table>
      <p>
        Because these cookies are strictly necessary to provide a feature you
        request (staying signed in), they do not require consent under most
        privacy laws. Blocking them will prevent sign-in and account features
        from working.
      </p>

      <h2>3. Preference cookies</h2>
      <p>
        We do not currently use cookies to remember optional display
        preferences. If we add any in future, they will be listed here and, where
        required, made opt-in.
      </p>

      <h2>4. Analytics cookies</h2>
      <p>
        PlantAI does not currently run a third-party analytics product. We may
        introduce privacy-respecting analytics in future to understand which
        pages and guides are useful. If we do, this policy will be updated and
        any non-essential analytics cookies will load only after consent where
        the law requires it.
      </p>

      <h2>5. Advertising cookies (Google AdSense)</h2>
      <p>
        PlantAI may display advertising served by Google AdSense (publisher ID{" "}
        <strong>ca-pub-1562565174804877</strong>). When advertising is enabled,
        Google and its partners may set cookies or use similar technologies to:
      </p>
      <ul>
        <li>serve ads, including limiting how often you see the same ad;</li>
        <li>
          measure ad performance and detect invalid activity or fraud; and
        </li>
        <li>
          personalise ads based on your prior visits to this and other websites,
          where you have consented or where permitted by law.
        </li>
      </ul>
      <p>
        Common Google advertising cookies include <code>IDE</code>,{" "}
        <code>test_cookie</code>, <code>__gads</code> and <code>__gpi</code>,
        though the exact set can change. These cookies are set by Google domains,
        not by PlantAI, and their use is governed by Google&apos;s policies.
      </p>
      <p>
        Where required (for example in the EEA, UK or Switzerland), we will show
        a consent prompt before non-essential advertising cookies are used, and
        you will be able to accept, reject or change your choices. Declining
        personalised advertising does not necessarily remove ads; it may make
        them less relevant.
      </p>

      <h2>6. Third-party cookies and embedded content</h2>
      <p>
        Links to external sites — including our companion blog on Blogger,
        Pl@ntNet and advertisers — are ordinary links. This site does not embed
        third-party videos, maps or social widgets that would set cookies
        without your interaction. If that changes, this policy will be updated.
      </p>

      <h2>7. How to manage cookies</h2>
      <ul>
        <li>
          <strong>Browser settings.</strong> Most browsers let you view, delete
          and block cookies. The help section of your browser explains how.
          Blocking all cookies may break sign-in and other essential features.
        </li>
        <li>
          <strong>Google Ads Settings.</strong> Opt out of personalised
          advertising at{" "}
          <a
            href="https://www.google.com/settings/ads"
            target="_blank"
            rel="noopener noreferrer"
          >
            google.com/settings/ads
          </a>
          .
        </li>
        <li>
          <strong>Industry opt-outs.</strong> Visit{" "}
          <a
            href="https://www.aboutads.info/choices/"
            target="_blank"
            rel="noopener noreferrer"
          >
            aboutads.info/choices
          </a>{" "}
          or{" "}
          <a
            href="https://www.youronlinechoices.eu/"
            target="_blank"
            rel="noopener noreferrer"
          >
            youronlinechoices.eu
          </a>{" "}
          (EU) to manage participating vendors.
        </li>
        <li>
          <strong>Consent tools.</strong> When a consent prompt is shown, use it
          to change your advertising choices at any time.
        </li>
      </ul>

      <h2>8. Do Not Track and global signals</h2>
      <p>
        Browser &quot;Do Not Track&quot; signals are not consistently
        interpreted across the industry. Where required by applicable law, we
        honour recognised opt-out preference signals for non-essential cookies
        through our consent mechanism.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We will update this page when our cookie use changes. The &quot;Last
        updated&quot; date at the top shows the current version.
      </p>

      <h2>10. More information</h2>
      <p>
        For how we handle personal data more broadly, see our{" "}
        <Link href="/privacy">Privacy Policy</Link>. For questions about
        cookies, use the <Link href="/contact">contact form</Link>.
      </p>
    </LegalPage>
  );
}
