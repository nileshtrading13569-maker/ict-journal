import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { useDeskStore } from "@/lib/ict-store";
import {
  avgLossR,
  avgWinR,
  conceptMatrix,
  currentBalance,
  dayOfWeekTable,
  equityCurve,
  errorBreakdown,
  expectancyR,
  maeMfeStats,
  maxDrawdownPct,
  payoutProgress,
  profitFactor,
  remainingRToDanger,
  ruleFollowRate,
  sumPnlPct,
  sumR,
  winRate,
  worstStreak,
} from "@/lib/ict-stats";
import { formatMoney, formatPct, formatR, cn, todayISO } from "@/lib/utils";
import { Panel } from "@/components/desk/fields";
import { KpiCard } from "@/components/desk/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SESSIONS } from "@/lib/ict-types";
import { weekStartISO } from "@/lib/ict-time";
import {
  Flame,
  Percent,
  TrendingUp,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/analytics")({ component: AnalyticsPage });

function AnalyticsPage() {
  const data = useDeskStore();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [modelFilter, setModelFilter] = useState("all");
  const [sessionFilter, setSessionFilter] = useState("all");
  const filteredTrades = data.trades.filter((trade) =>
    (!fromDate || trade.date >= fromDate) &&
    (!toDate || trade.date <= toDate) &&
    (modelFilter === "all" || trade.modelId === modelFilter) &&
    (sessionFilter === "all" || trade.session === sessionFilter),
  );
  const curve = equityCurve(filteredTrades);
  const pay = payoutProgress(data);
  const concepts = conceptMatrix(filteredTrades).slice(0, 18);
  const errors = errorBreakdown(filteredTrades);
  const days = dayOfWeekTable(filteredTrades);
  const mm = maeMfeStats(filteredTrades);
  const danger = remainingRToDanger(data);
  const totalR = sumR(filteredTrades);
  const wr = winRate(filteredTrades);
  const pf = profitFactor(filteredTrades);
  const currentWeek = weekStartISO(todayISO());
  const weekTrades = data.trades.filter((trade) => trade.date >= currentWeek);
  const ruleBreaks = Array.from({ length: 7 }, (_, weekday) => {
    const count = filteredTrades.filter((trade) =>
      !trade.ruleFollowed && new Date(`${trade.date}T00:00:00Z`).getUTCDay() === weekday,
    ).length;
    return { day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][weekday], count };
  });
  const closedTrades = filteredTrades.filter((trade) => trade.result !== "open");
  const missingRiskData = closedTrades.filter((trade) => trade.entry == null || trade.sl == null).length;
  const missingModel = filteredTrades.filter((trade) => !trade.modelId && !trade.modelName).length;
  const missingReview = closedTrades.filter((trade) => !trade.notes.trim() && !trade.primaryError).length;

  return (
    <AppShell>
      <PageHeader
        eyebrow="ICT edge analytics"
        title="Which concept pays?"
        description="Slice by narrative, liquidity, PD array, trigger, session, location — not by mood."
        aside={
          <span className="font-mono text-[11px] text-muted-foreground">
            {filteredTrades.length} trades in sample
          </span>
        }
      />

      <Panel className="mb-6" title="Analytics filters" kicker={`${filteredTrades.length} matching trades`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-xs text-muted-foreground">
            From date
            <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            To date
            <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Setup model
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              value={modelFilter}
              onChange={(event) => setModelFilter(event.target.value)}
            >
              <option value="all">All models</option>
              {data.models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Session
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              value={sessionFilter}
              onChange={(event) => setSessionFilter(event.target.value)}
            >
              <option value="all">All sessions</option>
              {SESSIONS.map((session) => <option key={session} value={session}>{session}</option>)}
            </select>
          </label>
        </div>
      </Panel>

      <div className="mb-6 grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <KpiCard
          label="Equity"
          value={formatMoney(currentBalance(data))}
          hint={formatPct(sumPnlPct(filteredTrades))}
          icon={Wallet}
        />
        <KpiCard
          label="Total R"
          value={formatR(totalR)}
          hint={`${filteredTrades.length} matching trades`}
          icon={Flame}
          variant={totalR > 0 ? "up" : totalR < 0 ? "down" : "default"}
        />
        <KpiCard
          label="Win Rate"
          value={`${wr.toFixed(0)}%`}
          hint={`Exp: ${formatR(expectancyR(filteredTrades))}`}
          icon={Percent}
          variant={wr >= 50 ? "up" : "default"}
        />
        <KpiCard
          label="Profit Factor"
          value={pf.toFixed(2)}
          hint={`Max DD ${formatPct(-maxDrawdownPct(filteredTrades))}`}
          icon={TrendingUp}
          variant={pf >= 1.5 ? "up" : "default"}
        />
      </div>

      <Panel className="mb-6" title="Equity Curve (in R)" kicker={`Payout path ${Math.max(0, Math.round(pay.pct))}%`}>
        <div className="h-72 w-full pt-2">
          {curve.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curve} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="curveGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255, 255, 255, 0.05)" vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "rgba(255, 255, 255, 0.4)", fontSize: 11 }}
                  axisLine={{ stroke: "rgba(255, 255, 255, 0.1)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "rgba(255, 255, 255, 0.4)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(18, 20, 17, 0.95)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: 12,
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
                    color: "var(--color-foreground)",
                    backdropFilter: "blur(12px)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="r"
                  stroke="var(--color-accent)"
                  fill="url(#curveGlow)"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No closed trades logged yet. Log executions to generate your edge curve.
            </div>
          )}
        </div>
      </Panel>

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <Panel title="Risk of Ruin Model" kicker="Distance to danger">
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] p-2.5">
              <span className="text-muted-foreground">Daily R remaining</span>
              <span className="font-mono font-semibold text-foreground">{danger.dailyR.toFixed(1)}R ({danger.dailyLeftPct.toFixed(2)}%)</span>
            </li>
            <li className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] p-2.5">
              <span className="text-muted-foreground">Total Drawdown remaining</span>
              <span className="font-mono font-semibold text-foreground">{danger.totalR.toFixed(1)}R ({danger.totalLeftPct.toFixed(2)}%)</span>
            </li>
            <li className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] p-2.5">
              <span className="text-muted-foreground">Worst losing streak</span>
              <span className="font-mono font-semibold text-down">{worstStreak(filteredTrades)} consecutive</span>
            </li>
            <li className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] p-2.5">
              <span className="text-muted-foreground">Win / Loss Ratio</span>
              <span className="font-mono font-semibold text-foreground">
                <span className="text-up">{formatR(avgWinR(filteredTrades))}</span> / <span className="text-down">{formatR(avgLossR(filteredTrades))}</span>
              </span>
            </li>
            <li className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] p-2.5">
              <span className="text-muted-foreground">Rule Compliance</span>
              <Badge variant={ruleFollowRate(filteredTrades) >= 80 ? "up" : "warn"}>
                {ruleFollowRate(filteredTrades).toFixed(0)}% Followed
              </Badge>
            </li>
          </ul>
        </Panel>

        <Panel title="MAE / MFE Edge" kicker={`${mm.n} trades with excursion`}>
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] p-2.5">
              <span className="text-muted-foreground">Average MAE (Drawdown during trade)</span>
              <span className="font-mono font-semibold text-down">{formatR(mm.avgMae)}</span>
            </li>
            <li className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] p-2.5">
              <span className="text-muted-foreground">Average MFE (Maximum favorable potential)</span>
              <span className="font-mono font-semibold text-up">{formatR(mm.avgMfe)}</span>
            </li>
            <li className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] p-2.5">
              <span className="text-muted-foreground">MFE → Realized Conversion</span>
              <span className="font-mono font-bold text-accent">{(mm.conversion * 100).toFixed(0)}%</span>
            </li>
            <li className="rounded-xl border border-white/[0.06] bg-black/25 p-3 text-xs leading-relaxed text-muted-foreground">
              💡 If MFE is 3R and you bank 1R, the entry model is sharp and trade management is where alpha is leaking.
            </li>
          </ul>
        </Panel>
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-3">
        <Panel title="Weekly scorecard" kicker={`Week of ${currentWeek}`}>
          <div className="grid grid-cols-2 gap-3">
            <Score label="Trades" value={String(weekTrades.length)} />
            <Score label="Net R" value={formatR(sumR(weekTrades))} />
            <Score label="Win rate" value={`${winRate(weekTrades).toFixed(0)}%`} />
            <Score label="Rule follow" value={`${ruleFollowRate(weekTrades).toFixed(0)}%`} />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Review the week in Weekly and record one lesson before planning the next session.
          </p>
        </Panel>

        <Panel title="Rule-break heatmap" kicker="Count by weekday · current filters">
          <div className="grid grid-cols-7 gap-1.5">
            {ruleBreaks.map(({ day, count }) => (
              <div key={day} className="text-center">
                <div
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-lg border text-sm font-semibold",
                    count ? "border-down/40 bg-down/15 text-down" : "border-white/[0.06] bg-white/[0.02] text-muted-foreground",
                  )}
                  title={`${count} rule breaks`}
                >
                  {count}
                </div>
                <span className="mt-1 block text-[10px] text-muted-foreground">{day}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Journal data health" kicker={`${filteredTrades.length} matching trades`}>
          <ul className="space-y-2 text-sm">
            <HealthRow label="Closed trades missing entry or stop" count={missingRiskData} />
            <HealthRow label="Trades without a setup model" count={missingModel} />
            <HealthRow label="Closed trades without a written review" count={missingReview} />
          </ul>
        </Panel>
      </div>

      <Panel className="mb-6" title="ICT Concept Performance Matrix" kicker="Empirical Edge">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase border-b border-white/[0.08]">
              <tr>
                <th className="py-3 px-3 font-medium">Concept</th>
                <th className="py-3 px-3 font-medium">Sample</th>
                <th className="py-3 px-3 font-medium">Win %</th>
                <th className="py-3 px-3 font-medium">Avg R (Exp)</th>
                <th className="py-3 px-3 font-medium text-right">Net R</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {concepts.map((c) => {
                const wr = c.trades ? ((c.wins / c.trades) * 100).toFixed(0) : 0;
                const isPositive = c.r > 0;
                const isNegative = c.r < 0;

                return (
                  <tr key={c.key} className="transition-colors hover:bg-white/[0.03]">
                    <td className="py-3 px-3 font-medium text-foreground">{c.label}</td>
                    <td className="py-3 px-3 font-mono text-muted-foreground tabular-nums">{c.trades}</td>
                    <td className="py-3 px-3 font-mono tabular-nums">
                      <span className={cn(Number(wr) >= 50 ? "text-up font-semibold" : "text-muted-foreground")}>
                        {wr}%
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums">{formatR(c.expectancy)}</td>
                    <td className="py-3 px-3 font-mono font-bold text-right tabular-nums">
                      <span className={isPositive ? "text-up" : isNegative ? "text-down" : "text-muted-foreground"}>
                        {formatR(c.r)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <Panel title="Primary Error Attribution" kicker="Behavioral leaks">
          <div className="space-y-2">
            {errors.map((e) => (
              <div
                key={e.key}
                className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-surface-2/40 px-3.5 py-2.5 text-sm transition-colors hover:bg-surface-2/70"
              >
                <span className="font-medium text-foreground">{e.label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{e.trades} trades</span>
                  <span className="font-mono text-xs font-bold text-down">{formatR(e.r)}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Session / Day Performance" kicker="Time cycle edge">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] font-semibold text-muted-foreground uppercase border-b border-white/[0.08]">
                <tr>
                  <th className="py-2.5 px-2 font-medium">Day</th>
                  <th className="py-2.5 px-2 font-medium">Bias</th>
                  <th className="py-2.5 px-2 font-medium">Liq</th>
                  <th className="py-2.5 px-2 font-medium text-right">R</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {days.map((d) => (
                  <tr key={d.day} className="transition-colors hover:bg-white/[0.03]">
                    <td className="py-2.5 px-2 font-medium text-foreground">{d.day}</td>
                    <td className="py-2.5 px-2 capitalize text-muted-foreground">{d.bias}</td>
                    <td className="py-2.5 px-2 text-muted-foreground">{d.liq}</td>
                    <td className="py-2.5 px-2 font-mono font-bold text-right tabular-nums">
                      <span className={d.r > 0 ? "text-up" : d.r < 0 ? "text-down" : "text-muted-foreground"}>
                        {formatR(d.r)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}

function Score({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold">{value}</p>
    </div>
  );
}

function HealthRow({ label, count }: { label: string; count: number }) {
  return (
    <li className="flex items-start justify-between gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={count ? "warn" : "up"}>{count}</Badge>
    </li>
  );
}
