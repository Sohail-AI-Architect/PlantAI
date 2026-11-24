import { getPlantnetApiKey, getPlantnetMode } from "@/lib/env";
import type { IdentifyProviderRequest, IdentifyProviderResult } from "@/lib/plantnet/types";

/**
 * Provider adapter seam: live Pl@ntNet behind the SAME `identify()`
 * signature as the deterministic mock provider.
 *
 * Wiring rules:
 * - A non-blank server-only `PLANTNET_API_KEY` selects the live provider.
 *   `PLANTNET_MODE` is not needed to enable live identification; it is only
 *   used to log a diagnostic when it says "live" but the key is missing.
 * - No key → MockProvider (no external calls). The route turns that into a
 *   clean "not available right now" response in production, so sample
 *   matches are never presented as live results to visitors.
 * - The live provider module (`live-provider.ts`) is lazy-imported inside
 *   identify() only, so the mock path never loads it (no bundle, no side
 *   effects, no fetch).
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
 * Resolves the provider: live when a server-only `PLANTNET_API_KEY` is
 * configured, mock otherwise. The key is re-read here so a blank/whitespace
 * value can never reach the live provider.
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
