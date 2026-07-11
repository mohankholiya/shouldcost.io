export const RATE_LIMIT = { max: 20, windowMs: 60 * 60 * 1000 } as const;

/**
 * Sliding-window per-org limiter. `state` is caller-owned (a module singleton in the
 * route handler) so AI calls can't run up unbounded API spend under free-launch.
 */
export function checkRateLimit(
  state: Map<string, number[]>,
  orgId: string,
  now: number,
): { allowed: boolean; retryAfterMs: number } {
  const cutoff = now - RATE_LIMIT.windowMs;
  const hits = (state.get(orgId) ?? []).filter((t) => t > cutoff);
  if (hits.length >= RATE_LIMIT.max) {
    const retryAfterMs = hits[0]! + RATE_LIMIT.windowMs - now;
    state.set(orgId, hits);
    return { allowed: false, retryAfterMs };
  }
  hits.push(now);
  state.set(orgId, hits);
  return { allowed: true, retryAfterMs: 0 };
}
