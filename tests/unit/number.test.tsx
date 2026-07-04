import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DeltaPill } from "@/components/number/delta-pill";
import { CurrencySelect } from "@/components/number/currency-select";

describe("DeltaPill", () => {
  it("renders favorable (+) when delta >= 0", () => {
    render(<DeltaPill deltaMinor={1500} baseMinor={10000} />);
    expect(screen.getByText(/\+/)).toBeTruthy();
  });
  it("renders unfavorable (-) when delta < 0", () => {
    render(<DeltaPill deltaMinor={-500} baseMinor={10000} />);
    expect(screen.getByText(/-/)).toBeTruthy();
  });
});

describe("CurrencySelect", () => {
  it("renders a combobox trigger", () => {
    render(<CurrencySelect value="USD" onChange={() => {}} />);
    expect(screen.getByRole("combobox")).toBeTruthy();
  });
});
