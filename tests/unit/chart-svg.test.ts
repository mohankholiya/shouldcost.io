import { describe, it, expect } from "vitest";
import { renderDonutSvg, renderTornadoSvg } from "@/lib/export/chart-svg";
import type { Slice } from "@/components/models/charts/rollup-donut";
import type { TornadoBar } from "@/lib/model/sensitivity";

describe("chart-svg", () => {
  it("renders a well-formed donut SVG with arcs", () => {
    const svg = renderDonutSvg(
      [{ name: "Material", value: 6000 }, { name: "Labour", value: 4000 }] as Slice[],
      "USD",
    );
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect((svg.match(/<path /g) ?? []).length).toBe(2); // one arc per slice
  });

  it("renders a tornado SVG with one low + one high bar per driver", () => {
    const bars: TornadoBar[] = [
      { nodeId: "a", name: "Steel", low: 9000, high: 11000, swing: 2000 },
    ];
    const svg = renderTornadoSvg(bars, 10000, "USD");
    expect(svg.startsWith("<svg")).toBe(true);
    expect((svg.match(/<rect /g) ?? []).length).toBe(2);
    expect(svg).toContain("#059669"); // down color
    expect(svg).toContain("#b45309"); // up color
  });

  it("renders an empty-state SVG for no data", () => {
    expect(renderDonutSvg([], "USD")).toContain("No data");
  });
});
