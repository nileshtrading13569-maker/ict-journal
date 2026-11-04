import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  hint: string;
  icon?: LucideIcon;
  variant?: "default" | "up" | "down" | "warn";
  className?: string;
}

/*
 * A billboard tile: one figure, one label, one caption. Hovering lifts the
 * surface a hair and lights the icon — the only motion Netflix-style cards use.
 */
export function KpiCard({ label, value, hint, icon: Icon, variant = "default", className }: KpiCardProps) {
  const tone =
    variant === "up"
      ? "text-up"
      : variant === "down"
        ? "text-down"
        : variant === "warn"
          ? "text-warn"
          : "text-foreground";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-white/[0.09] bg-card/85 p-4 transition-all duration-300 ease-[var(--ease-cinema)] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent hover:-translate-y-0.5 hover:border-white/[0.2] hover:bg-surface-2/80 sm:p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
        {Icon ? (
          <span className="flex size-6 items-center justify-center rounded-sm border border-white/[0.08] text-muted-foreground transition-colors group-hover:border-accent/40 group-hover:text-accent">
            <Icon className="size-3.5" />
          </span>
        ) : null}
      </div>
      <p className={cn("mt-3 font-mono text-2xl font-bold tracking-tight tabular-nums sm:text-3xl", tone)}>
        {value}
      </p>
      <div className="mt-2.5 flex items-center gap-1.5 border-t border-white/[0.05] pt-2.5">
        <span
          className={cn(
            "inline-block size-1 rounded-full",
            variant === "up" ? "bg-up" : variant === "down" ? "bg-down" : "bg-accent",
          )}
        />
        <p className="truncate text-[11px] font-medium text-[#a1a1aa]">{hint}</p>
      </div>
    </div>
  );
}
