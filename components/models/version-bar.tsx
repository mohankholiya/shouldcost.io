"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEditorStore } from "@/lib/stores/editor-store";
import { saveVersionAction } from "@/lib/actions/model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { VersionDiff } from "@/components/models/version-diff";
import { Surface } from "@/components/ui/surface";
import type { ModelVersion } from "@/lib/db/versions";

export function VersionBar({ modelId, versions }: { modelId: string; versions: ModelVersion[] }) {
  const total = useEditorStore((s) => s.rollup.total);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  async function save() {
    setSaving(true);
    try {
      await saveVersionAction({ modelId, note, total });
      setNote("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(-2)));

  const a = versions.find((v) => v.id === selected[0]);
  const b = versions.find((v) => v.id === selected[1]);

  return (
    <Surface padding="sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Versions</h3>
        <div className="flex items-center gap-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="h-8 w-48 text-sm"
          />
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save version"}
          </Button>
        </div>
      </div>

      {versions.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          No versions yet. Save one to snapshot the current model; select two to compare.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-hairline text-sm">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center justify-between py-1.5">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.includes(v.id)}
                  onChange={() => toggle(v.id)}
                  aria-label={`Select version ${v.version_no}`}
                />
                <span>v{v.version_no}</span>
                {v.note && <span className="text-xs text-muted-foreground">{v.note}</span>}
              </label>
              <span className="num text-xs">{formatCurrency(v.total_cost, "USD")}</span>
            </li>
          ))}
        </ul>
      )}

      {a && b && <VersionDiff a={a} b={b} />}
    </Surface>
  );
}
