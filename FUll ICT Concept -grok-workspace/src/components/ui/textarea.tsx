import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-md border border-white/[0.09] bg-surface-2/80 px-3 py-2.5 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-[var(--motion-quick)] placeholder:text-subtle hover:border-white/[0.16] focus-visible:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent/15 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
