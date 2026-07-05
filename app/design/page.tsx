"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Surface } from "@/components/ui/surface";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MoneyInput } from "@/components/number/money-input";
import { CurrencySelect } from "@/components/number/currency-select";
import { DeltaPill } from "@/components/number/delta-pill";
import { AnimatedCounter } from "@/components/number/animated-counter";
import {
  PETROL_RAMP,
  AMBER_CHART,
  FAVOR_CHART,
  DANGER_CHART,
} from "@/lib/chart-palette";
import { INDICES } from "@/lib/seed/indices";
import { ALL_TEMPLATES } from "@/lib/seed/templates";

const SWATCHES: [string, string][] = [
  ["canvas", "#FAFAF8"],
  ["ink", "#1A1A1A"],
  ["hairline", "#E5E5E0"],
  ["petrol-600", "#0B3C5D"],
  ["amber", "#F59E0B"],
  ["favor", "#059669"],
];

const RAMP_NAMES = ["petrol-600", "petrol-500", "petrol-400", "petrol-300", "petrol-200"] as const;

const CHART_SWATCHES: { name: string; hex: string }[] = [
  ...RAMP_NAMES.map((name, i) => ({ name, hex: PETROL_RAMP[i] ?? "#000000" })),
  { name: "amber-chart", hex: AMBER_CHART },
  { name: "favor-chart", hex: FAVOR_CHART },
  { name: "danger-chart", hex: DANGER_CHART },
];

export default function DesignPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-12 p-8">
      <header>
        <h1 className="text-2xl font-semibold">Design system &amp; seed review</h1>
        <p className="text-sm text-muted-foreground">Internal — not linked in production nav.</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Tokens</h2>
        <div className="flex flex-wrap gap-2">
          {SWATCHES.map(([n, h]) => (
            <Surface key={n} padding="sm" className="flex items-center gap-2">
              <span
                className="h-5 w-5 rounded-sm border border-hairline"
                style={{ background: h }}
              />
              <span className="text-xs">{n}</span>
            </Surface>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Surfaces &amp; elevation</h2>
        <p className="text-xs text-muted-foreground">
          The canonical app surface: <code className="num">rounded-md border border-hairline
          bg-card</code>. Elevation uses the <code className="num">--shadow-overlay</code> token — flat
          by default, interactive lifts on hover, raised holds it.
        </p>
        <div className="flex flex-wrap gap-3">
          <Surface padding="md">Flat</Surface>
          <Surface padding="md" elevation="interactive">
            Interactive — hover me
          </Surface>
          <Surface padding="md" elevation="raised">
            Raised
          </Surface>
          <Surface padding="md" radius="lg">
            Radius lg
          </Surface>
          <Surface padding="none" className="p-2 text-xs text-muted-foreground">
            padding none + custom
          </Surface>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Components</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Input placeholder="Text input" className="w-48" />
          <Badge>Category</Badge>
          <DeltaPill deltaMinor={1400} baseMinor={10000} />
          <span className="num text-xl font-semibold">
            <AnimatedCounter valueMinor={181400} />
          </span>
          <MoneyInput valueMinor={181400} currency="USD" onChange={() => {}} />
          <CurrencySelect value="USD" onChange={() => {}} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Table</h2>
        <p className="text-xs text-muted-foreground">
          Hairline grid, tabular figures, and a tinted totals row. The{" "}
          <code className="num">data-density=&quot;compact&quot;</code> hook tightens cell padding.
        </p>
        <Surface padding="none" className="overflow-hidden">
          <Table data-density="compact">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">Line</TableHead>
                <TableHead className="h-auto px-3 py-2 text-right text-xs text-muted-foreground">
                  Should-cost
                </TableHead>
                <TableHead className="h-auto px-3 py-2 text-right text-xs text-muted-foreground">
                  Δ%
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="px-3 py-2">Materials</TableCell>
                <TableCell className="num px-3 py-2 text-right">$12,400</TableCell>
                <TableCell className="num px-3 py-2 text-right text-amber">+4.2%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="px-3 py-2">Labour</TableCell>
                <TableCell className="num px-3 py-2 text-right">$8,100</TableCell>
                <TableCell className="num px-3 py-2 text-right text-favor">−1.1%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="px-3 py-2">Overhead</TableCell>
                <TableCell className="num px-3 py-2 text-right">$4,300</TableCell>
                <TableCell className="num px-3 py-2 text-right text-amber">+0.6%</TableCell>
              </TableRow>
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell className="px-3 py-2">Total</TableCell>
                <TableCell className="num px-3 py-2 text-right">$24,800</TableCell>
                <TableCell className="px-3 py-2" />
              </TableRow>
            </TableFooter>
          </Table>
        </Surface>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Chart palette</h2>
        <p className="text-xs text-muted-foreground">
          Single source of truth for recharts marks (<code className="num">lib/chart-palette.ts</code>).
          Chart amber is darker than the UI token on purpose — data marks need more contrast on
          white.
        </p>
        <div className="flex flex-wrap gap-2">
          {CHART_SWATCHES.map((s) => (
            <Surface key={s.name} padding="sm" className="flex items-center gap-2">
              <span
                className="h-5 w-5 rounded-sm border border-hairline"
                style={{ background: s.hex }}
              />
              <span className="text-xs">
                {s.name} <span className="num text-muted-foreground">{s.hex}</span>
              </span>
            </Surface>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Indices ({INDICES.length})</h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {INDICES.map((i) => (
            <Surface key={i.code} as="li" padding="sm" className="text-sm">
              <div className="font-medium">{i.name}</div>
              <div className="num text-xs text-muted-foreground">
                {i.latest} {i.unit} · {i.currency} · {i.region}
              </div>
            </Surface>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Templates ({ALL_TEMPLATES.length})</h2>
        <ul className="space-y-3 text-sm">
          {ALL_TEMPLATES.map((t) => (
            <Surface key={t.slug} as="li" padding="sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{t.name}</span>
                <Badge variant="secondary">{t.draft ? "draft" : "reviewed"}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {t.industry} · per {t.unit}
              </div>
              <p className="mt-1 text-xs">{t.practitioner_notes}</p>
            </Surface>
          ))}
        </ul>
      </section>
    </main>
  );
}
