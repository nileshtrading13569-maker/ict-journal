import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-white/[0.09] bg-surface-2/80 px-3 text-sm text-foreground outline-none transition-all duration-[var(--motion-quick)] placeholder:text-muted-foreground/45 hover:border-white/[0.16] focus-visible:border-accent/60 focus-visible:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent/15 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
