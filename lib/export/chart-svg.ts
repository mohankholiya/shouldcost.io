import { CHART_CATEGORICAL_LIGHT, DIVERGING_LIGHT, CHART_SURFACE } from "@/lib/chart-palette";
import { formatCurrency } from "@/lib/format";
import type { Slice } from "@/components/models/charts/rollup-donut";
import type { TornadoBar } from "@/lib/model/sensitivity";
import type { Currency } from "@/components/number/currency-select";

const SURFACE = CHART_SURFACE.light;
const INK = "#0b0b0b";
const MUTED = "#52514e";

function money(minor: number, c: Currency) {
  return formatCurrency(minor, c);
}

/** Donut as a standalone SVG (light surface). */
export function renderDonutSvg(data: Slice[], currency: Currency, opts?: { width?: number }): string {
  const W = opts?.width ?? 480;
  const H = 240;
  const cx = 120;
  const cy = H / 2;
  const r = 80;
  const ir = 48;
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total <= 0) {
    return svgWrap(W, H, `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="${MUTED}" font-size="13">No data</text>`);
  }

  let angle = -Math.PI / 2; // start at top
  const arcs: string[] = [];
  data.forEach((d, i) => {
    const slice = (d.value / total) * Math.PI * 2;
    const a0 = angle;
    const a1 = angle + slice;
    angle = a1;
    const fill = CHART_CATEGORICAL_LIGHT[i % CHART_CATEGORICAL_LIGHT.length]!;
    arcs.push(`<path d="${donutArcPath(cx, cy, r, ir, a0, a1)}" fill="${fill}" stroke="${SURFACE}" stroke-width="2" />`);
  });

  const legend = data
    .map(
      (d, i) =>
        `<g transform="translate(240, ${24 + i * 22})"><rect width="10" height="10" fill="${CHART_CATEGORICAL_LIGHT[i % CHART_CATEGORICAL_LIGHT.length]!}" /><text x="16" y="9" fill="${INK}" font-size="12">${escapeXml(d.name)} — ${money(d.value, currency)} · ${Math.round((d.value / total) * 100)}%</text></g>`,
    )
    .join("");

  return svgWrap(W, H, arcs.join("") + legend);
}

function donutArcPath(cx: number, cy: number, r: number, ir: number, a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p = (rad: number, rr: number) => [cx + rr * Math.cos(rad), cy + rr * Math.sin(rad)];
  const [x0, y0] = p(a0, r);
  const [x1, y1] = p(a1, r);
  const [x2, y2] = p(a1, ir);
  const [x3, y3] = p(a0, ir);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${ir} ${ir} 0 ${large} 0 ${x3} ${y3} Z`;
}

/** Tornado as a standalone diverging SVG (light surface). */
export function renderTornadoSvg(
  bars: TornadoBar[],
  baseline: number,
  currency: Currency,
  opts?: { width?: number },
): string {
  const W = opts?.width ?? 560;
  const rowH = 26;
  const padTop = 28;
  const labelW = 150;
  const plotW = W - labelW - 24;
  const midX = labelW + plotW / 2;
  const H = padTop + Math.max(bars.length, 1) * rowH + 8;

  if (bars.length === 0) {
    return svgWrap(W, H, `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="${MUTED}" font-size="13">No data</text>`);
  }

  const maxAbsDelta = Math.max(...bars.map((b) => Math.max(baseline - b.low, b.high - baseline)), 1);
  const scale = plotW / 2 / maxAbsDelta;
  const body = bars
    .map((b, i) => {
      const y = padTop + i * rowH;
      const lowDelta = baseline - b.low; // >=0
      const highDelta = b.high - baseline; // >=0
      const lowW = lowDelta * scale;
      const highW = highDelta * scale;
      const lowRect = `<rect x="${midX - lowW}" y="${y}" width="${lowW}" height="14" fill="${DIVERGING_LIGHT.down}" />`;
      const highRect = `<rect x="${midX}" y="${y}" width="${highW}" height="14" fill="${DIVERGING_LIGHT.up}" />`;
      const lowLbl = `<text x="${midX - lowW - 4}" y="${y + 11}" text-anchor="end" fill="${INK}" font-size="10">−${money(lowDelta, currency)}</text>`;
      const highLbl = `<text x="${midX + highW + 4}" y="${y + 11}" fill="${INK}" font-size="10">+${money(highDelta, currency)}</text>`;
      const name = `<text x="${labelW - 8}" y="${y + 11}" text-anchor="end" fill="${INK}" font-size="11">${escapeXml(b.name)}</text>`;
      return lowRect + highRect + lowLbl + highLbl + name;
    })
    .join("");

  const baselineLine = `<line x1="${midX}" y1="${padTop - 8}" x2="${midX}" y2="${H - 6}" stroke="${DIVERGING_LIGHT.mid}" stroke-width="1" /><text x="${midX}" y="${padTop - 12}" text-anchor="middle" fill="${MUTED}" font-size="10">baseline ${money(baseline, currency)}</text>`;

  return svgWrap(W, H, baselineLine + body);
}

function svgWrap(W: number, H: number, inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="background:${SURFACE}">${inner}</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === '"' ? "&quot;" : "&#39;",
  );
}
