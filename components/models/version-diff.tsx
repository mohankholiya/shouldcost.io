"use client";

import { diffVersions } from "@/lib/model/diff";
import { formatCurrency } from "@/lib/format";
import type { ModelVersion } from "@/lib/db/versions";

function fmt(field: string, v: unknown): string {
  if (field === "rate" && typeof v === "number") return formatCurrency(v, "USD");
  return v === null || v === undefined ? "—" : String(v);
}

export function VersionDiff({ a, b }: { a: ModelVersion; b: ModelVersion }) {
  const d = diffVersions(a.snapshot_json, b.snapshot_json);
  const nothing = !d.added.length && !d.removed.length && !d.changed.length;

  return (
    <div className="mt-3 space-y-1 rounded-md border border-hairline p-3 text-sm">
      <div className="mb-1 text-xs text-muted-foreground">
        Comparing v{a.version_no} → v{b.version_no}
      </div>
      {nothing && <p className="text-xs text-muted-foreground">No differences.</p>}
      {d.added.map((n) => (
        <div key={n.id} className="text-favor">
          + {n.name}
        </div>
      ))}
      {d.removed.map((n) => (
        <div key={n.id} className="text-muted-foreground line-through">
          − {n.name}
        </div>
      ))}
      {d.changed.map((c) => (
        <div key={c.id}>
          <span className="font-medium">{c.name}</span>
          {c.fields.map((f, i) => (
            <span key={i} className="ml-2 text-xs text-muted-foreground">
              {f.field}: {fmt(f.field, f.from)} → {fmt(f.field, f.to)}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
