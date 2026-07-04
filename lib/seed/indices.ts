export type SeedIndex = {
  code: string;
  name: string;
  unit: string;
  currency: string;
  region: string;
  source_note: string;
  latest: number;
  /** Waypoints oldest -> newest, interpolated across the 24-month window. */
  trajectory: number[];
};

export const INDICES: SeedIndex[] = [
  {
    code: "hrc_steel",
    name: "HRC hot-rolled coil",
    unit: "$/MT",
    currency: "USD",
    region: "Global",
    source_note: "Illustrative composite of published HRC benchmarks; needs validation.",
    latest: 650,
    trajectory: [780, 760, 720, 690, 660, 640, 630, 635, 645, 650],
  },
  {
    code: "crc_steel",
    name: "Cold-rolled coil",
    unit: "$/MT",
    currency: "USD",
    region: "Global",
    source_note: "Illustrative; CRC trades at a premium over HRC.",
    latest: 780,
    trajectory: [900, 880, 850, 820, 800, 790, 785, 780, 780, 780],
  },
  {
    code: "ss316",
    name: "Stainless 316 hot-rolled",
    unit: "$/MT",
    currency: "USD",
    region: "Global",
    source_note: "Illustrative; alloy-surcharge sensitive to nickel.",
    latest: 3200,
    trajectory: [3800, 3700, 3600, 3500, 3400, 3350, 3300, 3250, 3220, 3200],
  },
  {
    code: "copper_lme",
    name: "Copper LME 3M",
    unit: "$/MT",
    currency: "USD",
    region: "Global",
    source_note: "Illustrative LME 3M settlement.",
    latest: 9500,
    trajectory: [8400, 8500, 8700, 8900, 9100, 9200, 9300, 9400, 9450, 9500],
  },
  {
    code: "aluminum_lme",
    name: "Aluminum LME 3M",
    unit: "$/MT",
    currency: "USD",
    region: "Global",
    source_note: "Illustrative LME 3M settlement.",
    latest: 2400,
    trajectory: [2200, 2250, 2280, 2300, 2320, 2350, 2370, 2380, 2390, 2400],
  },
  {
    code: "nickel_lme",
    name: "Nickel LME 3M",
    unit: "$/MT",
    currency: "USD",
    region: "Global",
    source_note: "Illustrative; nickel is volatile.",
    latest: 16000,
    trajectory: [21000, 19500, 18500, 17800, 17200, 16800, 16500, 16200, 16100, 16000],
  },
  {
    code: "polysilicon",
    name: "Polysilicon spot",
    unit: "$/kg",
    currency: "USD",
    region: "Global",
    source_note: "Illustrative; long decline from 2022 highs.",
    latest: 6.0,
    trajectory: [30, 24, 18, 14, 11, 9, 8, 7, 6.5, 6.0],
  },
  {
    code: "brent",
    name: "Brent crude",
    unit: "$/bbl",
    currency: "USD",
    region: "Global",
    source_note: "Illustrative front-month.",
    latest: 80,
    trajectory: [82, 84, 86, 88, 85, 82, 80, 79, 79, 80],
  },
  {
    code: "hdpe",
    name: "HDPE blow-molding resin",
    unit: "$/MT",
    currency: "USD",
    region: "Global",
    source_note: "Illustrative; resin tracks naphtha + spread.",
    latest: 1000,
    trajectory: [1150, 1120, 1080, 1050, 1030, 1020, 1010, 1005, 1000, 1000],
  },
  {
    code: "fab_labor_in",
    name: "Fabricated-steel labor composite",
    unit: "₹/hr",
    currency: "INR",
    region: "India",
    source_note: "Illustrative fully-burdened skilled welder/fabricator hour.",
    latest: 850,
    trajectory: [780, 790, 800, 810, 820, 830, 835, 840, 845, 850],
  },
];

/** Deterministic pseudo-noise so the series looks live but is reproducible. */
function seededNoise(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x) - 0.5; // [-0.5, 0.5)
}

/** 24 monthly points (UTC, first-of-month) ending the current month. */
export function generateIndexValues(code: string): { date: string; value: number }[] {
  const idx = INDICES.find((i) => i.code === code);
  if (!idx) throw new Error(`unknown index ${code}`);
  const waypoints = idx.trajectory;
  const out: { date: string; value: number }[] = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    // UTC construction avoids off-by-one-month drift under toISOString() in +tz locales.
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const t = (23 - i) / 23; // 0..1 across the window
    const segPos = t * (waypoints.length - 1);
    const lo = Math.floor(segPos);
    const hi = Math.min(waypoints.length - 1, lo + 1);
    const frac = segPos - lo;
    const interp = waypoints[lo]! * (1 - frac) + waypoints[hi]! * frac;
    const noise = 1 + seededNoise((i + 1) * (code.length + 1)) * 0.02; // ±2%
    const value = Math.max(0.01, +(interp * noise).toFixed(2));
    out.push({ date: d.toISOString().slice(0, 10), value });
  }
  return out;
}
