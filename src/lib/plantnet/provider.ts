import { getPlantnetApiKey, getPlantnetMode } from "@/lib/env";
import type { IdentifyProviderRequest, IdentifyProviderResult } from "@/lib/plantnet/types";

/**
 * Provider adapter seam: live Pl@ntNet behind the SAME `identify()`
 * signature as the deterministic mock provider.
 *
 * Wiring rules (Phase 1A safe opt-in contract):
 * - Live identification requires BOTH an explicit `PLANTNET_MODE=live` and a
 *   non-blank server-only `PLANTNET_API_KEY`. A key by itself is not enough.
 * - `PLANTNET_MODE=mock`, missing mode or an invalid mode always selects
 *   MockProvider (no external calls, no live-provider import on the identify
 *   path). The route never presents sample matches as live results.
 * - Explicit live without a key fails safe to mock with a diagnostic and makes
 *   no network request. Diagnostic text never includes the key value.
 * - The live provider module (`live-provider.ts`) is lazy-imported inside
 *   `LiveProviderHandle.identify()` only, so the mock path never loads it
 *   (no bundle, no side effects, no fetch).
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
 * Resolves the provider from the explicit mode contract. Live requires both
 * `PLANTNET_MODE=live` and a non-blank key; every other combination is mock.
 * The key is re-read only on the live path so a blank/whitespace value can
 * never reach the live provider.
 */
export function getProvider(): { mode: "mock" | "live"; provider: IdentifyProvider } {
  const mode = getPlantnetMode();
  if (mode === "live") {
    const apiKey = getPlantnetApiKey();
    if (!apiKey) {
      // Defensive: getPlantnetMode() already checked this, but re-reading
      // protects against an env change between the two calls. Key never logged.
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
