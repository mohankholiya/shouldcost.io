import Link from "next/link";
import { Wordmark } from "@/components/layout/wordmark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="main"
      className="relative isolate flex min-h-dvh flex-col items-center justify-center bg-canvas p-6"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(700px_380px_at_50%_-5%,var(--color-petrol-50),transparent_70%)] dark:opacity-0"
      />
      <Link href="/" aria-label="shouldcost.io home" className="mb-8">
        <Wordmark />
      </Link>
      <div className="w-full max-w-sm rounded-xl border border-hairline bg-card p-7 shadow-overlay">
        {children}
      </div>
      <p className="mt-6 max-w-sm text-center text-xs text-muted-foreground">
        Should-cost outputs are estimates for negotiation support, not certified cost audits.
      </p>
    </main>
  );
}
