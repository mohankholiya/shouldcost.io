"use client";

import { useEditorStore } from "@/lib/stores/editor-store";
import { Input } from "@/components/ui/input";

type TextField = "name" | "driver_name" | "unit";

export function TextCell({
  id,
  field,
  placeholder,
}: {
  id: string;
  field: TextField;
  placeholder?: string;
}) {
  const value = useEditorStore((s) => s.nodes[id]?.[field] ?? "");
  const setCell = useEditorStore((s) => s.setCell);
  return (
    <Input
      value={value ?? ""}
      placeholder={placeholder}
      aria-label={field}
      onChange={(e) => setCell(id, field, e.target.value)}
      className="h-7 border-0 bg-transparent px-1 shadow-none focus-visible:ring-1"
    />
  );
}
