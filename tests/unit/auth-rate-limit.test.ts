import { describe, expect, it } from "vitest";
import { isRateLimitError } from "@/lib/auth/rate-limit";

describe("isRateLimitError", () => {
  it("matches HTTP 429", () => {
    expect(isRateLimitError({ status: 429, message: "nope" })).toBe(true);
  });
  it("matches rate-limit messages regardless of case", () => {
    expect(isRateLimitError({ message: "Email rate limit exceeded" })).toBe(true);
    expect(isRateLimitError({ message: "over_email_send_rate_limit" })).toBe(true);
  });
  it("does not match unrelated errors", () => {
    expect(isRateLimitError({ status: 400, message: "invalid email" })).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
  });
});
