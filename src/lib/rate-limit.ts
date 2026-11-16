/**
 * Phase 2 rate limiter (FR-ID-002/007; API_DOCUMENTATION.md §5).
 *
 * In-memory per-instance counters keyed by verified identity:
 *   - authenticated: `user:{id}` (verified user id from getClaims())
 *   - anonymous:     `ip:{sha256(ip + salt)}` — salted hash only; the raw
 *     IP address is never logged or persisted (SECURITY.md §7).
 *
 * Counters reset at the next 00:00 UTC (aligned to Pl@ntNet's midnight-UTC
 * quota reset — docs/VERIFIED_FACTS.md).
 *
 * HONEST LIMITATION (API_DOCUMENTATION.md §5.2, SECURITY.md §7): Vercel
 * serverless gives no guarantee that two requests share one warm instance.
 * This counter is best-effort and per-instance — it may under-count across
 * cold starts. It is NOT globally persistent or production-grade; the
 * durable-store decision is deferred to Phase 5 (documented, not invented).
 */

export interface RateLimitRule {
  limit: number;
}

export interface RateLimitEntry {
  count: number;
  /** Epoch ms when this window resets (00:00 UTC of the next day). */
  resetAt: number;
}

function nextUtcMidnight(now: Date): number {
  const d = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0
  );
  return d;
}

export class RateLimiter {
  private counters = new Map<string, RateLimitEntry>();

  /**
   * Records one attempt for `key` if under `limit`.
   * Returns the decision + remaining count for response headers.
   */
  consume(
    key: string,
    limit: number,
    now: Date = new Date()
  ): { allowed: boolean; remaining: number; limit: number; resetAt: number } {
    const resetAt = nextUtcMidnight(now);
    const entry = this.counters.get(key);

    if (!entry || entry.resetAt !== resetAt) {
      // New daily window (or first ever) — this call is #1.
      this.counters.set(key, { count: 1, resetAt });
      this.prune(now);
      return {
        allowed: true,
        remaining: limit - 1,
        limit,
        resetAt,
      };
    }

    if (entry.count >= limit) {
      return { allowed: false, remaining: 0, limit, resetAt };
    }

    entry.count += 1;
    return {
      allowed: true,
      remaining: limit - entry.count,
      limit,
      resetAt,
    };
  }

  /**
   * Read-only peek (does not consume) — used to build rate-limit headers
   * on non-429 error responses without penalizing failed requests.
   */
  peek(
    key: string,
    limit: number,
    now: Date = new Date()
  ): { remaining: number; resetAt: number } {
    const resetAt = nextUtcMidnight(now);
    const entry = this.counters.get(key);
    const used = entry && entry.resetAt === resetAt ? entry.count : 0;
    return { remaining: Math.max(0, limit - used), resetAt };
  }

  /** Evict entries whose window has passed so the map cannot grow forever. */
  private prune(now: Date): void {
    const cutoff = now.getTime();
    for (const [key, entry] of this.counters) {
      if (entry.resetAt <= cutoff) this.counters.delete(key);
    }
  }
}

/** Module-scoped limiter — one per server instance (documented semantics). */
export const identifyLimiter = new RateLimiter();
