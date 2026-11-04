import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Every screen opens the same way: a red eyebrow, one serif line, one
 * sentence of context, and optional right-aligned actions. Screens that used
 * to invent their own header markup now share this.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  aside,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("stagger-in mb-7", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[10px] font-semibold tracking-[0.18em] text-[#ff6b7d] uppercase">{eyebrow}</span>
            {aside}
          </div>
          <h1 className="mt-2 font-display text-4xl leading-[1.05] tracking-tight text-foreground sm:text-5xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
