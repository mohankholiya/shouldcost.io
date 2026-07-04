import type { CostNodeRow } from "@/lib/model/types";

export type VersionDiff = {
  added: CostNodeRow[];
  removed: CostNodeRow[];
  changed: { id: string; name: string; fields: { field: string; from: unknown; to: unknown }[] }[];
};

const FIELDS: (keyof CostNodeRow)[] = [
  "name",
  "quantity",
  "unit",
  "rate",
  "rate_source",
  "index_id",
  "index_factor",
  "formula",
];

export function diffVersions(a: CostNodeRow[], b: CostNodeRow[]): VersionDiff {
  const aById = new Map(a.map((r) => [r.id, r]));
  const bById = new Map(b.map((r) => [r.id, r]));
  const added = b.filter((r) => !aById.has(r.id));
  const removed = a.filter((r) => !bById.has(r.id));
  const changed: VersionDiff["changed"] = [];
  for (const [id, bt] of bById) {
    const at = aById.get(id);
    if (!at) continue;
    const fields = FIELDS.flatMap((f) =>
      at[f] !== bt[f] ? [{ field: f as string, from: at[f], to: bt[f] }] : [],
    );
    if (fields.length) changed.push({ id, name: bt.name, fields });
  }
  return { added, removed, changed };
}
