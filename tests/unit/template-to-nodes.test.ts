import { describe, it, expect } from "vitest";
import { templateToNodes } from "@/lib/db/models";
import { OCTG_TEMPLATE } from "@/lib/seed/templates/octg-casing-tubing";

describe("templateToNodes", () => {
  it("produces a connected tree with minor-unit rates", () => {
    const rows = templateToNodes("m1", OCTG_TEMPLATE.cbs_json);
    const ids = new Set(rows.map((r) => r.id));

    const roots = rows.filter((r) => r.parent_id === null);
    expect(roots).toHaveLength(1);

    for (const r of rows) {
      if (r.parent_id) expect(ids.has(r.parent_id)).toBe(true);
    }

    const billet = rows.find((r) => r.name.includes("billet"))!;
    expect(billet.rate).toBe(65000); // 650 units -> minor
    expect(billet.quantity).toBe(1.08);
  });
});
