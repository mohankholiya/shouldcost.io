import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ENTITLEMENTS, FREE_LAUNCH, TRIAL_DAYS, type Plan } from "@/lib/entitlements";
import { ALL_TEMPLATES } from "@/lib/seed/templates";
import { INDICES } from "@/lib/seed/indices";

/* ---------------------------------------------------------------------------
   Hero exhibit — an illustrative should-cost built from the shipped OCTG
   casing & tubing template (per MT). Figures are worked from the template's
   own drivers so the mock reads like a real model, and the page labels it as
   an illustration.
--------------------------------------------------------------------------- */
const EXHIBIT = [
  { name: "Material", detail: "Steel billet · 1.08 MT/MT yield × HRC", value: 769 },
  { name: "Conversion", detail: "Piercing, Q&T, threading, NDT", value: 710 },
  { name: "Overhead & SG&A", detail: "12% of conversion · 5% of material", value: 123 },
  { name: "Supplier margin", detail: "9% on cost", value: 144 },
  { name: "Logistics", detail: "Inland freight, port, duty", value: 90 },
];
const SHOULD_COST = EXHIBIT.reduce((s, r) => s + r.value, 0); // 1,836
const QUOTE = 2115;
const GAP = QUOTE - SHOULD_COST;

/* Offer copy follows the billing mode: everything free during launch, or the
   7-day trial once billing is on. Flipping FREE_LAUNCH updates the whole page. */
const OFFER = FREE_LAUNCH
  ? {
      cta: "Start free",
      note: "Free during launch · Every feature unlocked · No card required",
      closing: "Build your first should-cost model in minutes — free, with every feature.",
    }
  : {
      cta: `Start your ${TRIAL_DAYS}-day free trial`,
      note: `Every feature unlocked for ${TRIAL_DAYS} days · No card required`,
      closing: `Build your first should-cost model in minutes — free for ${TRIAL_DAYS} days.`,
    };

const FREE_INCLUDES = [
  "Unlimited cost models",
  `All ${ALL_TEMPLATES.length} category templates`,
  "Unlimited AI drafts, suggestions and gap briefs",
  "Excel export with live formulas",
  "Quote comparison & gap waterfall",
  "Version history & diff",
];

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

const STEPS = [
  {
    title: "Start from a category template",
    body: `Pick one of ${ALL_TEMPLATES.length} energy and utilities templates — OCTG, power transformers, HV cables, solar BoS, EPC man-hours — or describe the part and let AI draft the first cut.`,
  },
  {
    title: "Rebuild the cost from its drivers",
    body: "Edit material, conversion, overhead and margin in a cost-breakdown tree that rolls up as you type. Every rate shows where it came from.",
  },
  {
    title: "Tie drivers to commodity indices",
    body: "Bind steel, copper or aluminium lines to an index so the model re-prices as markets move, and see which drivers swing the total.",
  },
  {
    title: "Benchmark the quote and negotiate",
    body: "Drop in supplier quotes, line by line or as a total. The gap waterfall shows exactly where each price sits above should-cost.",
  },
];

const PLAN_COPY: Record<Plan, { blurb: string; points: string[] }> = {
  free: {
    blurb: "Try the workflow on a single category.",
    points: [
      `${ENTITLEMENTS.free.maxModels} cost models`,
      `${ENTITLEMENTS.free.maxTemplates} starter templates`,
      `${ENTITLEMENTS.free.aiDraftCredits} AI-drafted model`,
      "Quote comparison & gap waterfall",
    ],
  },
  pro: {
    blurb: "For a category manager running live negotiations.",
    points: [
      "Unlimited cost models",
      `All ${ALL_TEMPLATES.length} category templates`,
      "Unlimited AI drafts",
      "Excel export with live formulas",
      "Version history & diff",
    ],
  },
  team: {
    blurb: "For a sourcing team building a shared cost library.",
    points: [
      "Everything in Pro",
      `Up to ${ENTITLEMENTS.team.maxSeats} seats in one workspace`,
      "One shared library of models and quotes",
    ],
  },
};

export default function MarketingHome() {
  return (
    <>
      {/* ------------------------------------------------------------ Hero */}
      <section className="relative isolate overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_480px_at_85%_-10%,var(--color-petrol-50),transparent_65%)] dark:opacity-0"
        />
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 pt-16 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pt-24 lg:pb-28">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              Should-cost modelling for energy procurement
            </p>
            <h1 className="mt-5 font-display text-[clamp(2.5rem,5.4vw,4.25rem)] leading-[1.02] font-medium tracking-[-0.015em]">
              Know what it <em className="text-primary">should</em> cost before the supplier tells you.
            </h1>
            <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-muted-foreground">
              Rebuild any bought part or service from its cost drivers, link them to live commodity
              indices, and walk into the negotiation with a baseline you can defend line by line.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild className="group">
                <Link href="/signup">
                  {OFFER.cta}
                  <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button size="lg" variant="ghost" asChild>
                <a href="/how-to-use.html" target="_blank" rel="noopener">
                  See how it works
                </a>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {OFFER.note}
            </p>
          </div>

          <HeroExhibit />
        </div>
      </section>

      {/* ------------------------------------------------------- Built for */}
      <section aria-label="Who it's for" className="border-y border-hairline bg-card/60">
        <dl className="mx-auto grid max-w-6xl gap-8 px-6 py-10 sm:grid-cols-3">
          {[
            ["Category & sourcing leads", "A defensible baseline to anchor cost-out and renegotiation."],
            ["Cost engineers", "A structured cost breakdown with live rollup, indices and versions."],
            ["Consultants & advisors", "Fast, presentable models to size an opportunity for a client."],
          ].map(([t, d]) => (
            <div key={t}>
              <dt className="text-sm font-semibold">{t}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------------------------------------------------- How it works */}
      <section id="how-it-works" className="scroll-mt-20">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="font-display text-4xl leading-tight font-medium tracking-[-0.01em]">
              From supplier price to cost drivers in an afternoon.
            </h2>
            <p className="mt-4 max-w-sm text-muted-foreground">
              The same method a should-cost team would run in a spreadsheet — structured, indexed,
              and repeatable across every category you buy.
            </p>
          </div>
          <ol className="divide-y divide-hairline border-y border-hairline">
            {STEPS.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[3rem_1fr] gap-4 py-7">
                <span className="num pt-0.5 text-sm text-primary">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-1.5 max-w-prose text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* -------------------------------------------------------- Features */}
      <section id="features" className="scroll-mt-20 border-y border-hairline bg-card/60">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <h2 className="max-w-2xl font-display text-4xl leading-tight font-medium tracking-[-0.01em]">
            Everything a negotiation-ready cost model needs.
          </h2>
          <div className="mt-12 grid gap-4 md:grid-cols-6">
            <Feature
              className="md:col-span-4"
              title="Live commodity indices"
              body={`${INDICES.length} indices — HRC and cold-rolled steel, stainless 316, LME copper, aluminium and more — with 24 months of history. Bind a line once and the model re-prices with the market.`}
            >
              <IndexArt />
            </Feature>
            <Feature
              className="md:col-span-2"
              title="Excel export, formulas intact"
              body="Download the model or the quote comparison as .xlsx with live formulas and charts — not pasted values."
            />
            <Feature
              className="md:col-span-2"
              title="AI drafts, labelled for review"
              body="Describe a part in plain English and get an editable first model, a likely driver for any line, or a plain-language brief on a quote gap."
            />
            <Feature
              className="md:col-span-4"
              title="Quote comparison & gap waterfall"
              body="Enter quotes in total or line by line. See where each supplier sits above or below should-cost, with rule-based insights on the biggest levers."
            >
              <WaterfallArt />
            </Feature>
            <Feature
              className="md:col-span-3"
              title="Versions you can diff"
              body="Snapshot a model before a negotiation round and compare any two versions driver by driver."
            />
            <Feature
              className="md:col-span-3"
              title="Secure by default"
              body="Google or magic-link sign-in, and every row protected by Postgres row-level security."
            />
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- Pricing */}
      <section id="pricing" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-6 py-24">
          {FREE_LAUNCH ? <FreeLaunchOffer /> : <PaidPlans />}
        </div>
      </section>

      {/* ------------------------------------------------------- Final CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="flex flex-col items-start gap-6 rounded-2xl bg-petrol-900 px-8 py-12 text-white sm:px-12 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-3xl leading-tight font-medium tracking-[-0.01em] sm:text-4xl">
              Bring a baseline to your next negotiation.
            </h2>
            <p className="mt-2 text-petrol-200">
              {OFFER.closing}
            </p>
          </div>
          <Button size="lg" asChild className="bg-white text-petrol-900 hover:bg-petrol-50">
            <Link href="/signup">
              {FREE_LAUNCH ? "Start free" : "Start free trial"} <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------- Pieces */

function HeroExhibit() {
  const max = Math.max(...EXHIBIT.map((r) => r.value));
  return (
    <figure>
      <div className="overflow-hidden rounded-xl border border-hairline bg-card shadow-overlay">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
          <div>
            <div className="text-sm font-semibold">OCTG casing &amp; tubing</div>
            <div className="text-xs text-muted-foreground">Should-cost per MT · USD</div>
          </div>
          <span className="rounded-sm bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
            HRC-linked
          </span>
        </div>
        <ul className="divide-y divide-hairline/70 px-5">
          {EXHIBIT.map((r) => (
            <li key={r.name} className="grid grid-cols-[1fr_auto] items-center gap-x-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{r.name}</div>
                <div className="truncate text-xs text-muted-foreground">{r.detail}</div>
              </div>
              <div className="num text-right text-sm">{usd(r.value)}</div>
              <div className="col-span-2 mt-2 h-1 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/80"
                  style={{ width: `${(r.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-3 gap-px border-t border-hairline bg-hairline">
          <Stat label="Should-cost" value={usd(SHOULD_COST)} />
          <Stat label="Supplier quote" value={usd(QUOTE)} />
          <Stat
            label="Gap"
            value={`+${usd(GAP)}`}
            sub={`${((GAP / SHOULD_COST) * 100).toFixed(1)}% above`}
            tone="text-amber-700 dark:text-amber"
          />
        </div>
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Illustrative model built from the OCTG template&rsquo;s default drivers.
      </figcaption>
    </figure>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="bg-card px-4 py-3.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`num mt-0.5 font-medium ${tone ?? ""}`}>{value}</div>
      {sub && <div className={`text-[11px] ${tone ?? "text-muted-foreground"}`}>{sub}</div>}
    </div>
  );
}

function Feature({
  title,
  body,
  className,
  children,
}: {
  title: string;
  body: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <article
      className={`flex flex-col justify-between gap-6 rounded-xl border border-hairline bg-background p-6 transition-colors hover:border-foreground/15 ${className ?? ""}`}
    >
      <div>
        <h3 className="font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
      {children}
    </article>
  );
}

/** Static, decorative index line — no chart library on the marketing page. */
function IndexArt() {
  const pts = [62, 58, 60, 55, 57, 49, 52, 47, 50, 44, 46, 41, 43, 38, 42, 36, 39, 33, 35, 30, 34, 28, 31, 26];
  const d = pts.map((y, i) => `${i === 0 ? "M" : "L"}${(i / (pts.length - 1)) * 400},${y}`).join(" ");
  return (
    <svg viewBox="0 0 400 80" className="h-20 w-full" aria-hidden preserveAspectRatio="none">
      <path d={`${d} L400,80 L0,80 Z`} className="fill-primary/10" />
      <path d={d} className="fill-none stroke-primary" strokeWidth="1.75" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Static, decorative gap waterfall: should-cost → line gaps → quote. */
function WaterfallArt() {
  // [base, height] in a 0–90 value space; first and last bars are totals.
  const bars: { y0: number; h: number; kind: "total" | "up" | "down" }[] = [
    { y0: 0, h: 52, kind: "total" },
    { y0: 52, h: 12, kind: "up" },
    { y0: 64, h: 9, kind: "up" },
    { y0: 67, h: 6, kind: "down" },
    { y0: 67, h: 11, kind: "up" },
    { y0: 0, h: 78, kind: "total" },
  ];
  const w = 400 / bars.length;
  return (
    <svg viewBox="0 0 400 90" className="h-20 w-full" aria-hidden preserveAspectRatio="none">
      {bars.map((b, i) => (
        <rect
          key={i}
          x={i * w + w * 0.22}
          width={w * 0.56}
          y={90 - b.y0 - b.h}
          height={b.h}
          rx="1.5"
          className={b.kind === "total" ? "fill-primary" : b.kind === "up" ? "fill-amber/80" : "fill-favor/80"}
        />
      ))}
    </svg>
  );
}

function PriceCard({ plan, featured }: { plan: Plan; featured?: boolean }) {
  const e = ENTITLEMENTS[plan];
  const copy = PLAN_COPY[plan];
  const name = plan.charAt(0).toUpperCase() + plan.slice(1);
  return (
    <div
      className={`flex flex-col rounded-xl border p-7 ${
        featured ? "border-primary bg-card shadow-overlay" : "border-hairline bg-background"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{name}</h3>
        {featured && <span className="text-xs font-medium text-primary">Most teams start here</span>}
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="num text-4xl font-medium tracking-tight">${e.price.monthly / 100}</span>
        <span className="text-sm text-muted-foreground">{e.price.monthly ? "/ month" : "forever"}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{copy.blurb}</p>
      <ul className="mt-6 flex-1 space-y-2.5 text-sm">
        {copy.points.map((pt) => (
          <li key={pt} className="flex gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {pt}
          </li>
        ))}
      </ul>
      <Button className="mt-8 w-full" variant={featured ? "default" : "outline"} asChild>
        <Link href="/signup">{plan === "free" ? "Create a workspace" : `Start ${TRIAL_DAYS}-day trial`}</Link>
      </Button>
    </div>
  );
}

function FreeLaunchOffer() {
  return (
    <div className="grid items-center gap-10 rounded-2xl border border-hairline bg-card p-8 sm:p-12 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <h2 className="font-display text-4xl leading-tight font-medium tracking-[-0.01em]">
          Free while we launch. Every feature.
        </h2>
        <p className="mt-4 max-w-md text-muted-foreground">
          No plans to compare and no limits to work around — the full product is open to everyone.
          No card required.
        </p>
        <Button size="lg" className="mt-8" asChild>
          <Link href="/signup">
            Create your workspace <ArrowRight />
          </Link>
        </Button>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {FREE_INCLUDES.map((pt) => (
          <li key={pt} className="flex gap-2.5 text-sm">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {pt}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PaidPlans() {
  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <h2 className="max-w-xl font-display text-4xl leading-tight font-medium tracking-[-0.01em]">
          Start with everything. Decide in a week.
        </h2>
        <p className="max-w-sm text-muted-foreground">
          Every new workspace gets the full Team plan free for {TRIAL_DAYS} days. No card. If you
          don&rsquo;t upgrade, it moves to Free and your models stay put.
        </p>
      </div>
      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {(["free", "pro", "team"] as const).map((p) => (
          <PriceCard key={p} plan={p} featured={p === "pro"} />
        ))}
      </div>
    </>
  );
}
