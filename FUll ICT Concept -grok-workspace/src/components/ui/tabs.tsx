import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

/*
 * Section tabs read as a navigation strip: text on a hairline rule with a red
 * underline on the active item, rather than a segmented pill container.
 */
function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "flex w-full items-center gap-1 overflow-x-auto border-b border-white/[0.1]",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent after:opacity-0 after:transition-opacity data-[state=active]:text-foreground data-[state=active]:after:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("outline-none", className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
