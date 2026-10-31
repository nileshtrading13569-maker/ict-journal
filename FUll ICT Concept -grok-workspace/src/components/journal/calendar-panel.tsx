import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, TrendingUp, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/desk/fields";
import { StatTile } from "@/components/desk/stat-tile";
import type { DeskData, MissedTrade, Trade } from "@/lib/ict-types";
import {
  activeDayCount,
  buildEntriesByDate,
  formatDateKey,
  netROf,
} from "@/lib/journal-dates";
import { formatR } from "@/lib/utils";
import { formatCurrency, getTradePnL } from "@/lib/tradezella-helpers";
import { MonthGrid } from "./month-grid";
import { SelectedDay } from "./selected-day";
import { DailyDrawer } from "./daily-drawer";
import { TradeInspectorDialog } from "./trade-inspector-dialog";

export function CalendarPanel({
  trades,
  missed,
  models,
  onLogTrade,
  onLogMissed,
  onEditTrade,
  onDeleteTrade,
  onUpdateTrade,
}: {
  trades: Trade[];
  missed: MissedTrade[];
  models?: DeskData["models"];
  onLogTrade: (date?: string) => void;
  onLogMissed: (date?: string) => void;
  onEditTrade?: (trade: Trade) => void;
  onDeleteTrade?: (id: string) => void;
  onUpdateTrade?: (trade: Trade) => void;
}) {
  const todayKey = formatDateKey(new Date());
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [dailyDrawerOpen, setDailyDrawerOpen] = useState(false);
  const [inspectTrade, setInspectTrade] = useState<Trade | null>(null);

  const counts = useMemo(() => buildEntriesByDate(trades, missed), [trades, missed]);
  const monthKey = formatDateKey(month).slice(0, 7);
  const monthTrades = trades.filter((trade) => trade.date.startsWith(monthKey));
  const monthMissed = missed.filter((trade) => trade.date.startsWith(monthKey));
  const netR = netROf(monthTrades);
  const activeDays = activeDayCount(monthTrades, monthMissed);

  const monthDollarPnL = monthTrades.reduce((sum, t) => sum + getTradePnL(t), 0);
  const wins = monthTrades.filter((t) => t.result === "win").length;
  const winRate = monthTrades.length > 0 ? Math.round((wins / monthTrades.length) * 100) : 0;

  const shift = (delta: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    setMonth(next);
    setSelectedDate(formatDateKey(next));
  };

  const handleSelectDate = (dateKey: string) => {
    setSelectedDate(dateKey);
    setDailyDrawerOpen(true);
  };

  return (
    <>
      <Panel
        kicker="TradeZella Performance Heatmap"
        title={month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        action={
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date();
                setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                setSelectedDate(todayKey);
              }}
            >
              Today
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => shift(-1)}>
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => shift(1)}>
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        }
      >
        {/* Month Summary Metric Strip */}
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile
            label="Month Net P&L"
            value={formatCurrency(monthDollarPnL)}
            tone={monthDollarPnL > 0 ? "up" : monthDollarPnL < 0 ? "down" : "default"}
          />
          <StatTile
            label="Net R"
            value={formatR(netR)}
            tone={netR > 0 ? "up" : netR < 0 ? "down" : "default"}
          />
          <StatTile
            label="Win Rate"
            value={monthTrades.length > 0 ? `${winRate}%` : "—"}
            tone={winRate >= 50 ? "up" : "warn"}
          />
          <StatTile
            label="Active Days"
            value={`${activeDays} days`}
            tone="default"
          />
        </div>

        {/* Heatmap Grid */}
        <MonthGrid
          month={month}
          counts={counts}
          trades={trades}
          selectedDate={selectedDate}
          todayKey={todayKey}
          onSelectDate={handleSelectDate}
        />

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] pt-3 text-[11px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded bg-up/40 border border-up/70" /> Profitable Day
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded bg-down/40 border border-down/70" /> Loss Day
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded bg-white/10 border border-white/20" /> No trades / BE
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Tip: Click any calendar day to pop open its full Daily Journal & executed trades.
          </p>
        </div>

        {/* Selected Day Quick Inline Preview */}
        <SelectedDay
          date={selectedDate}
          trades={trades.filter((t) => t.date === selectedDate)}
          missed={missed.filter((m) => m.date === selectedDate)}
          onLogTrade={() => onLogTrade(selectedDate)}
          onLogMissed={() => onLogMissed(selectedDate)}
          className="mt-4"
        />
      </Panel>

      {/* Daily Drawer Modal (Popper) */}
      <DailyDrawer
        date={selectedDate}
        open={dailyDrawerOpen}
        onOpenChange={setDailyDrawerOpen}
        trades={trades}
        missed={missed}
        onSelectTrade={(trade) => setInspectTrade(trade)}
        onLogTrade={(date) => onLogTrade(date)}
        onLogMissed={(date) => onLogMissed(date)}
      />

      {/* Trade Inspector Popper with Candlestick Canvas Chart */}
      <TradeInspectorDialog
        trade={inspectTrade}
        open={Boolean(inspectTrade)}
        onOpenChange={(open) => !open && setInspectTrade(null)}
        models={models ?? []}
        onEditTrade={(t) => onEditTrade?.(t)}
        onDeleteTrade={(id) => onDeleteTrade?.(id)}
        onUpdateTrade={(t) => onUpdateTrade?.(t)}
      />
    </>
  );
}
