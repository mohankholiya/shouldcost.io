import { describe, it, expect } from "vitest";
import { toMinor, fromMinor, convert, add, multiply, formatMinorInput } from "@/lib/money";

describe("money", () => {
  it("converts units to minor (2-decimal currencies)", () => {
    expect(toMinor(12.34, "USD")).toBe(1234);
    expect(toMinor(0.01, "EUR")).toBe(1);
  });
  it("converts INR to minor paise", () => {
    expect(toMinor(100, "INR")).toBe(10000);
  });
  it("rounds half-up to avoid float drift", () => {
    expect(toMinor(0.1 + 0.2, "USD")).toBe(30);
  });
  it("fromMinor reverses toMinor", () => {
    expect(fromMinor(1234, "USD")).toBeCloseTo(12.34, 2);
  });
  it("convert uses fxRate as (1 from -> rate to) on minor units", () => {
    expect(convert(1000, "USD", "INR", 83.2)).toBe(Math.round(1000 * 83.2));
  });
  it("add and multiply stay integer", () => {
    expect(add(1234, 100)).toBe(1334);
    expect(multiply(1234, 1.5)).toBe(1851);
  });
  it("formatMinorInput shows 2 decimals", () => {
    expect(formatMinorInput(1234)).toBe("12.34");
  });
});
