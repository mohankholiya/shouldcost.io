"use client";

import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useEditorStore } from "@/lib/stores/editor-store";
import { buildTree } from "@/lib/model/tree";
import type { TreeNode } from "@/lib/model/types";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { TextCell } from "./cells/text-cell";
import { NumberCell } from "./cells/number-cell";
import { MoneyCell } from "./cells/money-cell";
import { RateSourceCell } from "./cells/rate-source-cell";
import { IndexBinding } from "@/components/models/index-binding";

type Row = { node: TreeNode; depth: number };

const col = createColumnHelper<Row>();

export function CbsTree() {
  const nodes = useEditorStore((s) => s.nodes);
  const order = useEditorStore((s) => s.order);
  const rollup = useEditorStore((s) => s.rollup);
  const addLine = useEditorStore((s) => s.addLine);
  const addGroup = useEditorStore((s) => s.addGroup);
  const removeNode = useEditorStore((s) => s.removeNode);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const rows = useMemo<Row[]>(() => {
    const tree = buildTree(order.map((id) => nodes[id]!).filter(Boolean));
    const out: Row[] = [];
    const walk = (ns: TreeNode[], depth: number) => {
      for (const n of ns) {
        out.push({ node: n, depth });
        if (!collapsed.has(n.id)) walk(n.children, depth + 1);
      }
    };
    walk(tree.roots, 0);
    return out;
  }, [nodes, order, collapsed]);

  const columns = useMemo(
    () => [
      col.display({
        id: "name",
        header: "Item",
        cell: ({ row }) => {
          const { node, depth } = row.original;
          const isGroup = node.node_type === "group";
          return (
            <div className="flex items-center gap-1" style={{ paddingLeft: depth * 16 }}>
              {isGroup ? (
                <button
                  onClick={() => toggle(node.id)}
                  aria-label={collapsed.has(node.id) ? "Expand" : "Collapse"}
                  className="text-muted-foreground"
                >
                  {collapsed.has(node.id) ? (
                    <ChevronRight className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              ) : (
                <span className="inline-block w-3" />
              )}
              <TextCell id={node.id} field="name" />
            </div>
          );
        },
      }),
      col.display({
        id: "driver",
        header: "Driver",
        cell: ({ row }) =>
          row.original.node.node_type === "line" ? (
            <TextCell id={row.original.node.id} field="driver_name" placeholder="—" />
          ) : null,
      }),
      col.display({
        id: "qty",
        header: "Qty",
        cell: ({ row }) =>
          row.original.node.node_type === "line" && !row.original.node.formula ? (
            <NumberCell id={row.original.node.id} />
          ) : null,
      }),
      col.display({
        id: "unit",
        header: "Unit",
        cell: ({ row }) =>
          row.original.node.node_type === "line" ? (
            <TextCell id={row.original.node.id} field="unit" placeholder="—" />
          ) : null,
      }),
      col.display({
        id: "rate",
        header: "Rate",
        cell: ({ row }) => {
          const n = row.original.node;
          if (n.node_type !== "line") return null;
          if (n.formula) return <span className="text-xs text-muted-foreground">{n.formula}</span>;
          if (n.rate_source === "index") return <IndexBinding id={n.id} />;
          return <MoneyCell id={n.id} />;
        },
      }),
      col.display({
        id: "source",
        header: "Source",
        cell: ({ row }) => {
          const n = row.original.node;
          return n.node_type === "line" && !n.formula ? <RateSourceCell id={n.id} /> : null;
        },
      }),
      col.display({
        id: "total",
        header: "Total",
        cell: ({ row }) => (
          <span className="num">
            {formatCurrency(rollup.byNodeId[row.original.node.id] ?? 0, "USD")}
          </span>
        ),
      }),
      col.display({
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const n = row.original.node;
          return (
            <div className="flex gap-1">
              {n.node_type === "group" && (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Add line"
                  onClick={() => addLine(n.id)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              )}
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label="Remove"
                onClick={() => removeNode(n.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          );
        },
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rollup, collapsed],
  );

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="overflow-hidden rounded-md border border-hairline">
      <table className="w-full text-sm" data-density="compact">
        <thead className="border-b border-hairline bg-canvas">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground"
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => {
            const isGroup = r.original.node.node_type === "group";
            return (
              <tr key={r.id} className={isGroup ? "bg-canvas font-medium" : ""}>
                {r.getVisibleCells().map((c) => (
                  <td key={c.id} className="border-b border-hairline px-2 py-0.5 align-middle">
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-hairline font-semibold">
            <td className="px-2 py-2" colSpan={6}>
              Should-cost total
            </td>
            <td className="num px-2 py-2">{formatCurrency(rollup.total, "USD")}</td>
            <td />
          </tr>
        </tfoot>
      </table>
      <div className="flex gap-2 p-2">
        <Button size="sm" variant="outline" onClick={() => addGroup(null)}>
          <Plus className="mr-1 h-3 w-3" />
          Add group
        </Button>
      </div>
    </div>
  );
}
