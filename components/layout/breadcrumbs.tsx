import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center text-xs text-muted-foreground">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="flex items-center">
            {i > 0 && <ChevronRight className="mx-1 h-3 w-3" aria-hidden="true" />}
            {item.href && !last ? (
              <Link href={item.href} className="hover:text-foreground focus-visible:outline-none focus-visible:underline">
                {item.label}
              </Link>
            ) : (
              <span className={last ? "text-foreground" : undefined}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
