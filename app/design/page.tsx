"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MoneyInput } from "@/components/number/money-input";
import { CurrencySelect } from "@/components/number/currency-select";
import { DeltaPill } from "@/components/number/delta-pill";
import { AnimatedCounter } from "@/components/number/animated-counter";
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
            <div
              key={n}
              className="flex items-center gap-2 rounded-md border border-hairline p-2"
            >
              <span
                className="h-5 w-5 rounded-sm border border-hairline"
                style={{ background: h }}
              />
              <span className="text-xs">{n}</span>
            </div>
          ))}
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
        <h2 className="text-lg font-semibold">Indices ({INDICES.length})</h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {INDICES.map((i) => (
            <li key={i.code} className="rounded-md border border-hairline p-2 text-sm">
              <div className="font-medium">{i.name}</div>
              <div className="num text-xs text-muted-foreground">
                {i.latest} {i.unit} · {i.currency} · {i.region}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Templates ({ALL_TEMPLATES.length})</h2>
        <ul className="space-y-3 text-sm">
          {ALL_TEMPLATES.map((t) => (
            <li key={t.slug} className="rounded-md border border-hairline p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{t.name}</span>
                <Badge variant="secondary">{t.draft ? "draft" : "reviewed"}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {t.industry} · per {t.unit}
              </div>
              <p className="mt-1 text-xs">{t.practitioner_notes}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
