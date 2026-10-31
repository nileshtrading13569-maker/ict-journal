import { useMemo } from "react";
import {
  CalendarDays,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Smile,
  Shield,
  Star,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { MissedTrade, Trade } from "@/lib/ict-types";
import { formatLongDate, netROf } from "@/lib/journal-dates";
import { formatCurrency, getTradePnL, getTradeHoldDuration } from "@/lib/tradezella-helpers";
import { formatR } from "@/lib/utils";

interface DailyDrawerProps {
  date: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trades: Trade[];
  missed: MissedTrade[];
  onSelectTrade: (trade: Trade) => void;
  onLogTrade: (date?: string) => void;
  onLogMissed: (date?: string) => void;
}

export function DailyDrawer({
  date,
  open,
  onOpenChange,
  trades,
  missed,
  onSelectTrade,
  onLogTrade,
  onLogMissed,
}: DailyDrawerProps) {
  if (!date) return null;

  const dayTrades = useMemo(() => trades.filter((t) => t.date === date), [trades, date]);
  const dayMissed = useMemo(() => missed.filter((m) => m.date === date), [missed, date]);

  const netR = netROf(dayTrades);
  const totalDollarPnL = dayTrades.reduce((sum, t) => sum + getTradePnL(t), 0);
  const wins = dayTrades.filter((t) => t.result === "win").length;
  const losses = dayTrades.filter((t) => t.result === "loss").length;
  const winRate = dayTrades.length > 0 ? Math.round((wins / dayTrades.length) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#0a0a0a] border-white/10 p-5 text-foreground max-h-[85vh] overflow-y-auto">
        <DialogHeader className="border-b border-white/[0.08] pb-4 pr-14">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono font-semibold tracking-widest text-accent uppercase">
                TradeZella Daily Journal
              </span>
              <DialogTitle className="mt-1 font-display text-xl tracking-tight text-foreground">
                {formatLongDate(date)}
              </DialogTitle>
            </div>

            {/* Quick Log Buttons */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-white/15 text-xs"
                onClick={() => {
                  onOpenChange(false);
                  onLogTrade(date);
                }}
              >
                <Plus className="mr-1 size-3.5" /> Log Trade
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  onOpenChange(false);
                  onLogMissed(date);
                }}
              >
                Log Missed
              </Button>
            </div>
          </div>

          {/* Daily Metric Strip */}
          <div className="mt-4 grid grid-cols-4 gap-2">
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2 text-center">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Net P&L</span>
              <p
                className={`mt-0.5 font-mono text-sm font-bold ${
                  totalDollarPnL > 0 ? "text-up" : totalDollarPnL < 0 ? "text-down" : "text-muted-foreground"
                }`}
              >
                {formatCurrency(totalDollarPnL)}
              </p>
            </div>
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2 text-center">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Net R</span>
              <p
                className={`mt-0.5 font-mono text-sm font-bold ${
                  netR > 0 ? "text-up" : netR < 0 ? "text-down" : "text-muted-foreground"
                }`}
              >
                {formatR(netR)}
              </p>
            </div>
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2 text-center">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Win Rate</span>
              <p className="mt-0.5 font-mono text-sm font-bold text-foreground">
                {dayTrades.length > 0 ? `${winRate}%` : "—"}
              </p>
            </div>
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2 text-center">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Trades</span>
              <p className="mt-0.5 font-mono text-sm font-bold text-foreground">
                {dayTrades.length} <span className="text-muted-foreground text-xs font-normal">({wins}W / {losses}L)</span>
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Taken Trades Section */}
        <div className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Executed Trades ({dayTrades.length})
              </h4>
              <span className="text-[11px] text-muted-foreground">Click trade to inspect canvas chart</span>
            </div>

            {dayTrades.length === 0 ? (
              <div className="rounded-md border border-dashed border-white/10 p-4 text-center text-xs text-muted-foreground">
                No trades logged for this date.
              </div>
            ) : (
              <div className="space-y-2">
                {dayTrades.map((trade) => {
                  const pnl = getTradePnL(trade);
                  const isLong = trade.side === "long";
                  const isWin = trade.result === "win";
                  const isLoss = trade.result === "loss";

                  return (
                    <button
                      key={trade.id}
                      type="button"
                      onClick={() => {
                        onOpenChange(false);
                        onSelectTrade(trade);
                      }}
                      className="group flex w-full items-center justify-between rounded-md border border-white/[0.08] bg-white/[0.02] p-3 text-left transition-all hover:border-accent/40 hover:bg-white/[0.05]"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex size-6 items-center justify-center rounded text-[10px] font-bold uppercase ${
                            isLong ? "bg-up/20 text-up" : "bg-down/20 text-down"
                          }`}
                        >
                          {isLong ? "B" : "S"}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-foreground">
                              {trade.market}
                            </span>
                            <span className="text-[11px] font-mono text-muted-foreground">
                              {trade.time} NY
                            </span>
                            {trade.modelName && (
                              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                {trade.modelName}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            Entry: {trade.entry?.toFixed(2) ?? "—"} · Exit: {trade.exitPrice?.toFixed(2) ?? "—"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p
                            className={`font-mono text-xs font-bold ${
                              pnl > 0 ? "text-up" : pnl < 0 ? "text-down" : "text-muted-foreground"
                            }`}
                          >
                            {formatCurrency(pnl)}
                          </p>
                          <span
                            className={`text-[10px] font-mono ${
                              trade.rMultiple && trade.rMultiple > 0
                                ? "text-up"
                                : trade.rMultiple && trade.rMultiple < 0
                                ? "text-down"
                                : "text-muted-foreground"
                            }`}
                          >
                            {trade.rMultiple != null ? formatR(trade.rMultiple) : "Open"}
                          </span>
                        </div>
                        <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Missed Setups Section */}
          {dayMissed.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Missed Setups ({dayMissed.length})
              </h4>
              <div className="space-y-1.5">
                {dayMissed.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-md border border-warn/20 bg-warn/[0.03] p-2.5 text-xs"
                  >
                    <div>
                      <span className="font-mono font-medium text-foreground">{m.market}</span>
                      <span className="ml-2 text-muted-foreground">{m.time} NY</span>
                      {m.why && (
                        <span className="ml-2 rounded bg-warn/15 px-1.5 py-0.5 text-[10px] text-warn">
                          Hesitation: {m.why}
                        </span>
                      )}
                    </div>
                    {m.outcome && (
                      <span className="font-mono text-[11px] text-muted-foreground">
                        Potential: {m.outcome}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
