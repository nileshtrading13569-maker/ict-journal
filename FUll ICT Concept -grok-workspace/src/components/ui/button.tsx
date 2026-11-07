import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "spotlight-red inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-[var(--motion-quick)] ease-[var(--ease-cinema)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 active:not-disabled:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "btn-primary-action bg-accent text-accent-foreground font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] hover:opacity-90 active:opacity-100",
        secondary:
          "bg-surface-2 text-foreground/90 border border-white/[0.09] hover:bg-surface-3 hover:border-white/[0.18]",
        outline:
          "bg-transparent text-foreground/90 border border-white/[0.14] hover:bg-white/[0.06] hover:border-white/[0.3]",
        ghost: "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
        destructive:
          "bg-down/12 text-down border border-down/35 hover:bg-down/20 focus-visible:ring-down/50",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8.5 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "size-10",
        "icon-sm": "size-8.5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
