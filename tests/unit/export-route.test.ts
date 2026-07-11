import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CostNodeRow } from "@/lib/model/types";

// Mock the I/O boundary only; the gate, entitlement resolution, pure model math
// and the XLSX builders all run for real so the route's wiring is exercised.
vi.mock("@/lib/db/orgs", () => ({ getCurrentOrg: vi.fn() }));
vi.mock("@/lib/db/subscriptions", async (orig) => ({
  ...(await orig<typeof import("@/lib/db/subscriptions")>()),
  findActiveSubscriptionByOrg: vi.fn(async () => null),
}));
vi.mock("@/lib/db/models", () => ({ loadModel: vi.fn() }));
vi.mock("@/lib/db/nodes", () => ({ loadNodes: vi.fn(async () => []) }));
vi.mock("@/lib/db/quotes", () => ({ loadQuotes: vi.fn(async () => []) }));

import { GET } from "@/app/api/models/[id]/export/route";
import { getCurrentOrg } from "@/lib/db/orgs";
import { loadModel } from "@/lib/db/models";
import { loadNodes } from "@/lib/db/nodes";

type Org = Awaited<ReturnType<typeof getCurrentOrg>>;
const demoOrg = {
  org_id: "o1",
  role: "owner",
  organizations: { id: "o1", name: "Demo", plan: "team", is_demo: true },
} satisfies NonNullable<Org>;
const freeOrg = {
  org_id: "o2",
  role: "owner",
  organizations: { id: "o2", name: "Free", plan: "free", is_demo: false },
} satisfies NonNullable<Org>;

function call(qs: string) {
  return GET(new Request(`http://localhost/api/models/m1/export${qs}`), {
    params: Promise.resolve({ id: "m1" }),
  });
}

const model = { id: "m1", name: "OCTG Casing", currency: "USD", project_id: "p", status: "draft" };
const nodes: CostNodeRow[] = [
  { id: "g", model_id: "m1", parent_id: null, sort_order: 0, name: "Materials", node_type: "group", driver_name: null, quantity: null, unit: null, rate: null, rate_source: "manual", index_id: null, index_factor: null, formula: null, notes: null },
  { id: "l", model_id: "m1", parent_id: "g", sort_order: 0, name: "Steel", node_type: "line", driver_name: "tonnes", quantity: 2, unit: "t", rate: 100000, rate_source: "manual", index_id: null, index_factor: null, formula: null, notes: null },
];

beforeEach(() => vi.clearAllMocks());

describe("GET /api/models/[id]/export", () => {
  it("400 when format is missing or invalid", async () => {
    vi.mocked(getCurrentOrg).mockResolvedValue(demoOrg);
    expect((await call("")).status).toBe(400);
    expect((await call("?format=csv")).status).toBe(400);
  });

  it("elevates a Free plan to the full product during the free-launch beta", async () => {
    // FREE_LAUNCH mode: an unsubscribed org resolves to `pro`, so the export
    // gate passes instead of redirecting to upgrade. The pure gate that blocks
    // a genuine `free` plan is still covered in export-gate.test.ts.
    vi.mocked(getCurrentOrg).mockResolvedValue(freeOrg);
    vi.mocked(loadModel).mockResolvedValue(model);
    vi.mocked(loadNodes).mockResolvedValue(nodes);
    const res = await call("?format=xlsx");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("spreadsheetml");
  });

  it("redirects to /login when there is no org", async () => {
    vi.mocked(getCurrentOrg).mockResolvedValue(null);
    const res = await call("?format=xlsx");
    expect([302, 307]).toContain(res.status);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("501 for pdf (deferred to Phase 3C)", async () => {
    vi.mocked(getCurrentOrg).mockResolvedValue(demoOrg);
    expect((await call("?format=pdf")).status).toBe(501);
  });

  it("200 xlsx with attachment headers for an unlocked plan", async () => {
    vi.mocked(getCurrentOrg).mockResolvedValue(demoOrg);
    vi.mocked(loadModel).mockResolvedValue(model);
    vi.mocked(loadNodes).mockResolvedValue(nodes);
    const res = await call("?format=xlsx");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("spreadsheetml");
    const cd = res.headers.get("content-disposition") ?? "";
    expect(cd).toContain("attachment");
    expect(cd).toContain("octg-casing.xlsx");
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it("404 when the model is not readable under RLS", async () => {
    vi.mocked(getCurrentOrg).mockResolvedValue(demoOrg);
    vi.mocked(loadModel).mockResolvedValue(null);
    expect((await call("?format=xlsx")).status).toBe(404);
  });
});
