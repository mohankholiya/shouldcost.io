import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/actions/model", () => ({ createModelFromDraftAction: vi.fn() }));

import { DraftModel } from "@/components/ai/draft-model";

function mockFetch(res: { ok: boolean; status: number; json: () => Promise<unknown> }) {
  (globalThis.fetch as unknown) = vi.fn(async () => res);
}

async function draft() {
  render(<DraftModel projectId="p1" />);
  fireEvent.change(screen.getByPlaceholderText(/describe a part/i), {
    target: { value: "CNC-machined steel valve body, ~12 kg" },
  });
  fireEvent.click(screen.getByRole("button", { name: /draft with ai/i }));
}

describe("DraftModel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("surfaces the upgrade prompt when free credits are exhausted (402)", async () => {
    mockFetch({
      ok: false,
      status: 402,
      json: async () => ({ error: "AI_CREDITS_EXHAUSTED", requiredPlan: "pro" }),
    });

    await draft();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /upgrade/i })).toHaveAttribute(
        "href",
        "/settings/billing/upgrade",
      );
    });
  });

  it("falls back to the generic message on other errors (no upgrade link)", async () => {
    mockFetch({ ok: false, status: 500, json: async () => ({}) });

    await draft();

    await waitFor(() => {
      expect(screen.getByText(/draft a model/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole("link", { name: /upgrade/i })).not.toBeInTheDocument();
  });
});
