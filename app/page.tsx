import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-primary">shouldcost.io</h1>
      <p className="mt-2 text-muted-foreground">
        scaffolding OK · design system live · <span className="num">1,234.56</span>
      </p>
      <div className="mt-4 flex items-center gap-3">
        <Button>Primary</Button>
        <Button variant="outline">Outline</Button>
        <Badge>draft</Badge>
      </div>
    </main>
  );
}
