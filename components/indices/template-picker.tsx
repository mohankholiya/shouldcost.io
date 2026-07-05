"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ALL_TEMPLATES } from "@/lib/seed/templates";
import { instantiateModelAction } from "@/lib/actions/model";

export function TemplatePicker({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function choose(name: string, templateSlug?: string) {
    setPending(templateSlug ?? "__blank__");
    try {
      const { id } = await instantiateModelAction({ projectId, name, templateSlug });
      router.push(`/models/${id}`);
    } finally {
      setPending(null);
    }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button>
          <Plus className="mr-1 h-4 w-4" />
          New model
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Start a new model</SheetTitle>
          <SheetDescription>
            Choose a category template to pre-fill the cost breakdown, or start from a blank model.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-2 p-4">
          <button
            onClick={() => choose("Untitled model")}
            disabled={pending !== null}
            className="w-full rounded-md border border-dashed border-hairline p-3 text-left text-sm hover:bg-accent disabled:opacity-50"
          >
            <div className="font-medium">Blank model</div>
            <div className="text-xs text-muted-foreground">Build the CBS from scratch</div>
          </button>

          {ALL_TEMPLATES.map((t) => (
            <button
              key={t.slug}
              onClick={() => choose(t.name, t.slug)}
              disabled={pending !== null}
              className="w-full rounded-md border border-hairline p-3 text-left hover:bg-accent disabled:opacity-50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{t.name}</span>
                {t.draft && <Badge variant="secondary">draft</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">
                {t.industry} · per {t.unit}
              </div>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
