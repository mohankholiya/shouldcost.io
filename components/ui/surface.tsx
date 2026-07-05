import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Surface — the canonical app surface primitive.
 *
 * Formalises the dominant hand-rolled idiom (`rounded-md border border-hairline
 * bg-card p-X`) so the ~15 sites that used it share one definition. Distinct
 * from `Card`, which is the shadcn composite (`rounded-xl shadow-sm py-6 gap-6`)
 * reserved for header/content layouts.
 *
 * `elevation` is the home of the `--shadow-overlay` token: `interactive` lifts a
 * clickable surface on hover, `raised` holds persistent elevation. The app stays
 * flat everywhere else.
 */
const surfaceVariants = cva(
  "rounded-md border border-hairline bg-card text-ink transition-shadow",
  {
    variants: {
      padding: {
        none: "",
        sm: "p-3",
        md: "p-4",
        lg: "p-5",
      },
      elevation: {
        flat: "",
        interactive: "hover:shadow-overlay hover:border-foreground/15",
        raised: "shadow-overlay",
      },
      radius: {
        md: "rounded-md",
        lg: "rounded-lg",
      },
    },
    defaultVariants: {
      padding: "md",
      elevation: "flat",
      radius: "md",
    },
  }
)

type SurfaceProps = React.ComponentProps<"div"> &
  VariantProps<typeof surfaceVariants> & {
    /** Render as another element (a, li, dl, …) without a wrapper. */
    as?: React.ElementType
  }

function Surface({
  className,
  padding,
  elevation,
  radius,
  as: Comp = "div",
  ...props
}: SurfaceProps) {
  const Component = Comp as React.ElementType

  return (
    <Component
      data-slot="surface"
      data-elevation={elevation}
      className={cn(surfaceVariants({ padding, elevation, radius }), className)}
      {...props}
    />
  )
}

export { Surface, surfaceVariants }
export type { SurfaceProps }
