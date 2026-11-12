import { Wordmark } from "@/components/layout/wordmark";

export function Footer() {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 text-muted-foreground sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Wordmark className="text-sm text-foreground" />
          <p className="max-w-sm text-xs">
            Should-cost outputs are estimates for negotiation support, not certified cost audits.
          </p>
          <p className="text-xs">© {new Date().getFullYear()} shouldcost.io</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
          <a className="transition-colors hover:text-foreground" href="/how-to-use.html" target="_blank" rel="noopener">
            How-to guide
          </a>
          <a className="transition-colors hover:text-foreground" href="mailto:mohan.kholiya@gmail.com">
            Contact
          </a>
          <a
            className="transition-colors hover:text-foreground"
            href="https://www.linkedin.com/in/mohankholiya"
            rel="noopener noreferrer"
            target="_blank"
          >
            LinkedIn
          </a>
        </nav>
      </div>
    </footer>
  );
}
