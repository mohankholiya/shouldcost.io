import { create } from "zustand";
import type { CostNodeRow, Rollup } from "@/lib/model/types";
import { buildTree } from "@/lib/model/tree";
import { rollupLive } from "@/lib/model/rollup-live";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type State = {
  nodes: Record<string, CostNodeRow>;
  order: string[];
  selectedId: string | null;
  dirtyIds: Set<string>;
  deletedIds: string[];
  saveStatus: SaveStatus;
  rollup: Rollup;
  hydrate: (rows: CostNodeRow[]) => void;
  setCell: <K extends keyof CostNodeRow>(id: string, field: K, value: CostNodeRow[K]) => void;
  addLine: (parentId: string | null) => string;
  addGroup: (parentId: string | null) => string;
  removeNode: (id: string) => void;
  bindIndex: (id: string, indexId: string, factor: number, rateMinor: number) => void;
  select: (id: string | null) => void;
  markSaved: (ids: string[]) => void;
  setSaveStatus: (s: SaveStatus) => void;
  recompute: () => void;
};

function compute(nodes: Record<string, CostNodeRow>, order: string[]): Rollup {
  return rollupLive(buildTree(order.map((id) => nodes[id]!)));
}

export const useEditorStore = create<State>((set, get) => ({
  nodes: {},
  order: [],
  selectedId: null,
  dirtyIds: new Set(),
  deletedIds: [],
  saveStatus: "idle",
  rollup: { total: 0, byNodeId: {} },

  hydrate: (rows) => {
    const nodes: Record<string, CostNodeRow> = {};
    const order: string[] = [];
    rows.forEach((r) => {
      nodes[r.id] = r;
      order.push(r.id);
    });
    set({
      nodes,
      order,
      dirtyIds: new Set(),
      deletedIds: [],
      saveStatus: "idle",
      rollup: compute(nodes, order),
    });
  },

  setCell: (id, field, value) => {
    const current = get().nodes[id];
    if (!current) return;
    const nodes = { ...get().nodes, [id]: { ...current, [field]: value } };
    const dirty = new Set(get().dirtyIds).add(id);
    set({ nodes, dirtyIds: dirty, rollup: compute(nodes, get().order) });
  },

  addLine: (parentId) => insert(get, set, parentId, "line"),
  addGroup: (parentId) => insert(get, set, parentId, "group"),

  removeNode: (id) => {
    const nodes = { ...get().nodes };
    const removed: string[] = [];
    const rec = (target: string) => {
      removed.push(target);
      Object.values(nodes).forEach((n) => {
        if (n.parent_id === target) rec(n.id);
      });
    };
    rec(id);
    removed.forEach((rid) => delete nodes[rid]);
    const order = get().order.filter((o) => !removed.includes(o));
    // Deleting a not-yet-persisted id server-side is a harmless no-op, so track all removals.
    const dirty = new Set(get().dirtyIds);
    removed.forEach((rid) => dirty.delete(rid));
    set({
      nodes,
      order,
      dirtyIds: dirty,
      deletedIds: [...get().deletedIds, ...removed],
      rollup: compute(nodes, order),
    });
  },

  bindIndex: (id, indexId, factor, rateMinor) => {
    const current = get().nodes[id];
    if (!current) return;
    const node: CostNodeRow = {
      ...current,
      index_id: indexId,
      index_factor: factor,
      rate: rateMinor,
      rate_source: "index",
    };
    const nodes = { ...get().nodes, [id]: node };
    set({
      nodes,
      dirtyIds: new Set(get().dirtyIds).add(id),
      rollup: compute(nodes, get().order),
    });
  },

  select: (id) => set({ selectedId: id }),

  markSaved: (ids) => {
    const dirty = new Set(get().dirtyIds);
    ids.forEach((i) => dirty.delete(i));
    set({ dirtyIds: dirty, deletedIds: [], saveStatus: "saved" });
  },
  setSaveStatus: (s) => set({ saveStatus: s }),
  recompute: () => set({ rollup: compute(get().nodes, get().order) }),
}));

function insert(
  get: () => State,
  set: (p: Partial<State>) => void,
  parentId: string | null,
  node_type: "line" | "group",
): string {
  const id = crypto.randomUUID();
  const modelId = Object.values(get().nodes)[0]?.model_id ?? "";
  const row: CostNodeRow = {
    id,
    model_id: modelId,
    parent_id: parentId,
    sort_order: get().order.length,
    name: node_type === "group" ? "New group" : "New line",
    node_type,
    driver_name: null,
    quantity: node_type === "line" ? 1 : null,
    unit: null,
    rate: node_type === "line" ? 0 : null,
    rate_source: "manual",
    index_id: null,
    index_factor: null,
    formula: null,
    notes: null,
  };
  const nodes = { ...get().nodes, [id]: row };
  const order = [...get().order, id];
  set({ nodes, order, dirtyIds: new Set(get().dirtyIds).add(id), rollup: compute(nodes, order) });
  return id;
}
