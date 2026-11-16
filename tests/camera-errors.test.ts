import { describe, expect, it } from "vitest";
import { cameraErrorMessage } from "@/components/identify/camera/plant-camera";

/*
 * Offline contract tests for the camera error taxonomy (task §5).
 *
 * Scope honesty: these tests verify the ERROR-MESSAGE MAPPING only — they are
 * simulated (jsdom-free, pure function) tests and CANNOT verify real camera
 * hardware, permission prompts, stream lifecycle, or capture quality. Real
 * getUserMedia behavior requires actual device/browser verification (task §10
 * distinguishes simulated from real-device testing; recorded in the session
 * report as NOT performed in this environment).
 *
 * What IS pinned here: every documented failure mode maps to a user-facing
 * message that (a) states what happened honestly, (b) always preserves the
 * gallery-upload alternative, and (c) contains no stack traces or technical
 * dumps.
 */

function domError(name: string): DOMException {
  return new DOMException("simulated", name);
}

describe("cameraErrorMessage — the §5 permission/error taxonomy", () => {
  it("permission denied → asks for camera access AND keeps the upload route", () => {
    for (const name of ["NotAllowedError", "PermissionDeniedError"]) {
      const message = cameraErrorMessage(domError(name));
      expect(message).toMatch(/allow camera access/i);
      expect(message).toMatch(/upload a photo/i);
    }
  });

  it("no camera found → honest message AND upload alternative", () => {
    for (const name of ["NotFoundError", "DevicesNotFoundError"]) {
      const message = cameraErrorMessage(domError(name));
      expect(message).toMatch(/no camera was found/i);
      expect(message).toMatch(/upload a photo instead/i);
    }
  });

  it("camera busy (NotReadableError/TrackStartError) → says it's in use", () => {
    for (const name of ["NotReadableError", "TrackStartError"]) {
      const message = cameraErrorMessage(domError(name));
      expect(message).toMatch(/in use/i);
      expect(message).toMatch(/upload a photo instead/i);
    }
  });

  it("overconstrained (selected camera unavailable) → switch-or-upload", () => {
    const message = cameraErrorMessage(domError("OverconstrainedError"));
    expect(message).toMatch(/not available/i);
    expect(message).toMatch(/upload a photo instead/i);
  });

  it("insecure context (SecurityError) → availability message", () => {
    const message = cameraErrorMessage(domError("SecurityError"));
    expect(message).toMatch(/unavailable/i);
  });

  it("unknown/undefined errors → generic fallback that preserves upload", () => {
    const message = cameraErrorMessage(undefined);
    expect(message).toMatch(/unavailable in this browser/i);
    expect(message).toMatch(/upload a photo instead/i);
  });

  it("never leaks technical details (no error names, stack text, or URLs)", () => {
    const names = [
      "NotAllowedError",
      "PermissionDeniedError",
      "NotFoundError",
      "DevicesNotFoundError",
      "NotReadableError",
      "TrackStartError",
      "OverconstrainedError",
      "SecurityError",
    ];
    for (const name of names) {
      const message = cameraErrorMessage(domError(name));
      expect(message).not.toContain(name);
      expect(message).not.toContain("simulated");
      expect(message).not.toMatch(/https?:\/\//);
    }
  });
});
