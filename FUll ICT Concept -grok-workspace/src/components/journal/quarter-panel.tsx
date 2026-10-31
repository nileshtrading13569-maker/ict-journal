import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/desk/fields";
import { StatTile } from "@/components/desk/stat-tile";
import type { MissedTrade, Trade } from "@/lib/ict-types";
import {
  activeDayCount,
  buildEntriesByDate,
  formatDateKey,
  getQuarterStart,
  netROf,
} from "@/lib/journal-dates";
import { cn, formatR } from "@/lib/utils";
import { MonthGrid } from "./month-grid";
import { SelectedDay } from "./selected-day";

export function QuarterPanel({
  trades,
  missed,
  onLogTrade,
  onLogMissed,
}: {
  trades: Trade[];
  missed: MissedTrade[];
  onLogTrade: () => void;
  onLogMissed: () => void;
}) {
  const todayKey = formatDateKey(new Date());
  const [quarterStart, setQuarterStart] = useState(() => getQuarterStart(new Date()));
  const [selectedDate, setSelectedDate] = useState(todayKey);

  const counts = useMemo(() => buildEntriesByDate(trades, missed), [trades, missed]);

  const months = Array.from({ length: 3 }, (_, index) => {
    const month = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + index, 1);
    const key = formatDateKey(month).slice(0, 7);
    const monthTrades = trades.filter((trade) => trade.date.startsWith(key));
    const monthMissed = missed.filter((row) => row.date.startsWith(key));
    return {
      month,
      key,
      trades: monthTrades,
      missed: monthMissed,
      netR: netROf(monthTrades),
      activeDays: activeDayCount(monthTrades, monthMissed),
    };
  });

  const quarterTrades = months.flatMap((month) => month.trades);
  const quarterMissed = months.flatMap((month) => month.missed);
  const quarterNetR = months.reduce((total, month) => total + month.netR, 0);
  const quarterActiveDays = activeDayCount(quarterTrades, quarterMissed);

  const shift = (delta: number) =>
    setQuarterStart(new Date(quarterStart.getFullYear(), quarterStart.getMonth() + delta, 1));

  return (
    <Panel
      kicker="Quarter overview"
      title={`Q${Math.floor(quarterStart.getMonth() / 3) + 1} ${quarterStart.getFullYear()}`}
      action={
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setQuarterStart(getQuarterStart(new Date()))}
          >
            This quarter
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous quarter" onClick={() => shift(-3)}>
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Next quarter" onClick={() => shift(3)}>
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <StatTile label="Taken" value={String(quarterTrades.length)} tone="up" />
        <StatTile label="Missed" value={String(quarterMissed.length)} tone="warn" />
        <StatTile
          label="Net R"
          value={formatR(quarterNetR)}
          tone={quarterNetR > 0 ? "up" : quarterNetR < 0 ? "down" : "default"}
        />
        <StatTile label="Active days" value={String(quarterActiveDays)} />
      </div>

      <div className="grid gap-2.5 lg:grid-cols-3">
        {months.map(({ month, key, netR, activeDays }) => (
          <section key={key} aria-label={`${month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}`}>
            <div className="mb-2 flex items-end justify-between gap-2">
              <div>
                <h3 className="font-display text-lg leading-none tracking-wide text-foreground">
                  {month.toLocaleDateString(undefined, { month: "long" })}
                </h3>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {activeDays} active {activeDays === 1 ? "day" : "days"}
                </p>
              </div>
              <span
                className={cn(
                  "font-mono text-sm font-semibold tabular-nums",
                  netR > 0 ? "text-up" : netR < 0 ? "text-down" : "text-muted-foreground",
                )}
              >
                {formatR(netR)}
              </span>
            </div>
            <MonthGrid
              month={month}
              counts={counts}
              selectedDate={selectedDate}
              todayKey={todayKey}
              onSelectDate={setSelectedDate}
              compact
            />
          </section>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-up" aria-hidden="true" /> Taken
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-warn" aria-hidden="true" /> Missed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" /> Today
        </span>
      </div>

      <SelectedDay
        className="mt-5"
        date={selectedDate}
        trades={trades.filter((trade) => trade.date === selectedDate)}
        missed={missed.filter((row) => row.date === selectedDate)}
        onLogTrade={onLogTrade}
        onLogMissed={onLogMissed}
      />
    </Panel>
  );
}
