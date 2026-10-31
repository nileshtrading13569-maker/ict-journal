import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/*
 * Rectangular status tags instead of pills: at this density they read as
 * terminal labels and sit on the same 4px radius grid as the rest of the UI.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] leading-4 transition-colors duration-150",
  {
    variants: {
      variant: {
        default: "bg-white/[0.04] text-foreground/75 border-white/[0.1]",
        accent: "bg-accent/15 text-accent border-accent/35",
        up: "bg-up/10 text-up border-up/30",
        down: "bg-down/10 text-down border-down/30",
        warn: "bg-warn/10 text-warn border-warn/30",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
