/**
 * Single source of truth for recharts marks.
 *
 * Recharts renders marks at run-time and cannot read CSS custom properties
 * directly, so these JS constants mirror the brand tokens defined in
 * app/globals.css (light mode). Centralising them here keeps the four chart
 * components in sync and gives us one place to swap when dark-mode resolution
 * lands.
 *
 * Chart amber (#b45309) is deliberately darker than the UI --color-amber token
 * (#f59e0b): data marks need more contrast against white than text/icons do.
 * Favor/danger match the UI tokens exactly.
 *
 * TODO(phase-4 dark): re-resolve via a useChartColors() hook that reads
 * getComputedStyle(document.documentElement) on --color-petrol-600 et al.
 */

/** Petrol sequential ramp (light mode; mirrors --color-petrol-600…200). */
export const PETROL_RAMP = [
  "#0b3c5d", // petrol-600 (primary)
  "#3c6f95", // petrol-500
  "#5e90b3", // petrol-400
  "#8fb6cf", // petrol-300
  "#bcd3e3", // petrol-200
] as const

/** Single petrol mark for line/bar fills (mirrors --color-petrol-600). */
export const PETROL_600 = "#0b3c5d"

/** Chart-semantic colours keyed by waterfall "kind" (see lib/model/waterfall.ts). */
export const CHART = {
  base: "#0b3c5d", // should-cost / neutral total
  increase: "#b45309", // quote above should-cost (amber, chart-semantic)
  decrease: "#059669", // favourable gap (== --color-favor)
  total: "#0b3c5d",
} as const

export const AMBER_CHART = "#b45309"
export const FAVOR_CHART = "#059669" // == --color-favor
export const DANGER_CHART = "#b91c1c" // == --color-danger

/** Lookup for waterfall "kind" → hex (keys: base | increase | decrease | total). */
export const WATERFALL_FILL: Record<string, string> = {
  base: CHART.base,
  increase: CHART.increase,
  decrease: CHART.decrease,
  total: CHART.total,
}

/**
 * Categorical palette for multi-series charts (donut + legend): the petrol ramp
 * followed by amber + favor as accents, so up to seven roots stay distinct
 * before wrapping.
 */
export const CATEGORICAL_CHART = [...PETROL_RAMP, AMBER_CHART, FAVOR_CHART] as const

/** Categorical accessor with safe wraparound (donut slices, legend swatches). */
export function rampColor(i: number): string {
  return CATEGORICAL_CHART[i % CATEGORICAL_CHART.length] ?? PETROL_600
}
