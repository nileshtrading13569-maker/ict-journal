import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer size-5 shrink-0 rounded-sm border border-white/[0.18] bg-surface-2/80 transition-all duration-150 hover:border-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-primary-foreground data-[state=checked]:shadow-[0_0_12px_rgba(229,9,20,0.4)]",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className="size-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
