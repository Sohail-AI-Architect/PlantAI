import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "About PlantAI",
  description:
    "PlantAI helps you identify plants from photos with Pl@ntNet-powered AI and learn practical, human-written care guidance. Learn who we are and how identification works.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About PlantAI",
    description:
      "PlantAI combines AI-assisted plant identification with practical, human-written care guides — and is honest about the limits of both.",
    url: "/about",
  },
};

export default function AboutPage() {
  return (
    <LegalPage
      title="About PlantAI"
      updated="22 November 2026"
      summary="PlantAI is an independent, educational project that helps people identify plants from photos and learn how to care for them — without hype, fake precision, or paid placement in our care advice."
    >
      <h2>Why PlantAI exists</h2>
      <p>
        Most people who buy or inherit a houseplant want two simple answers:
        <em> what is this plant?</em> and <em>how do I keep it alive?</em>{" "}
        Searching for those answers usually means scrolling through forums,
        contradictory care sheets and photo galleries that all look the same.
        PlantAI brings both steps into one place: a photo-based identification,
        followed by plain-language care guidance for watering, light, soil and
        feeding.
      </p>
      <p>
        The project is deliberately small and independent. We publish what we
        can verify, label what is still being built, and avoid presenting an
        algorithm&apos;s guess as a certainty. Plant care is a long learning
        curve, and a good tool should make that curve easier — not pretend it
        does not exist.
      </p>

      <h2>How plant identification works</h2>
      <p>
        When you upload one or more photos, PlantAI sends the images to the{" "}
        <a
          href="https://plantnet.org/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Pl@ntNet
        </a>{" "}
        identification service, a large citizen-science plant database and
        recognition platform. Pl@ntNet compares the visual characteristics of
        your photo with its reference library and returns a ranked list of
        possible species with confidence scores.
      </p>
      <p>
        PlantAI then presents those candidates in a readable format and, where
        our library has a matching published entry, adds a short care summary
        written for humans. We do not invent results: if the service returns no
        confident match, the app says so and suggests a better photo instead of
        guessing.
      </p>
      <p>
        Identification is <strong>probabilistic</strong>. A high score is a
        strong hint, not a guarantee, and closely related species can be
        visually indistinguishable from a single photo. Important decisions —
        especially anything involving edibility, toxicity, pets or children —
        should always be confirmed with a qualified expert or a reliable local
        source.
      </p>

      <h2>Care guides and the plant library</h2>
      <p>
        Our <Link href="/library">plant library</Link> contains reference
        entries with practical guidance on watering, sunlight, soil and
        fertilizer. The content is written and reviewed by the PlantAI team,
        and every entry states clearly when a photo is still a placeholder
        rather than a real species image. We would rather show an honest
        illustration than a mislabelled photograph.
      </p>
      <p>
        The <Link href="/blog">PlantAI blog</Link> covers broader topics:
        common watering mistakes, repotting basics, seasonal care and
        troubleshooting. Articles are educational, not a diagnosis for a
        specific ailing plant.
      </p>

      <h2>Our companion blog</h2>
      <p>
        We also publish longer, SEO-friendly articles on our companion
        publication,{" "}
        <a
          href="https://plantai-garden-guide.blogspot.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          PlantAI Garden Guide
        </a>
        . It is maintained alongside this site and focuses on practical,
        experience-based gardening write-ups. The two properties cross-link so
        readers can move between a quick identification here and a deeper guide
        there.
      </p>

      <h2>Who we are</h2>
      <p>
        PlantAI is owned and created by <strong>Sohail Nawaz</strong>, who
        builds and maintains the site together with a small, independent team
        of plant enthusiasts and web developers. We are not a nursery, a
        botanical institution or a medical provider, and we do not claim
        credentials we do not have. What we do offer is a genuine effort to
        make plant knowledge more accessible, with clear sourcing and honest
        limitations.
      </p>

      <h2>How the project is funded</h2>
      <p>
        PlantAI is free to use. To keep hosting and identification costs
        covered, the site may display advertising through Google AdSense in
        future. Advertising never influences which plants we cover or what our
        care guidance says. See our <Link href="/privacy">Privacy Policy</Link>{" "}
        and <Link href="/cookie-policy">Cookie Policy</Link> for how
        advertising-related data is handled.
      </p>

      <h2>Attribution</h2>
      <p>
        Plant identification is powered by Pl@ntNet. Pl@ntNet is a citizen
        science project led by CIRAD, INRAE, IRD and Inria, with contributions
        from institutions and volunteers around the world. We are grateful for
        their open identification service; any identification errors in the
        PlantAI interface are ours in presentation, not a judgement on the
        underlying reference data.
      </p>

      <h2>Get in touch</h2>
      <p>
        Corrections, questions and feedback are genuinely welcome — especially
        factual corrections to a care guide. Use the{" "}
        <Link href="/contact">contact form</Link> and we will read every
        message.
      </p>
    </LegalPage>
  );
}
