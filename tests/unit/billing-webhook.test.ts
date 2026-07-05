// tests/unit/billing-webhook.test.ts
import { describe, it, expect, vi } from "vitest";
import { handleBillingEvent, type WebhookRepo } from "@/lib/billing/webhook";
import type { BillingEvent } from "@/lib/billing/types";

function fakeRepo(): WebhookRepo & { calls: string[] } {
  const calls: string[] = [];
  const seen = new Set<string>();
  return {
    calls,
    isProcessed: async (id) => {
      calls.push(`isProcessed:${id}`);
      return seen.has(id);
    },
    markProcessed: async (id) => {
      calls.push(`markProcessed:${id}`);
      seen.add(id);
    },
    upsertSubscription: async (row) => {
      calls.push(`upsert:${row.org_id}:${row.plan}:${row.status}`);
    },
    syncOrgPlan: async (orgId, plan) => {
      calls.push(`sync:${orgId}:${plan}`);
    },
  };
}

const created: BillingEvent = {
  eventId: "evt_1",
  kind: "subscription_created",
  orgId: "org-1",
  plan: "pro",
  providerCustomerId: "cus_1",
  status: "active",
  currentPeriodEnd: new Date("2026-08-05T00:00:00Z"),
};

describe("handleBillingEvent", () => {
  it("upserts the subscription, syncs org plan, marks processed — in that order", async () => {
    const repo = fakeRepo();
    await handleBillingEvent(created, repo);
    expect(repo.calls).toEqual([
      "isProcessed:evt_1",
      "upsert:org-1:pro:active",
      "sync:org-1:pro",
      "markProcessed:evt_1",
    ]);
  });

  it("is idempotent: a replayed event id is skipped entirely", async () => {
    const repo = fakeRepo();
    await handleBillingEvent(created, repo);
    await handleBillingEvent(created, repo); // replay
    expect(repo.calls.filter((c) => c.startsWith("upsert:"))).toHaveLength(1);
    expect(repo.calls.filter((c) => c.startsWith("sync:"))).toHaveLength(1);
  });

  it("subscription_deleted downgrades the org to free", async () => {
    const repo = fakeRepo();
    const deleted: BillingEvent = {
      eventId: "evt_2",
      kind: "subscription_deleted",
      orgId: "org-1",
      providerCustomerId: "cus_1",
    };
    await handleBillingEvent(deleted, repo);
    expect(repo.calls).toContain("upsert:org-1:free:canceled");
    expect(repo.calls).toContain("sync:org-1:free");
  });

  it("unknown events are ignored but still marked processed", async () => {
    const repo = fakeRepo();
    await handleBillingEvent({ eventId: "evt_3", kind: "unknown" }, repo);
    expect(repo.calls).toEqual(["isProcessed:evt_3", "markProcessed:evt_3"]);
    // no upsert, no sync
    expect(repo.calls.find((c) => c.startsWith("upsert:"))).toBeUndefined();
  });

  it("a handler error does not mark the event processed (so Stripe retries it)", async () => {
    const repo = fakeRepo();
    repo.upsertSubscription = vi.fn(async () => {
      throw new Error("db down");
    });
    await expect(handleBillingEvent(created, repo)).rejects.toThrow("db down");
    expect(repo.calls).not.toContain("markProcessed:evt_1");
  });
});
