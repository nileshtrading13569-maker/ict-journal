import { Button } from "@/components/ui/button";
import type { MissedTrade, Trade } from "@/lib/ict-types";
import { formatLongDate, netROf } from "@/lib/journal-dates";
import { cn, formatR } from "@/lib/utils";

/**
 * The day detail shared by the month and quarter views: what was taken, what
 * was missed, and the net R for that session.
 */
export function SelectedDay({
  date,
  trades,
  missed,
  onLogTrade,
  onLogMissed,
  className,
}: {
  date: string;
  trades: Trade[];
  missed: MissedTrade[];
  onLogTrade: () => void;
  onLogMissed: () => void;
  className?: string;
}) {
  const netR = netROf(trades);
  const empty = trades.length === 0 && missed.length === 0;

  return (
    <div className={cn("border-t border-white/[0.08] pt-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] text-accent uppercase">Selected day</p>
          <h3 className="mt-1 font-display text-lg tracking-wide text-foreground">{formatLongDate(date)}</h3>
        </div>
        {empty ? null : (
          <div className="flex flex-wrap gap-1.5 text-[11px] font-medium">
            <span className="rounded-sm border border-up/30 bg-up/10 px-2 py-1 text-up">
              {trades.length} taken
            </span>
            <span className="rounded-sm border border-warn/30 bg-warn/10 px-2 py-1 text-warn">
              {missed.length} missed
            </span>
            <span
              className={cn(
                "rounded-sm border border-white/[0.1] bg-white/[0.03] px-2 py-1 font-mono tabular-nums",
                netR > 0 ? "text-up" : netR < 0 ? "text-down" : "text-muted-foreground",
              )}
            >
              {formatR(netR)}
            </span>
          </div>
        )}
      </div>

      {empty ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-white/[0.12] px-3.5 py-3">
          <p className="text-sm text-muted-foreground">No journal entries for this day.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onLogTrade}>
              Log trade
            </Button>
            <Button size="sm" variant="ghost" onClick={onLogMissed}>
              Log missed
            </Button>
          </div>
        </div>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {trades.map((trade) => (
            <li
              key={`taken-${trade.id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-up/20 bg-up/[0.05] px-3 py-2"
            >
              <span className="text-sm font-medium text-foreground">
                {trade.market} <span className="text-muted-foreground uppercase">{trade.side}</span>
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {trade.time} NY · {trade.rMultiple == null ? "Open" : formatR(trade.rMultiple)}
              </span>
            </li>
          ))}
          {missed.map((row) => (
            <li
              key={`missed-${row.id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warn/20 bg-warn/[0.05] px-3 py-2"
            >
              <span className="text-sm font-medium text-foreground">
                {row.market} <span className="text-muted-foreground uppercase">{row.side}</span>
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">{row.time} NY · Missed</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
