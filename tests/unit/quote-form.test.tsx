import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuoteForm } from "@/components/quotes/quote-form";

describe("QuoteForm", () => {
  it("renders supplier and total fields and a submit button", () => {
    render(
      <QuoteForm
        modelId="m1"
        currency="USD"
        leafLines={[{ id: "steel", name: "Steel" }]}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/supplier/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/total/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save quote/i })).toBeInTheDocument();
  });
});
