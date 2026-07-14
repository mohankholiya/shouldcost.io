import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

describe("Breadcrumbs", () => {
  it("renders links then a plain final label", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Home", href: "/dashboard" },
          { label: "Projects", href: "/projects" },
          { label: "Turbine RFP" },
        ]}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent("Home");
    expect(screen.getByText("Turbine RFP")).toBeInTheDocument();
  });
});
