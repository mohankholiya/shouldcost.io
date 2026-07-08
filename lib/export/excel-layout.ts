import type { CostNodeRow } from "@/lib/model/types";

/**
 * Shared layout helpers for the XLSX/PDF exporters (Phase 3B). Pure, no I/O.
 *
 * The CBS tree is flattened depth-first (by `sort_order`) into a stable row
 * order; each `OrderedRow` carries its depth (`level`) and a 1-based
 * `rowNumber` within the data block (callers offset by their header-row count).
 * The `CellAddressMap` lets formula writers resolve a node's parent/children
 * without rebuilding the tree — exactly the structure the live-formula
 * generator needs (group SUMs, named-group lookups, bare-% running totals).
 */

export interface OrderedRow {
  node: CostNodeRow;
  /** Depth in the tree; roots are level 0. */
  level: number;
  /** 1-based index within the flattened data block (first data row = 1). */
  rowNumber: number;
}

/** Synthetic id under which root nodes are grouped, so the ancestor walk used
 *  for bare-`"N%"` running totals treats top-level siblings uniformly. */
export const ROOT_PARENT = "__root__";

export interface CellAddressMap {
  /** Parent id of a node — `ROOT_PARENT` for roots, `null` for `ROOT_PARENT`. */
  parentOf: (nodeId: string) => string | null;
  /** Ordered direct-child ids of a node (or the roots, for `ROOT_PARENT`). */
  childrenOf: (nodeId: string) => string[];
  /** All node ids in depth-first order. */
  readonly order: readonly string[];
}

export interface FlattenedTree {
  rows: OrderedRow[];
  address: CellAddressMap;
}

/**
 * Flatten `nodes` depth-first by `sort_order`. Roots are nodes whose
 * `parent_id` is null OR refers to a node missing from the set (mirrors
 * `buildTree` in `lib/model/tree.ts`). Returns the ordered rows plus a
 * cell-address map for formula generation.
 */
export function flattenTree(nodes: CostNodeRow[]): FlattenedTree {
  const byId = new Map<string, CostNodeRow>();
  for (const n of nodes) byId.set(n.id, n);

  // children index — every node keyed under its effective parent
  const children = new Map<string, string[]>();
  const ensure = (key: string) => {
    const existing = children.get(key);
    if (existing) return existing;
    const created: string[] = [];
    children.set(key, created);
    return created;
  };
  ensure(ROOT_PARENT);
  const parentOf = new Map<string, string>();
  for (const n of nodes) {
    const parent = n.parent_id && byId.has(n.parent_id) ? n.parent_id : ROOT_PARENT;
    parentOf.set(n.id, parent);
    ensure(parent).push(n.id);
  }

  // sort each child list by sort_order (stable for ties)
  for (const list of children.values()) {
    list.sort((a, b) => (byId.get(a)!.sort_order ?? 0) - (byId.get(b)!.sort_order ?? 0));
  }

  const rows: OrderedRow[] = [];
  const order: string[] = [];
  const walk = (parentId: string, level: number) => {
    for (const id of children.get(parentId) ?? []) {
      const node = byId.get(id)!;
      rows.push({ node, level, rowNumber: rows.length + 1 });
      order.push(id);
      walk(id, level + 1);
    }
  };
  walk(ROOT_PARENT, 0);

  return {
    rows,
    address: {
      parentOf: (id: string) => parentOf.get(id) ?? null,
      childrenOf: (id: string) => children.get(id) ?? [],
      order,
    },
  };
}

/**
 * Amount cells whose sum is the "running subtotal before" `nodeId` — i.e. the
 * set `rollupLive` would have accumulated in `ctx.running` when it reaches this
 * node. For a bare `"N%"` / `"N% margin"` line, the live Excel formula sums
 * exactly these cells. Walks up the ancestor chain: at each level it collects
 * the amount cells of the prior siblings of the child-on-the-path-to-`nodeId`.
 * Disjoint by construction, so no double counting.
 *
 * `amountCell` maps a nodeId to its worksheet amount-cell address string.
 */
export function runningTotalBefore(
  nodeId: string,
  address: CellAddressMap,
  amountCell: (id: string) => string,
): string[] {
  const cells: string[] = [];
  let current = nodeId;
  let parent = address.parentOf(current);
  while (parent !== null) {
    const siblings = address.childrenOf(parent);
    const idx = siblings.indexOf(current);
    for (let i = 0; i < idx; i++) {
      const sib = siblings[i];
      if (sib !== undefined) cells.push(amountCell(sib));
    }
    current = parent;
    parent = address.parentOf(current);
  }
  return cells;
}
