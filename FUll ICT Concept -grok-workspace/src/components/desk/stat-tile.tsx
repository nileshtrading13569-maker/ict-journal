import { cn } from "@/lib/utils";

type Tone = "default" | "up" | "down" | "warn" | "accent";

const TONE: Record<Tone, string> = {
  default: "text-foreground",
  up: "text-up",
  down: "text-down",
  warn: "text-warn",
  accent: "text-accent",
};

/**
 * Label-over-value tile used for every inline metric across the desk, so a
 * figure in the journal reads the same weight as one in analytics.
 */
export function StatTile({
  label,
  value,
  tone = "default",
  hint,
  className,
  mono = true,
}: {
  label: string;
  value: string;
  tone?: Tone;
  hint?: string;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div className={cn("spotlight-red rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-2", className)}>
      <p className="text-[9px] font-semibold tracking-[0.14em] text-muted-foreground uppercase sm:text-[10px]">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate text-sm font-semibold",
          mono && "font-mono tabular-nums",
          TONE[tone],
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 truncate text-[10px] text-subtle">{hint}</p> : null}
    </div>
  );
}
