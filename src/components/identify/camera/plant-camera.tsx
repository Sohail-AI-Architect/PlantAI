"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * PlantCamera — real live camera capture for the identify flow (task §2–§6).
 *
 * Privacy & lifecycle guarantees (mandatory §6):
 * - The camera is requested ONLY when the user explicitly opens this
 *   component (never on page load, never in the background).
 * - Single photo capture only — never video, never background capture.
 * - Nothing is uploaded before the user confirms "Use this photo" (the
 *   capture result is handed to the parent, which shows it in its own
 *   preview; the actual identification POST happens in the existing
 *   submit path — no second pipeline).
 * - Every MediaStream track is stopped when the modal closes, a photo is
 *   confirmed, an error tears the UI down, or the component unmounts. A
 *   `track.onended` listener also recovers from external stops.
 * - Object URLs for the captured preview are revoked on retake/close/unmount.
 * - No captured images, no image contents, and no device details are logged.
 *
 * Error taxonomy (§5): permission denied, no camera, camera busy,
 * unsupported browser, insecure context, unexpected stream stop, invalid
 * capture — each maps to an honest, user-facing message and always preserves
 * the alternative gallery-upload route (the parent keeps its upload button).
 */

export type CameraCloseReason = "close" | "confirm";

interface PlantCameraProps {
  open: boolean;
  /** Called ONLY after the user confirms "Use this photo". */
  onConfirm: (file: File) => void;
  /** Any dismissal (close, cancel, or confirm). Stream is stopped before. */
  onClose: (reason: CameraCloseReason) => void;
}

type CameraPhase = "requesting" | "live" | "captured" | "error";

/** DOMException.name → honest user message (no technical dumps). Exported for the offline test suite. */
export function cameraErrorMessage(error: DOMException | undefined): string {
  switch (error?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Please allow camera access to take a plant photo. You can also upload a photo from your device instead.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No camera was found. You can upload a photo instead.";
    case "NotReadableError":
    case "TrackStartError":
      return "The camera seems to be in use by another app. Close it and try again, or upload a photo instead.";
    case "OverconstrainedError":
      return "The selected camera is not available. Try switching cameras, or upload a photo instead.";
    case "SecurityError":
      return "Camera access is unavailable in this browser context.";
    default:
      return "Camera access is unavailable in this browser. You can upload a photo instead.";
  }
}

export function PlantCamera({ open, onConfirm, onClose }: PlantCameraProps) {
  const [phase, setPhase] = useState<CameraPhase>("requesting");
  const [message, setMessage] = useState<string | null>(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const deviceIdRef = useRef<string | undefined>(undefined);
  const modeRef = useRef<"environment" | "device">("environment");
  const capturedFileRef = useRef<File | null>(null);

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  }, []);

  const startStream = useCallback(async () => {
    // 1) Environment checks FIRST (§5: insecure HTTP + unsupported browsers).
    if (typeof window === "undefined") return;
    if (!window.isSecureContext) {
      setMessage(
        "Camera access is unavailable on insecure connections. You can upload a photo instead."
      );
      setPhase("error");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("Camera access is unavailable in this browser. You can upload a photo instead.");
      setPhase("error");
      return;
    }

    setPhase("requesting");
    setMessage(null);

    try {
      const video: MediaTrackConstraints = modeRef.current === "device" && deviceIdRef.current
        ? { deviceId: { exact: deviceIdRef.current }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } };

      const stream = await navigator.mediaDevices.getUserMedia({
        video,
        audio: false, // never record audio or video — single-photo capture only
      });
      streamRef.current = stream;

      // Recover if the stream dies unexpectedly (camera unplugged, OS revoked).
      for (const track of stream.getVideoTracks()) {
        track.onended = () => {
          if (streamRef.current === stream) {
            stopStream();
            setMessage(
              "The camera stopped unexpectedly. Please try again, or upload a photo instead."
            );
            setPhase("error");
          }
        };
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {
          // Autoplay policies: the video is muted-less but user-initiated;
          // a failed play() still leaves the element wired for the next try.
        });
      }

      setPhase("live");

      // Multiple-camera detection (labels are only available post-permission).
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setHasMultipleCameras(
          devices.filter((d) => d.kind === "videoinput").length > 1
        );
      } catch {
        setHasMultipleCameras(false); // switching stays hidden — non-fatal
      }
    } catch (error) {
      stopStream();
      setMessage(cameraErrorMessage(error instanceof DOMException ? error : undefined));
      setPhase("error");
    }
  }, [stopStream]);

  // Open/close lifecycle: start on open, full teardown on close/unmount.
  // The kickoff is deferred one tick (setTimeout 0) so no state transition
  // happens synchronously inside the effect (react-hooks/set-state-in-effect);
  // cleanup still clears the pending timer AND stops every track.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      void startStream();
    }, 0);
    return () => {
      clearTimeout(timer);
      stopStream();
    };
  }, [open, startStream, stopStream]);

  // Final safety net for unmount-with-open-modal (e.g. route change).
  useEffect(() => {
    return () => stopStream();
  }, [stopStream]);

  // Revoke the captured preview URL whenever it changes or on unmount.
  useEffect(() => {
    return () => {
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    };
  }, [capturedUrl]);

  async function handleCapture() {
    const video = videoRef.current;
    if (!video || phase !== "live") return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      setMessage("Your photo could not be captured. Please try again.");
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        setMessage("Your photo could not be captured. Please try again.");
        return;
      }
      // The preview element uses object-cover; the capture preserves the
      // camera's FULL frame (no crop, no distortion) at native resolution.
      context.drawImage(video, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92) // JPEG: matches the server contract, much smaller than PNG
      );
      if (!blob || blob.size === 0) {
        setMessage("Your photo could not be captured. Please try again.");
        return;
      }

      const file = new File([blob], `plant-capture-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      capturedFileRef.current = file;
      setCapturedUrl(URL.createObjectURL(blob));

      // The frame is frozen — stop the camera immediately (lifecycle §6),
      // restart on Retake.
      stopStream();
      setPhase("captured");
    } catch {
      setMessage("Your photo could not be captured. Please try again.");
    }
  }

  function handleRetake() {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    capturedFileRef.current = null;
    void startStream();
  }

  function handleConfirm() {
    const file = capturedFileRef.current;
    if (!file) {
      setMessage("Your photo could not be captured. Please try again.");
      setPhase("error");
      return;
    }
    stopStream();
    onClose("confirm");
    onConfirm(file);
  }

  function handleClose() {
    stopStream();
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    capturedFileRef.current = null;
    onClose("close");
  }

  async function handleSwitchCamera() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === "videoinput");
      if (cameras.length < 2) return;
      const currentIndex = deviceIdRef.current
        ? cameras.findIndex((d) => d.deviceId === deviceIdRef.current)
        : -1;
      const next = cameras[(currentIndex + 1) % cameras.length];
      deviceIdRef.current = next.deviceId;
      modeRef.current = "device";
      stopStream();
      await startStream();
    } catch {
      // Switching is a convenience — never crash, never fabricate success.
      setMessage("Switching cameras failed. The current camera is still available.");
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Take a plant photo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-0 sm:p-6"
    >
      <div className="flex h-full w-full max-w-xl flex-col sm:h-auto sm:rounded-2xl sm:shadow-2xl">
        {/* Header: guidance + close */}
        <div
          className="flex items-center justify-between px-4 pt-4 sm:pt-5"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <p className="text-sm font-semibold text-white">
            Keep the whole plant in focus
          </p>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close camera"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg text-white transition-colors hover:bg-white/20"
          >
            ✕
          </button>
        </div>

        {/* Camera screen */}
        <div className="relative mx-4 overflow-hidden rounded-2xl bg-black">
          <div className="aspect-[3/4] w-full sm:aspect-[4/3]">
            {phase === "captured" && capturedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL preview, not a remote image
              <img
                src={capturedUrl}
                alt="Captured plant photo preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover ${
                  phase === "live" ? "" : "opacity-0"
                }`}
              />
            )}
          </div>

          {phase === "requesting" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
              <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              <p className="text-sm text-white">Starting the camera…</p>
              <p className="text-foreground-muted px-6 text-xs text-white/70">
                Your browser will ask for camera permission.
              </p>
            </div>
          )}

          {phase === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
              <span aria-hidden="true" className="text-4xl">
                📷
              </span>
              <p role="alert" className="text-sm leading-relaxed text-white">
                {message}
              </p>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
              >
                Back to upload options
              </button>
            </div>
          )}

          {phase === "live" && (
            <p className="text-foreground-muted absolute right-3 bottom-3 rounded-full bg-black/50 px-3 py-1 text-xs text-white/80">
              Live preview
            </p>
          )}

          {phase === "captured" && (
            <p className="text-foreground-muted absolute right-3 bottom-3 rounded-full bg-black/50 px-3 py-1 text-xs text-white/80">
              Captured — not saved yet
            </p>
          )}
        </div>

        {/* Controls — thumb-friendly, safe-area aware */}
        <div
          className="flex items-center justify-center gap-4 px-4"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))", paddingTop: "1rem" }}
        >
          {phase === "live" && (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCapture}
                aria-label="Capture photo"
                className="group relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 transition-transform active:scale-95"
              >
                <span
                  aria-hidden="true"
                  className="h-12 w-12 rounded-full bg-white transition-transform group-active:scale-90"
                />
              </button>
              <button
                type="button"
                onClick={handleSwitchCamera}
                disabled={!hasMultipleCameras}
                aria-label="Switch camera"
                className="rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:text-white disabled:opacity-30 disabled:hover:text-white/80"
              >
                ⟳ Switch
              </button>
            </>
          )}

          {phase === "captured" && (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="rounded-lg border border-white/30 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                Retake photo
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="bg-brand-600 hover:bg-brand-700 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-colors"
              >
                Use this photo
              </button>
            </>
          )}

          {phase === "requesting" && (
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:text-white"
            >
              Cancel
            </button>
          )}
        </div>

        <p className="text-foreground-muted px-6 pb-6 text-center text-xs text-white/50 sm:pb-4">
          The photo is only taken when you press the shutter button. Nothing is
          uploaded until you choose “Use this photo”.
        </p>
      </div>
    </div>
  );
}
