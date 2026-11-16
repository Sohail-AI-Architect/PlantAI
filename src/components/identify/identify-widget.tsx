"use client";

import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { IdentifyResults, type IdentifyPayload } from "@/components/identify/identify-results";
import { PlantCamera } from "@/components/identify/camera/plant-camera";
import {
  DEFAULT_ORGAN,
  ORGANS,
  ORGAN_LABELS,
  type Organ,
} from "@/lib/plantnet/organs";

/**
 * /identify upload widget (roadmap 2.1; UI_UX_DESIGN.md §6.2).
 *
 * Client-side guards BEFORE submit (each failed API request can consume
 * upstream credit on the live provider later, docs/VERIFIED_FACTS.md):
 * JPEG/PNG only, ≤ 10 MB each, 1–3 images — matching the server contract
 * exactly (client checks are UX; the server re-validates everything).
 *
 * Two primary photo sources (task §2):
 *   A. "Take a photo" — real live camera via the PlantCamera component
 *      (getUserMedia, environment-first); the captured File enters the
 *      SAME draft list as uploads — one pipeline, no duplication.
 *   B. "Upload from device" — file picker. `accept` is deliberately limited
 *      to image/jpeg,image/png (the server's verified magic-byte contract)
 *      so mobile galleries don't offer formats the pipeline must reject
 *      with an error; the honest choice over the broader `image/*` hint.
 *
 * Honest progress states per spec: "Analyzing your photos…" with a calm
 * pulse — no fake progress gauge. Quota-reached state keeps the draft.
 */

const ACCEPT = ["image/jpeg", "image/png"] as const;
const MAX_IMAGES = 3;
const MAX_BYTES = 10 * 1024 * 1024;

interface DraftImage {
  file: File;
  previewUrl: string;
}

export interface IdentifyWidgetProps {
  /** Verified session state streamed from the server page. */
  isAuthenticated: boolean;
}

export function IdentifyWidget({ isAuthenticated }: IdentifyWidgetProps) {
  const [images, setImages] = useState<DraftImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<IdentifyPayload | null>(null);
  /** Optional organ hint — Stage C: shared canonical enum (leaf/flower/fruit/bark/auto). */
  const [organ, setOrgan] = useState<Organ>(DEFAULT_ORGAN);
  const [cameraOpen, setCameraOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const clearDrafts = useCallback(() => {
    setImages((current) => {
      for (const img of current) URL.revokeObjectURL(img.previewUrl);
      return [];
    });
  }, []);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      setError(null);
      const accepted: DraftImage[] = [];
      for (const file of Array.from(incoming)) {
        if (images.length + accepted.length >= MAX_IMAGES) {
          setError(`Up to ${MAX_IMAGES} photos — the same individual plant, different angles.`);
          break;
        }
        if (!(ACCEPT as readonly string[]).includes(file.type)) {
          setError("Only JPEG or PNG photos are supported.");
          continue;
        }
        if (file.size > MAX_BYTES) {
          setError("One of the photos is over 10 MB — try a smaller version.");
          continue;
        }
        accepted.push({ file, previewUrl: URL.createObjectURL(file) });
      }
      if (accepted.length > 0) {
        setImages((current) => [...current, ...accepted].slice(0, MAX_IMAGES));
      }
    },
    [images.length]
  );

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = ""; // allow re-selecting the same file
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (event.dataTransfer?.files.length) addFiles(event.dataTransfer.files);
  }

  function removeImage(index: number) {
    setImages((current) => {
      URL.revokeObjectURL(current[index].previewUrl);
      return current.filter((_, i) => i !== index);
    });
  }

  async function handleIdentify() {
    setError(null);
    if (images.length === 0) {
      setError("Add at least one photo of the plant.");
      return;
    }
    setAnalyzing(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("organ", organ);
      for (const img of images) {
        form.append("images[]", img.file, img.file.name);
      }
      const response = await fetch("/api/identify", { method: "POST", body: form });

      if (response.status === 429) {
        setError(
          "Today's identification limit has been reached. It resets at midnight UTC. Your photos are safe here — try again in a few hours."
        );
        return;
      }
      if (response.status === 413) {
        setError("The photos are too large. Each photo must be 10 MB or less.");
        return;
      }
      if (!response.ok) {
        // Contract: { success:false, error:{ code, message } } — show the
        // server's user-facing message; fall back to a generic line.
        let serverMessage = "Something went wrong — please try again.";
        try {
          const payload = (await response.json()) as {
            error?: { message?: string };
          };
          if (payload.error?.message) serverMessage = payload.error.message;
        } catch {
          // non-JSON error body — keep the generic message
        }
        setError(serverMessage);
        return;
      }

      const payload = (await response.json()) as IdentifyPayload;
      setResult(payload);
      clearDrafts();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Network problem — check your connection and try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  function handleReset() {
    setResult(null);
    clearDrafts();
  }

  if (result) {
    return (
      <IdentifyResults
        payload={result}
        isAuthenticated={isAuthenticated}
        onIdentifyAnother={handleReset}
      />
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="text-error bg-error/10 rounded-md px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {analyzing ? (
        <div
          role="status"
          aria-live="polite"
          className="border-border-muted flex flex-col items-center rounded-xl border border-dashed px-6 py-16"
        >
          <span
            aria-hidden="true"
            className="bg-brand-100 animate-pulse flex h-16 w-16 items-center justify-center rounded-full text-3xl"
          >
            🌿
          </span>
          <p className="mt-4 text-sm font-medium">Analyzing your photos…</p>
          <p className="text-foreground-muted mt-1 text-xs">
            This usually takes a few seconds.
          </p>
        </div>
      ) : (
        <>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-brand-300 bg-surface-muted rounded-xl border-2 border-dashed px-6 py-10 text-center"
          >
            <p className="text-sm font-medium">Photos of the same plant, up to 3.</p>
            <p className="text-foreground-muted mt-1 text-xs">
              Best organs: leaf, flower, fruit. JPEG or PNG, up to 10 MB each.
              The camera preview stays fully on your device — photos upload
              only when you identify.
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              {/* Option A — real live camera (PlantCamera handles permission
                  request ONLY after this explicit user action, §6). */}
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                className="bg-brand-600 hover:bg-brand-700 rounded-md px-5 py-2.5 text-sm font-semibold text-white transition-colors"
              >
                <span aria-hidden="true" className="mr-1.5">📷</span>
                Take a photo
              </button>
              {/* Option B — gallery / device upload */}
              <label className="border-border-muted hover:bg-surface cursor-pointer rounded-md border px-5 py-2.5 text-sm font-medium transition-colors">
                Upload from device
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  multiple
                  className="sr-only"
                  aria-label="Choose plant photos"
                  onChange={handleInputChange}
                />
              </label>
            </div>
          </div>

          {images.length > 0 && (
            <div>
              <p className="text-foreground-muted text-xs font-medium uppercase tracking-wide">
                {images.length} of {MAX_IMAGES} photos
              </p>
              <ul className="mt-2 flex flex-wrap gap-3">
                {images.map((img, index) => (
                  <li key={img.previewUrl} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local object URLs, not remote images */}
                    <img
                      src={img.previewUrl}
                      alt={`Selected plant photo ${index + 1}`}
                      className="border-border-muted h-24 w-24 rounded-lg border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      aria-label={`Remove photo ${index + 1}`}
                      className="bg-surface border-border-muted text-error absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold shadow-sm"
                    >
                      ✕
                    </button>
                  </li>
                ))}
                {images.length < MAX_IMAGES && (
                  <li>
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="border-border-muted text-foreground-muted hover:bg-surface flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed text-sm font-medium"
                    >
                      Add another
                    </button>
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Stage C: optional organ hint (shared canonical enum — only the
              verified upstream values leaf/flower/fruit/bark/auto appear;
              the invalid lateral/root options are gone). Auto-detection
              remains the default. */}
          <div className="flex items-end justify-between gap-3">
            <div className="w-full max-w-xs">
              <label
                htmlFor="organ-select"
                className="text-foreground-muted block text-xs font-medium"
              >
                Which plant part is in the photo? (optional)
              </label>
              <select
                id="organ-select"
                value={organ}
                onChange={(e) => setOrgan(e.target.value as Organ)}
                className="border-border-muted bg-surface mt-1 w-full rounded-md border px-3 py-2 text-sm"
              >
                {ORGANS.map((value) => (
                  <option key={value} value={value}>
                    {ORGAN_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleIdentify}
            disabled={images.length === 0}
            className="bg-brand-600 hover:bg-brand-700 w-full rounded-md px-4 py-3 text-base font-semibold text-white transition-colors disabled:opacity-60"
          >
            Identify plant
          </button>

          <p className="text-foreground-muted text-xs">
            Your photos are sent to our identification service to find the
            species.{" "}
            <a href="/privacy" className="underline hover:text-foreground">
              Privacy
            </a>
          </p>
        </>
      )}

      {/* Live camera capture — the captured File enters the SAME draft list
          (addFiles) as gallery uploads: one pipeline, one preview UI, one
          identification submit path. The camera is only ever opened by the
          explicit "Take a photo" action (never automatic). */}
      <PlantCamera
        open={cameraOpen && !analyzing}
        onConfirm={(file) => addFiles([file])}
        onClose={(reason) => {
          setCameraOpen(false);
          if (reason === "confirm") {
            // The confirmed capture replaced the previous draft photos is
            // NOT automatic — it is ADDED like an upload (user can remove
            // any draft). Scroll down so the new preview is visible.
            requestAnimationFrame(() =>
              window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
            );
          }
        }}
      />
    </div>
  );
}
