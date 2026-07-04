import { describe, it, expect } from "vitest";
import { effectiveRateMinor } from "@/lib/model/index-rate";

describe("index-rate", () => {
  it("materializes minor rate from index value x factor", () => {
    expect(effectiveRateMinor(650, 1.08)).toBe(70200);
    expect(effectiveRateMinor(6.0, 1)).toBe(600);
  });
});
