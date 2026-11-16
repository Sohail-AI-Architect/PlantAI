"use client";

import { useState } from "react";
import Link from "next/link";
import type { IdentifySuccessPayload, SpeciesCandidate, CareSummary } from "@/lib/plantnet/types";
import { MockDemoBanner } from "@/components/identify/mock-demo-banner";
import { PlanteNetAttribution } from "@/components/identify/attribution";
import { savePlant } from "@/actions/saved-plants";

/**
 * Results view (roadmap 2.6; UI_UX_DESIGN.md §6.3): identity cards, honest
 * confidence bars, care summary from OUR library only (canonical #6),
 * mock transparency banner, save-plant action with graceful auth gating.
 */

export type IdentifyPayload = IdentifySuccessPayload;

const CARE_META: { key: keyof CareSummary; label: string; icon: string }[] = [
  { key: "watering", label: "Watering", icon: "💧" },
  { key: "sunlight", label: "Sunlight", icon: "☀️" },
  { key: "soil", label: "Soil", icon: "🪱" },
  { key: "fertilizer", label: "Fertilizer", icon: "🌱" },
];

function confidenceColor(score: number): string {
  if (score >= 0.7) return "bg-success";
  if (score >= 0.35) return "bg-warning";
  return "bg-error";
}

function IdentityCard({ species }: { species: SpeciesCandidate }) {
  const percent = Math.round(species.score * 100);
  const isMock = species.sources.includes("mock");
  return (
    <li className="border-border-muted bg-surface rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold italic">{species.scientificName}</h3>
          <p className="text-foreground-muted mt-0.5 text-sm">
            {species.commonNames.length > 0
              ? species.commonNames.join(", ")
              : "No common name on record"}
          </p>
          {(species.family || species.genus) && (
            <p className="text-foreground-muted mt-0.5 text-xs">
              {[species.family, species.genus].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <span
          className={`text-foreground-muted border-border-muted rounded-full border px-2 py-0.5 text-xs ${
            isMock ? "" : ""
          }`}
        >
          #{species.rank}
        </span>
      </div>

      <div className="mt-3">
        <div className="text-foreground-muted flex items-center justify-between text-xs">
          <span>
            Confidence: {percent}%{isMock ? " (demo data)" : ""}
          </span>
          <span>{species.confidenceBand}</span>
        </div>
        <div
          role="img"
          aria-label={`Confidence ${percent} percent`}
          className="bg-surface-muted mt-1 h-2 w-full overflow-hidden rounded-full"
        >
          <div
            className={`h-full rounded-full ${confidenceColor(species.score)}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </li>
  );
}

function CareGrid({ care }: { care: CareSummary }) {
  return (
    <section aria-labelledby="care-summary-heading">
      <h2 id="care-summary-heading" className="text-base font-semibold">
        Care summary — from the PlantAI library
      </h2>
      <p className="text-foreground-muted mt-0.5 text-xs">
        Written by our editors from published care sources — not AI output.
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {CARE_META.map(({ key, label, icon }) => (
          <div key={key} className="border-border-muted bg-surface rounded-lg border p-3">
            <dt className="text-sm font-semibold">
              <span aria-hidden="true">{icon}</span> {label}
            </dt>
            <dd className="text-foreground-muted mt-1 text-xs leading-relaxed">
              {care[key] as string}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SavePlantAction({
  plantLibraryId,
  plantLibrarySlug,
  isAuthenticated,
}: {
  plantLibraryId?: string;
  plantLibrarySlug: string;
  isAuthenticated: boolean;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isAuthenticated) {
    return (
      <p className="text-sm">
        <Link
          href="/login?next=%2Fidentify"
          className="text-brand-700 hover:text-brand-800 font-medium underline"
        >
          Sign in
        </Link>{" "}
        to save this plant to your collection.
      </p>
    );
  }

  if (!plantLibraryId) {
    return (
      <p className="text-foreground-muted text-sm">
        Saving will be available once this species has a full library profile.
      </p>
    );
  }

  async function handleSave() {
    setBusy(true);
    setStatus(null);
    const result = await savePlant(plantLibraryId!);
    setStatus(result.message);
    setBusy(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleSave}
        disabled={busy}
        className="bg-brand-600 hover:bg-brand-700 rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save plant"}
      </button>
      {status && (
        <p role="status" aria-live="polite" className="text-foreground-muted mt-1 text-xs">
          {status}{" "}
          <Link href="/saved-plants" className="underline hover:text-foreground">
            View saved plants
          </Link>
        </p>
      )}
      <p className="text-foreground-muted mt-1 text-xs">
        Full profile:{" "}
        <Link href={`/plant/${plantLibrarySlug}`} className="underline hover:text-foreground">
          Open plant detail →
        </Link>
      </p>
    </div>
  );
}

export function IdentifyResults({
  payload,
  isAuthenticated,
  onIdentifyAnother,
}: {
  payload: IdentifyPayload;
  isAuthenticated: boolean;
  onIdentifyAnother: () => void;
}) {
  const top = payload.topResult.species.slice(0, 3);
  const best = top[0];

  return (
    <div className="space-y-6" aria-live="polite">
      {payload.mode === "mock" && <MockDemoBanner />}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">Top matches</h2>
        <button
          type="button"
          onClick={onIdentifyAnother}
          className="border-border-muted hover:bg-surface rounded-md border px-3 py-1.5 text-sm font-medium"
        >
          Identify another
        </button>
      </div>

      <ul className="space-y-3">
        {top.map((species) => (
          <IdentityCard key={species.scientificName} species={species} />
        ))}
      </ul>

      {payload.careSummary ? (
        <CareGrid care={payload.careSummary} />
      ) : (
        <p className="text-foreground-muted border-border-muted bg-surface-muted rounded-lg border px-4 py-3 text-sm">
          We&apos;re still writing the full care guide for this species —
          structured identity fields above, or browse{" "}
          <Link href="/library" className="underline hover:text-foreground">
            the library
          </Link>
          .
        </p>
      )}

      {best && (
        <SavePlantAction
          plantLibraryId={payload.careSummary?.plantLibraryId}
          plantLibrarySlug={payload.careSummary?.plantLibrarySlug ?? ""}
          isAuthenticated={isAuthenticated}
        />
      )}

      <p className="text-foreground-muted text-xs leading-relaxed">
        Identification is AI-assisted and may be incorrect. This is not a
        disease diagnosis. Many common houseplants are toxic to pets — always
        check a plant&apos;s profile and keep new plants out of reach of pets
        and children until you know it is safe.{" "}
        <Link href="/about" className="underline hover:text-foreground">
          How this works
        </Link>
      </p>
      <PlanteNetAttribution />
    </div>
  );
}
