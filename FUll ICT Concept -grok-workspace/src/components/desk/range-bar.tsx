import { dealingMeta, fmtPx } from "@/lib/ict-calc";
import type { DealingRange } from "@/lib/ict-types";
import { cn } from "@/lib/utils";

export function RangeBar({
  range,
  mark,
  markLabel = "Price",
}: {
  range: DealingRange;
  mark?: number | null;
  markLabel?: string;
}) {
  const meta = dealingMeta({ ...range, current: mark ?? range.current ?? range.close ?? null });
  if (!meta.span || meta.high == null || meta.low == null) {
    return (
      <p className="text-sm text-muted-foreground">Set a high and a low to map premium / discount.</p>
    );
  }
  const price = mark ?? range.current ?? range.close;
  const pct = meta.pctFromLow != null ? Math.min(1, Math.max(0, meta.pctFromLow)) : 0.5;

  return (
    <div className="space-y-2.5 rounded-lg border border-white/[0.08] bg-black/50 p-3">
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-muted-foreground">Low <span className="font-semibold text-foreground">{fmtPx(meta.low)}</span></span>
        <span className="rounded-md border border-white/[0.1] bg-white/[0.05] px-2.5 py-0.5 font-medium text-foreground shadow-sm">
          EQ {fmtPx(meta.eq)}
        </span>
        <span className="text-muted-foreground">High <span className="font-semibold text-foreground">{fmtPx(meta.high)}</span></span>
      </div>
      <div className="relative h-8 overflow-hidden rounded-sm border border-white/[0.08] bg-surface-2/60">
        <div className="absolute inset-y-0 left-0 w-1/2 border-r border-dashed border-up/30 bg-gradient-to-r from-up/[0.04] to-up/15" />
        <div className="absolute inset-y-0 right-0 w-1/2 border-l border-dashed border-down/30 bg-gradient-to-l from-down/[0.04] to-down/15" />
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/40" />
        {price != null ? (
          <div
            className="absolute top-1 bottom-1 w-1 rounded-full bg-accent shadow-[0_0_10px_rgba(229,9,20,0.9)] transition-all duration-300"
            style={{ left: `calc(${pct * 100}% - 2px)` }}
          />
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-[10px] font-semibold tracking-[0.12em] text-up uppercase">Discount · buy</span>
        <span
          className={cn(
            "rounded-sm border px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] uppercase",
            meta.location === "premium"
              ? "border-down/35 bg-down/10 text-down"
              : meta.location === "discount"
                ? "border-up/35 bg-up/10 text-up"
                : "border-white/[0.1] bg-white/[0.04] text-muted-foreground",
          )}
        >
          {markLabel}: {fmtPx(price)} · {meta.location}
        </span>
        <span className="text-[10px] font-semibold tracking-[0.12em] text-down uppercase">Premium · sell</span>
      </div>
    </div>
  );
}
