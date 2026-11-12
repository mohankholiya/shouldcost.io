"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderKanban,
  TrendingUp,
  Settings,
  Scale,
  HelpCircle,
  Clapperboard,
} from "lucide-react";
import { PlanBadge, ModelQuotaIndicator } from "@/components/billing";
import { TRIAL_DAYS, type Plan } from "@/lib/entitlements";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/indices", label: "Indices", icon: TrendingUp },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

type RecentModel = { id: string; name: string };

export function Sidebar({
  recentModels = [],
  plan,
  modelCount = 0,
  trialDaysLeft = null,
  trialExpired = false,
}: {
  recentModels?: RecentModel[];
  plan: Plan;
  modelCount?: number;
  /** Days left on the 7-day full-feature trial, or null when not on one. */
  trialDaysLeft?: number | null;
  trialExpired?: boolean;
}) {
  const path = usePathname();
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-hairline bg-canvas md:flex">
      <div className="px-4 py-4 text-sm font-semibold tracking-tight">
        shouldcost<span className="text-primary">.io</span>
      </div>
      <nav className="space-y-1 p-3">
        {NAV.map((n) => {
          const active = path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-ink hover:bg-accent",
              )}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      {recentModels.length > 0 && (
        <nav className="mt-2 space-y-0.5 px-3" aria-label="Recent models">
          <div className="px-3 pb-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Recent
          </div>
          {recentModels.map((m) => {
            const active = path.startsWith(`/models/${m.id}`);
            return (
              <div key={m.id} className="group flex items-center gap-1">
                <Link
                  href={`/models/${m.id}`}
                  title={m.name}
                  className={cn(
                    "flex-1 truncate rounded-md px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-ink hover:bg-accent",
                  )}
                >
                  {m.name}
                </Link>
                <Link
                  href={`/models/${m.id}/compare`}
                  aria-label={`Compare quotes for ${m.name}`}
                  title="Compare quotes"
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Scale className="h-3.5 w-3.5" />
                </Link>
              </div>
            );
          })}
        </nav>
      )}
      <div className="mt-auto p-3">
        <a
          href="/how-to-use.html"
          target="_blank"
          rel="noopener"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-ink transition-colors hover:bg-accent"
        >
          <HelpCircle className="h-4 w-4" />
          How to use
        </a>
        <a
          href="/ad.html"
          target="_blank"
          rel="noopener"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-ink transition-colors hover:bg-accent"
        >
          <Clapperboard className="h-4 w-4" />
          Watch the ad
        </a>
      </div>
      <div className="border-t border-hairline px-3 py-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Plan
          </span>
          <PlanBadge plan={plan} trial={trialDaysLeft !== null} />
        </div>
        {trialDaysLeft !== null && (
          <TrialMeter daysLeft={trialDaysLeft} />
        )}
        {trialExpired && (
          <p className="px-1 pt-2 text-xs text-muted-foreground">
            Trial ended.{" "}
            <Link href="/settings/billing/upgrade" className="font-medium text-primary hover:underline">
              Upgrade
            </Link>
          </p>
        )}
        <ModelQuotaIndicator plan={plan} used={modelCount} />
      </div>
    </aside>
  );
}

/** Remaining-trial bar: fills down as the 7 days run out. */
function TrialMeter({ daysLeft }: { daysLeft: number }) {
  const pct = Math.min(100, Math.max(0, (daysLeft / TRIAL_DAYS) * 100));
  return (
    <div className="px-1 pt-2.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">
          <span className="num font-medium text-foreground">{daysLeft}</span> day
          {daysLeft === 1 ? "" : "s"} left
        </span>
        <Link href="/settings/billing/upgrade" className="font-medium text-primary hover:underline">
          Upgrade
        </Link>
      </div>
      <div
        className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Free trial remaining"
        aria-valuemin={0}
        aria-valuemax={TRIAL_DAYS}
        aria-valuenow={daysLeft}
      >
        <div
          className={cn("h-full rounded-full", daysLeft <= 2 ? "bg-amber" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
