import { describe, expect, it } from "vitest";
import { buildCommandItems } from "@/lib/command/items";

describe("buildCommandItems", () => {
  it("always includes core navigation", () => {
    const groups = buildCommandItems({ recentModels: [] });
    const nav = groups.find((g) => g.heading === "Navigation");
    expect(nav?.items.map((i) => i.href)).toEqual([
      "/dashboard",
      "/projects",
      "/indices",
      "/settings",
    ]);
  });

  it("adds a Recent models group only when models exist", () => {
    expect(
      buildCommandItems({ recentModels: [] }).some((g) => g.heading === "Recent models"),
    ).toBe(false);
    const groups = buildCommandItems({ recentModels: [{ id: "m1", name: "Pump skid" }] });
    const recent = groups.find((g) => g.heading === "Recent models");
    expect(recent?.items[0]).toEqual({ label: "Pump skid", href: "/models/m1" });
  });
});
