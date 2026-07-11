import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MarketingHome() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20 text-center">
      <h1 className="text-4xl font-semibold tracking-tight text-balance">
        Should-cost models for energy procurement.
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
        Build transparent, defensible cost breakdowns for the equipment and services you buy —
        linked to live commodity indices, ready for supplier negotiation.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button asChild>
          <Link href="/signup">Start free</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/login">Sign in</Link>
        </Button>
        <Button variant="outline" asChild>
          <a href="/how-to-use.html" target="_blank" rel="noopener">See how it works</a>
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Free during beta — every feature unlocked. No card required.
      </p>
    </section>
  );
}
