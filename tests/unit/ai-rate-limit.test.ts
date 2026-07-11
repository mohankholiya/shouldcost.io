import { describe, expect, it } from "vitest";
import { checkRateLimit, RATE_LIMIT } from "@/lib/ai/rate-limit";

describe("checkRateLimit", () => {
  it("allows up to the limit then denies within the window", () => {
    const state = new Map<string, number[]>();
    const now = 1_000_000;
    for (let i = 0; i < RATE_LIMIT.max; i++) {
      expect(checkRateLimit(state, "org1", now).allowed).toBe(true);
    }
    const denied = checkRateLimit(state, "org1", now);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterMs).toBeGreaterThan(0);
  });

  it("forgets calls older than the window", () => {
    const state = new Map<string, number[]>();
    checkRateLimit(state, "org1", 0);
    expect(checkRateLimit(state, "org1", RATE_LIMIT.windowMs + 1).allowed).toBe(true);
  });

  it("scopes per org", () => {
    const state = new Map<string, number[]>();
    for (let i = 0; i < RATE_LIMIT.max; i++) checkRateLimit(state, "a", 0);
    expect(checkRateLimit(state, "b", 0).allowed).toBe(true);
  });
});
