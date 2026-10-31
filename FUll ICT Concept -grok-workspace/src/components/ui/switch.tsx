import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 items-center rounded-sm border border-white/[0.12] transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=checked]:border-accent/60 data-[state=checked]:bg-accent data-[state=unchecked]:bg-surface-2",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-3.5 translate-x-0.5 rounded-xs bg-foreground transition-transform data-[state=checked]:translate-x-4.5 data-[state=checked]:bg-accent-foreground",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
