import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExportMenu } from "@/components/export/export-menu";

describe("ExportMenu", () => {
  it("renders a model XLSX download link for Pro", () => {
    render(<ExportMenu modelId="m1" plan="pro" />);
    const link = screen.getByRole("link", { name: /export xlsx/i });
    expect(link).toHaveAttribute("href", "/api/models/m1/export?format=xlsx");
  });

  it("includes the quoteId for a comparison export", () => {
    render(<ExportMenu modelId="m1" plan="team" quoteId="q9" />);
    expect(screen.getByRole("link", { name: /export xlsx/i })).toHaveAttribute(
      "href",
      "/api/models/m1/export?format=xlsx&quoteId=q9",
    );
  });

  it("shows the upgrade prompt (no export link) for Free", () => {
    render(<ExportMenu modelId="m1" plan="free" />);
    expect(screen.queryByRole("link", { name: /export xlsx/i })).toBeNull();
    expect(screen.getByRole("link", { name: /upgrade/i })).toHaveAttribute(
      "href",
      "/settings/billing/upgrade",
    );
  });
});
