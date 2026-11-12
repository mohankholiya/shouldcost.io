import { cn } from "@/lib/utils";

/** The shouldcost.io wordmark: a petrol dot, the name, and a petrol `.io`. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span aria-hidden className="inline-block size-2.5 rounded-full bg-primary" />
      <span>
        shouldcost<span className="text-primary">.io</span>
      </span>
    </span>
  );
}
