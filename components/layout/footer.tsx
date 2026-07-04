export function Footer() {
  return (
    <footer className="border-t border-hairline px-6 py-6 text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-2">
        <div className="flex gap-4">
          <a className="hover:text-foreground" href="mailto:mohan.kholiya@gmail.com">
            Email
          </a>
          <a
            className="hover:text-foreground"
            href="https://www.linkedin.com/"
            rel="noopener noreferrer"
            target="_blank"
          >
            LinkedIn
          </a>
        </div>
        <p>
          Should-cost outputs are estimates for negotiation support, not certified cost audits.
        </p>
        <p>© {new Date().getFullYear()} shouldcost.io</p>
      </div>
    </footer>
  );
}
