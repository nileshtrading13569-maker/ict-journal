import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  WEEKDAY_LABELS,
  formatDateKey,
  getCalendarDays,
  type DayEntryCounts,
} from "@/lib/journal-dates";
import type { Trade } from "@/lib/ict-types";
import { formatCurrency, getTradePnL } from "@/lib/tradezella-helpers";
import { formatR } from "@/lib/utils";

interface MonthGridProps {
  month: Date;
  counts: Map<string, DayEntryCounts>;
  trades?: Trade[];
  selectedDate: string;
  todayKey: string;
  onSelectDate: (dateKey: string) => void;
  compact?: boolean;
}

export function MonthGrid({
  month,
  counts,
  trades = [],
  selectedDate,
  todayKey,
  onSelectDate,
  compact = false,
}: MonthGridProps) {
  const days = getCalendarDays(month);

  // Pre-calculate daily stats for fast calendar rendering
  const dayStats = useMemo(() => {
    const map = new Map<string, { pnl: number; r: number; wins: number; losses: number; count: number }>();
    for (const t of trades) {
      const cur = map.get(t.date) ?? { pnl: 0, r: 0, wins: 0, losses: 0, count: 0 };
      cur.pnl += getTradePnL(t);
      cur.r += t.rMultiple ?? 0;
      if (t.result === "win") cur.wins += 1;
      else if (t.result === "loss") cur.losses += 1;
      cur.count += 1;
      map.set(t.date, cur);
    }
    return map;
  }, [trades]);

  return (
    <div className={cn("grid grid-cols-7", compact ? "gap-1" : "gap-1.5")}>
      {WEEKDAY_LABELS.map((day) => (
        <div
          key={day}
          className="pb-1 text-center text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase"
        >
          {day}
        </div>
      ))}
      {days.map((date, index) => {
        if (!date) return <div key={`empty-${index}`} aria-hidden="true" />;
        const dateKey = formatDateKey(date);
        const entry = counts.get(dateKey);
        const stats = dayStats.get(dateKey);
        const isSelected = dateKey === selectedDate;
        const isToday = dateKey === todayKey;

        const hasTrades = stats && stats.count > 0;
        const isProfitable = hasTrades && stats.pnl > 0;
        const isLoss = hasTrades && stats.pnl < 0;

        return (
          <button
            key={dateKey}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelectDate(dateKey)}
            className={cn(
              "group relative flex min-w-0 flex-col justify-between rounded-md border p-1 text-left transition-all",
              compact ? "min-h-12" : "min-h-16 sm:min-h-20",
              isSelected
                ? "border-accent ring-1 ring-accent bg-accent/10"
                : isProfitable
                ? "border-up/25 bg-up/[0.04] hover:border-up/50 hover:bg-up/[0.08]"
                : isLoss
                ? "border-down/25 bg-down/[0.04] hover:border-down/50 hover:bg-down/[0.08]"
                : entry && entry.missed > 0
                ? "border-warn/25 bg-warn/[0.03] hover:border-warn/50"
                : "border-white/[0.06] bg-white/[0.01] hover:border-white/20 hover:bg-white/[0.03]",
              isToday && !isSelected && "border-accent/40",
            )}
          >
            {/* Date Number and Today Tag */}
            <div className="flex items-center justify-between w-full">
              <span
                className={cn(
                  "font-mono text-[11px] font-medium leading-none",
                  isToday ? "text-accent font-bold" : "text-muted-foreground group-hover:text-foreground",
                )}
              >
                {date.getDate()}
              </span>
              {hasTrades && (
                <span className="rounded bg-black/40 px-1 py-0.2 text-[9px] font-mono text-muted-foreground">
                  {stats.count}t
                </span>
              )}
            </div>

            {/* TradeZella Daily Heatmap Metric Center */}
            {hasTrades ? (
              <div className="my-auto w-full">
                <p
                  className={cn(
                    "font-mono text-[11px] font-bold leading-tight truncate sm:text-xs",
                    isProfitable ? "text-up" : isLoss ? "text-down" : "text-foreground",
                  )}
                >
                  {formatCurrency(stats.pnl)}
                </p>
                {!compact && (
                  <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground mt-0.5">
                    <span>{formatR(stats.r)}</span>
                    <span>
                      {stats.wins}W-{stats.losses}L
                    </span>
                  </div>
                )}
              </div>
            ) : entry && entry.missed > 0 ? (
              <div className="my-auto text-[10px] text-warn font-mono">
                {entry.missed} missed
              </div>
            ) : (
              <div className="my-auto" />
            )}

            {/* Bottom Status Dots */}
            <div className="flex items-center gap-1 h-1">
              {entry && entry.taken > 0 && <span className="size-1 rounded-full bg-up" />}
              {entry && entry.missed > 0 && <span className="size-1 rounded-full bg-warn" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
