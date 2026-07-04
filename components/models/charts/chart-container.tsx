"use client";

import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shared chart shell: title, copy-data (CSV to clipboard), and empty state. */
export function ChartContainer({
  title,
  data,
  children,
}: {
  title: string;
  data: Record<string, unknown>[];
  children?: React.ReactNode;
}) {
  function copyCsv() {
    if (!data.length) return;
    const cols = Object.keys(data[0]!);
    const lines = [cols.join(","), ...data.map((r) => cols.map((c) => String(r[c] ?? "")).join(","))];
    void navigator.clipboard?.writeText(lines.join("\n"));
  }

  return (
    <div className="rounded-md border border-hairline bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <Button size="icon-xs" variant="ghost" aria-label="Copy data" onClick={copyCsv}>
          <Copy className="h-3 w-3" />
        </Button>
      </div>
      {data.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">No data yet.</p>
      ) : (
        children
      )}
    </div>
  );
}
