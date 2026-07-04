import { describe, it, expect } from "vitest";
import { formatCurrency, formatNumber, formatPercent, formatIndexValue } from "@/lib/format";

describe("format", () => {
  it("formats USD minor to currency string", () => {
    expect(formatCurrency(123456, "USD")).toBe("$1,234.56");
  });
  it("formats INR minor", () => {
    expect(formatCurrency(100000, "INR")).toContain("1,000"); // locale symbol varies; assert grouping
  });
  it("formatNumber groups thousands", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });
  it("formatPercent", () => {
    expect(formatPercent(12.345)).toBe("12.3%");
  });
  it("formatIndexValue with unit", () => {
    expect(formatIndexValue(650, "$/MT")).toBe("650 $/MT");
  });
});
