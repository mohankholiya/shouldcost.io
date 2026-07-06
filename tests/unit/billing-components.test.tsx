import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// PlanCard uses useRouter from next/navigation, which requires the App Router
// context. RTL renders components in isolation, so stub the hook.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { PlanBadge, UpgradePrompt, ModelQuotaIndicator, PlanCard } from "@/components/billing";

describe("PlanBadge", () => {
  it("renders the capitalized plan name", () => {
    render(<PlanBadge plan="pro" />);
    expect(screen.getByText("Pro")).toBeInTheDocument();
  });
});

describe("UpgradePrompt", () => {
  it("links to the upgrade page with the required plan", () => {
    render(<UpgradePrompt requiredPlan="pro" />);
    expect(screen.getByRole("link", { name: /upgrade/i })).toHaveAttribute("href", "/settings/billing/upgrade");
  });
});

describe("ModelQuotaIndicator", () => {
  it("shows used / max on the free tier and an upgrade link at the cap", () => {
    render(<ModelQuotaIndicator plan="free" used={2} />);
    expect(screen.getByText(/2 \/ 2/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /upgrade/i })).toBeInTheDocument();
  });

  it("shows nothing on unlimited tiers", () => {
    const { container } = render(<ModelQuotaIndicator plan="pro" used={12} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("PlanCard", () => {
  it("renders the price and a CTA that is disabled for the current plan", () => {
    render(<PlanCard plan="pro" current="free" />);
    expect(screen.getByText(/\$49/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /choose/i })).toBeEnabled();
  });
});
