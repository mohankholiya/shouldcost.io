import { describe, it, expect } from "vitest";
import { INDICES, generateIndexValues } from "@/lib/seed/indices";

describe("seed indices", () => {
  it("defines exactly 10 indices with unique codes", () => {
    expect(INDICES).toHaveLength(10);
    expect(new Set(INDICES.map((i) => i.code)).size).toBe(10);
  });
  it("every index has required fields", () => {
    for (const i of INDICES) {
      expect(i.name).toBeTruthy();
      expect(i.unit).toBeTruthy();
      expect(i.currency).toBeTruthy();
      expect(i.latest).toBeGreaterThan(0);
    }
  });
  it("generates 24 monthly values ending now", () => {
    const series = generateIndexValues("hrc_steel");
    expect(series).toHaveLength(24);
    const last = series.at(-1)!.date.slice(0, 7);
    const nowMonth = new Date().toISOString().slice(0, 7);
    expect(last).toBe(nowMonth);
  });
  it("values stay positive and within a plausible band of the anchor", () => {
    const anchor = INDICES.find((i) => i.code === "hrc_steel")!.latest;
    const series = generateIndexValues("hrc_steel").map((p) => p.value);
    for (const v of series) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeGreaterThan(anchor * 0.5);
      expect(v).toBeLessThan(anchor * 1.6);
    }
  });
});
