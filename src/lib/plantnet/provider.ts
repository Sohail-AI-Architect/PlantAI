import { getPlantnetApiKey, getPlantnetMode } from "@/lib/env";
import type { IdentifyProviderRequest, IdentifyProviderResult } from "@/lib/plantnet/types";

/**
 * Provider adapter seam (Phase 2 mock-first; Stage B 2026-11-13 adds the
 * live Pl@ntNet provider behind the SAME `identify()` signature).
 *
 * Wiring rules (owner requirement — Stage B):
 * - `PLANTNET_MODE` missing or not EXACTLY "live" → MockProvider, always.
 *   `PLANTNET_MODE=mock` returns the MockProvider immediately and the live
 *   provider is never constructed or called (mock-first, zero external calls).
 * - `PLANTNET_MODE=live` with a missing/blank server-only API key fails safe
 *   to mock with a safe diagnostic (key value never logged) — enforced in
 *   BOTH env.getPlantnetMode() (loud fail-safe) and here (belt-and-braces).
 * - The live provider module (`live-provider.ts`) is lazy-imported inside
 *   identify() only, so mock mode never even loads it (no bundle, no side
 *   effects, no fetch).
 * - No live identification is ACTIVATED by Stage B: switching the deployed
 *   `PLANTNET_MODE` to `live` remains a separate owner decision (stages
 *   G/H of TASKS.md). Note the live provider's 200 path currently surfaces
 *   the typed Stage C boundary error until the upstream→candidate normalizer
 *   is implemented.
 */

export interface IdentifyProvider {
  identify(request: IdentifyProviderRequest): Promise<IdentifyProviderResult>;
}

class MockProvider implements IdentifyProvider {
  async identify(request: IdentifyProviderRequest): Promise<IdentifyProviderResult> {
    const { identifyMock } = await import("@/lib/plantnet/mock-provider");
    return identifyMock(request);
  }
}

/**
 * Lazy handle so the server-only live module is imported only when a live
 * identify actually runs — never on the mock path.
 */
class LiveProviderHandle implements IdentifyProvider {
  async identify(request: IdentifyProviderRequest): Promise<IdentifyProviderResult> {
    const { PlantnetLiveProvider } = await import("@/lib/plantnet/live-provider");
    const apiKey = getPlantnetApiKey();
    if (!apiKey) {
      // Unreachable via getProvider() (it fail-safes first) — defensive stop
      // so the provider can never be constructed without a credential.
      throw new Error(
        "Live Pl@ntNet provider invoked without a server-only PLANTNET_API_KEY."
      );
    }
    return new PlantnetLiveProvider({ apiKey }).identify(request);
  }
}

/**
 * Resolves the provider. Default (and approved current behavior): mock.
 * `PLANTNET_MODE=live` requires a valid server-only API key (checked by
 * getPlantnetMode, re-checked here); otherwise the app fails safe to mock.
 */
export function getProvider(): { mode: "mock" | "live"; provider: IdentifyProvider } {
  const mode = getPlantnetMode();
  if (mode === "live") {
    const apiKey = getPlantnetApiKey();
    if (!apiKey) {
      // Blank/whitespace key edge case: getPlantnetMode treats a blank key as
      // unconfigured (mock), so this is belt-and-braces. Key value never logged.
      console.error(
        "[provider] PLANTNET_MODE=live but PLANTNET_API_KEY is missing or blank; " +
          "falling back to mock mode. Live identification stays disabled."
      );
      return { mode: "mock", provider: new MockProvider() };
    }
    return { mode: "live", provider: new LiveProviderHandle() };
  }
  return { mode: "mock", provider: new MockProvider() };
}
