"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, FolderKanban, TrendingUp, Settings, Scale } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/indices", label: "Indices", icon: TrendingUp },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

type RecentModel = { id: string; name: string };

export function Sidebar({ recentModels = [] }: { recentModels?: RecentModel[] }) {
  const path = usePathname();
  return (
    <aside className="hidden w-56 shrink-0 border-r border-hairline bg-canvas md:block">
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
    </aside>
  );
}
