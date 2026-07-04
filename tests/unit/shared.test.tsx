import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "@/components/shared/empty-state";
import { SavedIndicator } from "@/components/shared/saved-indicator";
import { Stat } from "@/components/shared/stat";

describe("EmptyState", () => {
  it("renders title and numbered steps", () => {
    render(<EmptyState title="No models yet" steps={["Pick a template", "Add lines"]} />);
    expect(screen.getByText("No models yet")).toBeTruthy();
    expect(screen.getByText(/Pick a template/)).toBeTruthy();
  });
});

describe("SavedIndicator", () => {
  it("renders nothing when idle", () => {
    const { container } = render(<SavedIndicator status="idle" />);
    expect(container.firstChild).toBeNull();
  });
  it("shows a saved confirmation", () => {
    render(<SavedIndicator status="saved" />);
    expect(screen.getByText(/Saved/)).toBeTruthy();
  });
});

describe("Stat", () => {
  it("renders label and value", () => {
    render(<Stat label="Should-cost" valueMinor={181400} currency="USD" />);
    expect(screen.getByText("Should-cost")).toBeTruthy();
    expect(screen.getByText(/in USD/)).toBeTruthy();
  });
});
