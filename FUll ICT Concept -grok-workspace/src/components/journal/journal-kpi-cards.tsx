import { useMemo } from "react";
import { Coins, Layers, PieChart, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { calculateJournalKPIs, formatKPIPnL, formatKPIR } from "@/lib/ict-stats";
import type { Trade } from "@/lib/ict-types";
import { cn } from "@/lib/utils";

interface JournalKpiCardsProps {
  trades: Trade[];
  className?: string;
}

export function JournalKpiCards({ trades, className }: JournalKpiCardsProps) {
  const kpis = useMemo(() => calculateJournalKPIs(trades), [trades]);

  // Derived progress values for visual fidelity matching screenshot
  const totalDecided = kpis.winCount + kpis.lossCount + kpis.beCount;
  const winPct = totalDecided > 0 ? (kpis.winCount / totalDecided) * 100 : 0;
  const lossPct = totalDecided > 0 ? (kpis.lossCount / totalDecided) * 100 : 0;
  const bePct = totalDecided > 0 ? (kpis.beCount / totalDecided) * 100 : 0;

  // Net P&L bar percentage
  const pnlBarPct = useMemo(() => {
    if (kpis.netPnL === 0) return 0;
    const totalGross = kpis.grossProfit + kpis.grossLoss;
    if (totalGross > 0) {
      return Math.min(100, Math.max(15, Math.round((kpis.grossProfit / totalGross) * 100)));
    }
    return kpis.netPnL > 0 ? 80 : 40;
  }, [kpis.netPnL, kpis.grossProfit, kpis.grossLoss]);

  // Profit Factor bar percentage
  const pfBarPct = useMemo(() => {
    if (kpis.profitFactor <= 0) return 0;
    // Scale 0 to 4.0 as 0 to 100%
    return Math.min(100, Math.max(15, Math.round((kpis.profitFactor / 4.0) * 100)));
  }, [kpis.profitFactor]);

  // Avg Realized R bar percentage
  const avgRBarPct = useMemo(() => {
    const planned = kpis.plannedR > 0 ? kpis.plannedR : 2.35;
    if (planned <= 0) return 50;
    return Math.min(100, Math.max(15, Math.round((Math.max(0, kpis.avgRealizedR) / planned) * 100)));
  }, [kpis.avgRealizedR, kpis.plannedR]);

  // Expectancy bar percentage
  const expectancyBarPct = useMemo(() => {
    if (kpis.expectancy <= 0) return 0;
    return Math.min(100, Math.max(15, Math.round((kpis.expectancy / 150) * 100)));
  }, [kpis.expectancy]);

  const grossLossFormatted = useMemo(() => {
    const abs = Math.abs(kpis.grossLoss).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `-$${abs}`;
  }, [kpis.grossLoss]);

  return (
    <div
      data-testid="journal-kpi-cards"
      className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5", className)}
    >
      {/* 1. NET P&L */}
      <div
        data-testid="kpi-card-net-pnl"
        className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#121214] p-3.5 shadow-sm transition-all hover:border-white/[0.12]"
      >
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-wider text-[#71717a] uppercase">
              NET P&amp;L
            </span>
            {kpis.netPnL >= 0 ? (
              <TrendingUp className="size-3.5 text-emerald-400" />
            ) : (
              <TrendingDown className="size-3.5 text-red-400" />
            )}
          </div>
          <div
            className={cn(
              "font-mono mt-1 text-[20px] font-bold tracking-tight",
              kpis.netPnL > 0
                ? "text-emerald-400"
                : kpis.netPnL < 0
                  ? "text-red-400"
                  : "text-neutral-200",
            )}
          >
            {kpis.netPnLFormatted}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px]">
            <span
              className={cn(
                "font-mono font-medium",
                kpis.cumulativeR >= 0 ? "text-emerald-400" : "text-red-400",
              )}
            >
              {kpis.cumulativeRFormatted}
            </span>
            <span className="text-[#71717a]">Cumulative</span>
          </div>
        </div>
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800/80">
          <div
            className={cn(
              "h-full transition-all duration-300",
              kpis.netPnL >= 0 ? "bg-emerald-500" : "bg-red-500",
            )}
            style={{ width: `${pnlBarPct}%` }}
          />
        </div>
      </div>

      {/* 2. WIN RATE */}
      <div
        data-testid="kpi-card-win-rate"
        className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#121214] p-3.5 shadow-sm transition-all hover:border-white/[0.12]"
      >
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-wider text-[#71717a] uppercase">
              WIN RATE
            </span>
            <PieChart className="size-3.5 text-neutral-500" />
          </div>
          <div className="font-mono mt-1 text-[20px] font-bold tracking-tight text-white">
            {kpis.winRatePct.toFixed(1)}%
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-mono">
            <span className="text-emerald-400 font-semibold">{kpis.winCount}W</span>
            <span className="text-neutral-500">/</span>
            <span className="text-red-400 font-semibold">{kpis.lossCount}L</span>
            <span className="text-neutral-500">/</span>
            <span className="text-amber-400 font-semibold">{kpis.beCount}BE</span>
          </div>
        </div>
        <div className="mt-2.5 flex h-1.5 w-full overflow-hidden rounded-full bg-neutral-800/80">
          {totalDecided > 0 ? (
            <>
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${winPct}%` }}
              />
              <div
                className="h-full bg-red-500 transition-all duration-300"
                style={{ width: `${lossPct}%` }}
              />
              <div
                className="h-full bg-amber-400 transition-all duration-300"
                style={{ width: `${bePct}%` }}
              />
            </>
          ) : (
            <div className="h-full w-0 bg-neutral-700" />
          )}
        </div>
      </div>

      {/* 3. PROFIT FACTOR */}
      <div
        data-testid="kpi-card-profit-factor"
        className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#121214] p-3.5 shadow-sm transition-all hover:border-white/[0.12]"
      >
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-wider text-[#71717a] uppercase">
              PROFIT FACTOR
            </span>
            <Scale className="size-3.5 text-neutral-500" />
          </div>
          <div className="font-mono mt-1 text-[20px] font-bold tracking-tight text-white">
            {kpis.profitFactor.toFixed(2)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-mono">
            <span className="text-emerald-400 font-medium">{formatKPIPnL(kpis.grossProfit)}</span>
            <span className="text-[#71717a]">vs</span>
            <span className="text-red-400 font-medium">{grossLossFormatted}</span>
          </div>
        </div>
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800/80">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${pfBarPct}%` }}
          />
        </div>
      </div>

      {/* 4. AVG REALIZED R */}
      <div
        data-testid="kpi-card-avg-realized-r"
        className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#121214] p-3.5 shadow-sm transition-all hover:border-white/[0.12]"
      >
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-wider text-[#71717a] uppercase">
              AVG REALIZED R
            </span>
            <Layers className="size-3.5 text-neutral-500" />
          </div>
          <div
            className={cn(
              "font-mono mt-1 text-[20px] font-bold tracking-tight",
              kpis.avgRealizedR > 0
                ? "text-emerald-400"
                : kpis.avgRealizedR < 0
                  ? "text-red-400"
                  : "text-white",
            )}
          >
            {formatKPIR(kpis.avgRealizedR)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px]">
            <span className="text-[#71717a]">Planned R:</span>
            <span className="font-mono text-[#d6d6d4]">
              {kpis.plannedR > 0 ? `${kpis.plannedR.toFixed(2)}R` : "2.35R"}
            </span>
          </div>
        </div>
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800/80">
          <div
            className="h-full bg-[#e50914] transition-all duration-300"
            style={{ width: `${avgRBarPct}%` }}
          />
        </div>
      </div>

      {/* 5. EXPECTANCY */}
      <div
        data-testid="kpi-card-expectancy"
        className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#121214] p-3.5 shadow-sm transition-all hover:border-white/[0.12]"
      >
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-wider text-[#71717a] uppercase">
              EXPECTANCY
            </span>
            <Coins className="size-3.5 text-neutral-500" />
          </div>
          <div
            className={cn(
              "font-mono mt-1 text-[20px] font-bold tracking-tight",
              kpis.expectancy > 0
                ? "text-emerald-400"
                : kpis.expectancy < 0
                  ? "text-red-400"
                  : "text-white",
            )}
          >
            {formatKPIPnL(kpis.expectancy)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-[#71717a]">
            <span>Per execution edge</span>
          </div>
        </div>
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800/80">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${expectancyBarPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
