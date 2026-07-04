import { cn } from "@/lib/utils";
import { Check, Loader2, AlertCircle } from "lucide-react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function SavedIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  const map = {
    saving: { icon: Loader2, text: "Saving…", className: "text-muted-foreground", spin: true },
    saved: { icon: Check, text: "Saved", className: "text-favor", spin: false },
    error: { icon: AlertCircle, text: "Save failed", className: "text-danger", spin: false },
  }[status];
  const Icon = map.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", map.className)}>
      <Icon className={cn("h-3 w-3", map.spin && "animate-spin")} />
      {map.text}
    </span>
  );
}
