"use client";

import { useState } from "react";
import { DensityToggle, type Density } from "@/components/shared/density-toggle";
import { SavedIndicator } from "@/components/shared/saved-indicator";
import { UserMenu } from "@/components/layout/user-menu";

export function Topbar({ orgName }: { orgName: string }) {
  const [density, setDensity] = useState<Density>("compact");
  return (
    <header
      data-density={density}
      className="flex h-14 items-center justify-between border-b border-hairline px-4"
    >
      <div className="text-sm text-muted-foreground">{orgName}</div>
      <div className="flex items-center gap-4">
        <DensityToggle value={density} onChange={setDensity} />
        <SavedIndicator status="idle" />
        <UserMenu />
      </div>
    </header>
  );
}
