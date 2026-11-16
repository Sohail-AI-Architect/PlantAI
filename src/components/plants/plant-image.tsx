"use client";

import Image from "next/image";
import { useState } from "react";
import { FALLBACK_PLANT_IMAGE, type PlantImageAsset } from "@/lib/plant-images";

/**
 * PlantImage — consistent, non-distorting plant imagery with a graceful
 * fallback (task §1: "no broken images").
 *
 * - `next/image` with explicit `sizes` + `fill` inside a fixed-aspect frame:
 *   the caller picks the aspect ratio, the photo is always `object-cover`
 *   cropped — never stretched.
 * - If the source fails to load at runtime (404, bad file), the component
 *   swaps to the original PlantAI placeholder illustration — an illustration,
 *   deliberately, so a broken photo can never masquerade as species imagery.
 * - Optional `credit` renders an attribution caption (CC BY-SA requirement is
 *   preserved; DB images carry their own `image_credit` in the DB render path).
 */

interface PlantImageProps {
  asset: PlantImageAsset | null;
  /** Accessible name — falls back to the asset's alt when not provided. */
  alt?: string;
  /** Wrapper aspect ratio (Tailwind arbitrary value, e.g. "aspect-[4/3]"). */
  aspect?: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
  showCredit?: boolean;
}

export function PlantImage({
  asset,
  alt,
  aspect = "aspect-[4/3]",
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  className = "",
  priority = false,
  showCredit = false,
}: PlantImageProps) {
  const [failed, setFailed] = useState(false);
  const resolved =
    failed || !asset
      ? { src: FALLBACK_PLANT_IMAGE, alt: alt ?? "Botanical illustration placeholder" }
      : { src: asset.src, alt: alt ?? asset.alt };

  return (
    <figure className={`${aspect} relative w-full overflow-hidden ${className}`}>
      <Image
        src={resolved.src}
        alt={resolved.alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
        onError={() => setFailed(true)}
      />
      {showCredit && asset && !failed && (
        <figcaption className="bg-surface/85 text-foreground-muted absolute bottom-0 left-0 right-0 px-2 py-1 text-[10px] leading-tight">
          Photo: {asset.credit} ·{" "}
          <a
            href={asset.creditUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            {asset.license}
          </a>{" "}
          via Wikimedia Commons
        </figcaption>
      )}
    </figure>
  );
}
