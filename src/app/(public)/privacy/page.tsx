import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How PlantAI collects, uses and protects your data: account details, plant photos sent to Pl@ntNet, cookies, and Google AdSense advertising disclosures.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy | PlantAI",
    description:
      "What PlantAI collects, why, how long it is kept, and which third parties (Supabase, Netlify, Pl@ntNet, Google) are involved.",
    url: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="22 November 2026"
      summary="This policy explains what information PlantAI collects, how it is used, who it is shared with, and the choices available to you. It applies to the PlantAI website and its plant identification, library, blog and account features."
    >
      <h2>1. Who we are</h2>
      <p>
        PlantAI (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is an
        independent educational website that provides AI-assisted plant
        identification and plant care information. This policy applies to this
        website and its features. It does not apply to the separate companion
        blog at{" "}
        <a
          href="https://plantai-garden-guide.blogspot.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          plantai-garden-guide.blogspot.com
        </a>
        , which is operated on Blogger and governed by Google&apos;s own
        policies.
      </p>

      <h2>2. Information you provide to us</h2>
      <h3>Account information</h3>
      <p>
        If you create an account, we collect the email address you register
        with and authentication data managed by our authentication provider,
        Supabase. Passwords are handled by Supabase&apos;s authentication
        system; we do not store your plain-text password. You may also choose
        to sign in through the password-reset and email-link flows, which use
        your email address to send you a one-time link.
      </p>

      <h3>Plant photos and identification requests</h3>
      <p>
        When you use the identification tool, the photos you upload are
        processed to produce a species suggestion. To do this, the images are
        transmitted to the third-party{" "}
        <a
          href="https://plantnet.org/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Pl@ntNet
        </a>{" "}
        identification service. PlantAI does not currently store your uploaded
        image files in a public gallery or use them for advertising.
      </p>
      <p>
        To keep the service fast and prevent duplicate work, we compute a
        one-way cryptographic hash of the uploaded image data and may keep that
        hash together with the returned species result. A hash cannot be
        reversed into the original photo. If you provide an optional location
        hint, it is used only to improve the identification request; precise
        GPS coordinates are not stored in our database and are not used for
        advertising.
      </p>
      <p>
        Pl@ntNet processes the images you submit under its own terms and
        privacy policy. We encourage you to review Pl@ntNet&apos;s policy
        before uploading photos that contain people, private property or other
        sensitive details.
      </p>

      <h3>Saved plants, contact messages and other content</h3>
      <p>
        If you save a plant to your account, we store the reference to that
        plant and any note or label you add. If you send a message through the
        contact form, we store the name, email address and message content you
        provide so we can respond and keep a record of corrections or reports.
      </p>

      <h2>3. Information collected automatically</h2>
      <p>
        Like most websites, our hosting infrastructure processes standard
        technical information needed to deliver pages securely — for example
        the requested URL, browser type, timestamps and a truncated network
        address. For rate limiting, we derive a salted one-way hash of the
        requesting IP address; we do not keep the raw IP address in that
        counter, and the salt is a server-side secret.
      </p>
      <p>
        We do not currently run a third-party analytics product on PlantAI. If
        we add one, we will update this policy and, where required, ask for
        consent before it loads.
      </p>

      <h2>4. Cookies and similar technologies</h2>
      <p>
        We use a small number of cookies that are necessary for the site to
        work, primarily to keep you signed in and to protect authenticated
        requests. Advertising partners, when advertising is enabled, may also
        set cookies as described below. Our{" "}
        <Link href="/cookie-policy">Cookie Policy</Link> lists the categories,
        purposes and available controls in more detail.
      </p>

      <h2>5. Advertising and Google AdSense</h2>
      <p>
        PlantAI may display advertising served by Google AdSense (publisher ID{" "}
        <strong>ca-pub-1562565174804877</strong>). Where advertising is
        enabled:
      </p>
      <ul>
        <li>
          Third-party vendors, including Google, use cookies to serve ads based
          on your prior visits to this and other websites.
        </li>
        <li>
          Google&apos;s use of advertising cookies enables it and its partners
          to serve ads to you based on your visit to our site and/or other
          sites on the internet.
        </li>
        <li>
          You may opt out of personalised advertising by visiting{" "}
          <a
            href="https://www.google.com/settings/ads"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Ads Settings
          </a>
          . You can also opt out of some third-party vendors&apos; use of
          cookies for personalised advertising at{" "}
          <a
            href="https://www.aboutads.info/choices/"
            target="_blank"
            rel="noopener noreferrer"
          >
            aboutads.info/choices
          </a>
          .
        </li>
        <li>
          Where required by law (for example in the EEA, UK or Switzerland), we
          will ask for consent before using advertising cookies or serving
          personalised ads, and you can change or withdraw that consent at any
          time.
        </li>
      </ul>
      <p>
        We do not sell your personal information, and we do not share your
        account email address or contact messages with advertisers.
      </p>

      <h2>6. How we use information</h2>
      <ul>
        <li>To provide plant identification and return results to you.</li>
        <li>To create and secure your account and keep you signed in.</li>
        <li>To save the plants and notes you choose to keep.</li>
        <li>To respond to contact messages and correct factual errors.</li>
        <li>
          To protect the service against abuse, including rate limiting,
          duplicate-request caching and security monitoring.
        </li>
        <li>
          To measure aggregate usage and improve content and features (only
          where analytics or advertising is enabled and permitted).
        </li>
        <li>To comply with legal obligations and enforce our Terms.</li>
      </ul>

      <h2>7. Legal bases (where applicable)</h2>
      <p>
        Where data protection law requires a legal basis, we rely on: performance
        of a contract or steps you ask us to take (providing the account and
        identification features); our legitimate interests (keeping the service
        secure, preventing abuse and improving the site); your consent (where we
        ask for it, such as non-essential cookies or personalised advertising);
        and compliance with legal obligations.
      </p>

      <h2>8. Service providers and sharing</h2>
      <p>
        We share limited data with providers that help us operate the site. They
        are required to protect it and to use it only for the services they
        provide to us:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — database, authentication and storage
          infrastructure.
        </li>
        <li>
          <strong>Netlify</strong> — website hosting and content delivery.
        </li>
        <li>
          <strong>Pl@ntNet</strong> — plant image recognition. Images you submit
          are sent to Pl@ntNet for processing.
        </li>
        <li>
          <strong>Google</strong> — advertising and, if enabled, consent
          management and analytics.
        </li>
      </ul>
      <p>
        We may also disclose information if required by law, to protect our
        rights or safety, or in connection with a reorganisation of the project.
        We do not sell personal information.
      </p>

      <h2>9. International transfers</h2>
      <p>
        Our providers may process data in countries other than your own. Where
        required, we rely on appropriate safeguards such as standard
        contractual clauses offered by those providers.
      </p>

      <h2>10. How long we keep information</h2>
      <p>
        Account data is kept while your account exists. Saved plants and notes
        remain until you delete them or your account. Contact messages are kept
        for as long as needed to handle the request and maintain a record of
        corrections, after which they are deleted or anonymised. Rate-limit
        counters and duplicate-identification caches are short-lived and expire
        automatically. Server logs are retained only as long as needed for
        security and troubleshooting.
      </p>

      <h2>11. Security</h2>
      <p>
        We use industry-standard measures including encrypted transport
        (HTTPS), row-level security in our database, server-only handling of
        privileged credentials and security headers. No method of transmission
        or storage is completely secure, so we cannot guarantee absolute
        security, but we work to limit what is collected and who can access it.
      </p>

      <h2>12. Your rights and choices</h2>
      <p>
        Depending on where you live, you may have the right to access, correct,
        delete, restrict or object to the processing of your personal data, to
        receive a portable copy, and to withdraw consent at any time. You can:
      </p>
      <ul>
        <li>Update your account email or sign out from the account page.</li>
        <li>Delete saved plants individually from your saved-plants list.</li>
        <li>
          Request account deletion or a copy of your data through the{" "}
          <Link href="/contact">contact form</Link>.
        </li>
        <li>
          Manage advertising and cookie preferences through the controls in our{" "}
          <Link href="/cookie-policy">Cookie Policy</Link> and your browser.
        </li>
      </ul>
      <p>
        You also have the right to complain to your local data protection
        authority. We will respond to verified requests within the time required
        by applicable law.
      </p>

      <h2>13. Children</h2>
      <p>
        PlantAI is not directed at children under 13 (or the minimum age in your
        country), and we do not knowingly collect personal information from
        them. If you believe a child has provided us with personal data, please
        contact us and we will delete it.
      </p>

      <h2>14. Changes to this policy</h2>
      <p>
        We may update this policy as the service or the law changes. The
        &quot;Last updated&quot; date at the top reflects the current version.
        Material changes will be announced on the site where appropriate.
      </p>

      <h2>15. Contact</h2>
      <p>
        For privacy questions or requests, use the{" "}
        <Link href="/contact">contact form</Link>. Please include enough detail
        for us to identify your account or request without sending sensitive
        information such as passwords.
      </p>
    </LegalPage>
  );
}
