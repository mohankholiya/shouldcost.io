"use client";
import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/lib/stores/editor-store";
import type { CostNodeRow, Rollup } from "@/lib/model/types";

export type EditorSnapshot = { nodes: CostNodeRow[]; rollup: Rollup };

function readSnapshot(): EditorSnapshot {
  const s = useEditorStore.getState();
  const nodes = s.order.map((id) => s.nodes[id]).filter(Boolean) as CostNodeRow[];
  return { nodes, rollup: s.rollup };
}

/** Debounced view of the editor tree + rollup, so charts recompute at most every `delayMs`. */
export function useDebouncedEditorSnapshot(delayMs = 200): EditorSnapshot {
  const [snap, setSnap] = useState<EditorSnapshot>(() => readSnapshot());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = useEditorStore.subscribe(() => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setSnap(readSnapshot()), delayMs);
    });
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [delayMs]);

  return snap;
}
