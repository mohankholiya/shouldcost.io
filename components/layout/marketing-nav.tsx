import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/layout/wordmark";

const LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/#pricing", label: "Pricing" },
] as const;

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-hairline/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-6">
        <Link href="/" aria-label="shouldcost.io home">
          <Wordmark />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-foreground">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/signup">Start free trial</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
