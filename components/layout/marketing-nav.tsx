import Link from "next/link";
import { Button } from "@/components/ui/button";

export function MarketingNav() {
  return (
    <header className="flex items-center justify-between border-b border-hairline px-6 py-3">
      <Link href="/" className="font-semibold tracking-tight">
        shouldcost<span className="text-primary">.io</span>
      </Link>
      <div className="flex gap-2">
        <Button variant="ghost" asChild>
          <Link href="/login">Sign in</Link>
        </Button>
        <Button asChild>
          <Link href="/signup">Get started</Link>
        </Button>
      </div>
    </header>
  );
}
