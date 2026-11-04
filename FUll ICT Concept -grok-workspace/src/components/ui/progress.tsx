import { cn } from "@/lib/utils";

/*
 * A thin high-contrast bar, never wider than it needs to be. Over 80% it turns
 * amber-to-red because that is the account-rule danger zone.
 */
function Progress({
  value = 0,
  className,
  "aria-label": ariaLabel = "Progress",
}: {
  value?: number;
  className?: string;
  "aria-label"?: string;
}) {
  const v = Math.min(100, Math.max(0, value));
  const danger = v > 80;
  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("relative h-1 w-full overflow-hidden rounded-full bg-white/[0.07]", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300 ease-[var(--ease-cinema)]",
          danger
            ? "bg-gradient-to-r from-warn to-accent shadow-[0_0_10px_rgba(229,9,20,0.45)]"
            : "bg-accent shadow-[0_0_10px_rgba(229,9,20,0.35)]",
        )}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export { Progress };
