import type { DailyPlan, DeskData, ProtocolDay, Trade } from "./ict-types";
import { closedTrades, pnlPctOf } from "./ict-calc";
import { defaultPlanFrom } from "./ict-defaults";
import { inWindow, todayISO, weekdayShort } from "./ict-time";

export function tradesOn(trades: Trade[], date: string) {
  return trades.filter((t) => t.date === date);
}

export function consecutiveLosses(trades: Trade[]) {
  const list = trades
    .filter((t) => t.result !== "open")
    .slice()
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  let n = 0;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i].result === "loss") n += 1;
    else break;
  }
  return n;
}

export function worstStreak(trades: Trade[]) {
  const list = closedTrades(trades)
    .slice()
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  let worst = 0;
  let cur = 0;
  for (const t of list) {
    if (t.result === "loss") {
      cur += 1;
      worst = Math.max(worst, cur);
    } else cur = 0;
  }
  return worst;
}

export function sumPnlPct(trades: Trade[]) {
  return trades.reduce((acc, t) => acc + pnlPctOf(t), 0);
}

export function sumR(trades: Trade[]) {
  return closedTrades(trades).reduce((acc, t) => acc + (t.rMultiple ?? 0), 0);
}

export function winRate(trades: Trade[]) {
  const closed = closedTrades(trades);
  if (!closed.length) return 0;
  return (closed.filter((t) => t.result === "win").length / closed.length) * 100;
}

export function expectancyR(trades: Trade[]) {
  const closed = closedTrades(trades);
  if (!closed.length) return 0;
  return sumR(closed) / closed.length;
}

export function profitFactor(trades: Trade[]) {
  const closed = closedTrades(trades);
  const gp = closed.filter((t) => (t.rMultiple ?? 0) > 0).reduce((a, t) => a + (t.rMultiple ?? 0), 0);
  const gl = Math.abs(
    closed.filter((t) => (t.rMultiple ?? 0) < 0).reduce((a, t) => a + (t.rMultiple ?? 0), 0),
  );
  if (gl === 0) return gp > 0 ? 99 : 0;
  return gp / gl;
}

export function avgWinR(trades: Trade[]) {
  const w = closedTrades(trades).filter((t) => t.result === "win");
  if (!w.length) return 0;
  return w.reduce((a, t) => a + (t.rMultiple ?? 0), 0) / w.length;
}

export function avgLossR(trades: Trade[]) {
  const l = closedTrades(trades).filter((t) => t.result === "loss");
  if (!l.length) return 0;
  return l.reduce((a, t) => a + (t.rMultiple ?? 0), 0) / l.length;
}

export function ruleFollowRate(trades: Trade[]) {
  if (!trades.length) return 0;
  return (trades.filter((t) => t.ruleFollowed).length / trades.length) * 100;
}

export function equityCurve(trades: Trade[]) {
  const closed = closedTrades(trades)
    .slice()
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  let r = 0;
  let pct = 0;
  let peak = 0;
  return closed.map((t) => {
    r += t.rMultiple ?? 0;
    pct += pnlPctOf(t);
    peak = Math.max(peak, pct);
    const dd = peak - pct;
    return {
      id: t.id,
      date: t.date,
      time: t.time,
      r,
      pct,
      dd,
      label: `${t.date} ${t.market}`,
    };
  });
}

export function maxDrawdownPct(trades: Trade[]) {
  const curve = equityCurve(trades);
  return curve.reduce((m, p) => Math.max(m, p.dd), 0);
}

export function currentBalance(data: DeskData) {
  const pct = sumPnlPct(data.trades);
  return data.rules.startingBalance * (1 + pct / 100);
}

export function payoutProgress(data: DeskData) {
  const gained = currentBalance(data) - data.rules.startingBalance;
  const target = data.rules.startingBalance * (data.rules.payoutThresholdPct / 100);
  return { gained, target, pct: target === 0 ? 0 : (gained / target) * 100 };
}

export function planFor(data: DeskData, date: string): DailyPlan {
  return data.dailyPlans[date] ?? defaultPlanFrom(data, date);
}

export function protocolDayNumber(data: DeskData, date = todayISO()) {
  if (!data.rules.protocolStartDate) return 1;
  const a = Date.parse(`${data.rules.protocolStartDate}T00:00:00Z`);
  const b = Date.parse(`${date}T00:00:00Z`);
  const n = Math.round((b - a) / 86400000) + 1;
  return Math.max(1, n);
}

export function todayProtocol(data: DeskData, date = todayISO()): ProtocolDay | undefined {
  const n = protocolDayNumber(data, date);
  return data.protocolDays.find((d) => d.day === n) ?? data.protocolDays.find((d) => d.date === date);
}

export type LockInfo = {
  locked: boolean;
  reasons: string[];
  warnings: string[];
};

export function lockInfo(data: DeskData, date = todayISO()): LockInfo {
  const plan = planFor(data, date);
  const todays = tradesOn(data.trades, date);
  const reasons: string[] = [];
  const warnings: string[] = [];

  const losses = consecutiveLosses(todays);
  if (losses >= data.rules.maxConsecutiveLosses) {
    reasons.push(`${losses} consecutive losses — stop. Analyse, do not take the next trade.`);
  }
  const lostPct = -Math.min(0, sumPnlPct(todays));
  if (lostPct >= plan.maxDailyLossPct) {
    reasons.push(
      `Daily loss limit hit (${lostPct.toFixed(2)}% ≥ ${plan.maxDailyLossPct}%). Platform close.`,
    );
  }
  if (todays.length >= plan.maxTrades) {
    reasons.push(`Max trades for today reached (${todays.length}/${plan.maxTrades}).`);
  }
  const totalDd = -Math.min(0, sumPnlPct(data.trades));
  if (totalDd >= data.rules.maxTotalDrawdownPct) {
    reasons.push(`Max total drawdown reached (${totalDd.toFixed(2)}%).`);
  }
  const news = data.newsEvents.filter((n) => n.date === date && n.avoid);
  if (news.length) {
    warnings.push(`High-impact: ${news.map((n) => n.name).join(", ")}. Default is flat around the print.`);
  }
  if (!inWindow(data.rules.windowStart, data.rules.windowEnd)) {
    warnings.push("Outside the New York trading window. Chart should be closed.");
  }
  if (data.forceClosedDates.includes(date)) reasons.push("You closed the platform for today.");
  const forceOpen = data.forceOpenDates.includes(date);
  const locked = forceOpen ? false : reasons.length > 0;
  return { locked, reasons: forceOpen ? [] : reasons, warnings };
}

export function remainingRToDanger(data: DeskData, date = todayISO()) {
  const plan = planFor(data, date);
  const todays = tradesOn(data.trades, date);
  const lostToday = -Math.min(0, sumPnlPct(todays));
  const dailyLeftPct = Math.max(0, plan.maxDailyLossPct - lostToday);
  const totalDd = -Math.min(0, sumPnlPct(data.trades));
  const totalLeftPct = Math.max(0, data.rules.maxTotalDrawdownPct - totalDd);
  const risk = plan.riskPerTrade || data.rules.normalRiskPct || 0.25;
  const dailyR = risk > 0 ? dailyLeftPct / risk : 0;
  const totalR = risk > 0 ? totalLeftPct / risk : 0;
  return { dailyLeftPct, totalLeftPct, dailyR, totalR, risk };
}

export function weeklyFor(data: DeskData, date: string) {
  const start = data.weeklies
    .slice()
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
    .find((w) => w.weekStart <= date);
  return start;
}

type Bucket = { key: string; label: string; trades: number; wins: number; r: number; expectancy: number };

function finalize(map: Map<string, { label: string; trades: number; wins: number; r: number }>): Bucket[] {
  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      label: v.label,
      trades: v.trades,
      wins: v.wins,
      r: v.r,
      expectancy: v.trades ? v.r / v.trades : 0,
    }))
    .sort((a, b) => b.r - a.r);
}

function bump(
  map: Map<string, { label: string; trades: number; wins: number; r: number }>,
  key: string,
  label: string,
  t: Trade,
) {
  const cur = map.get(key) ?? { label, trades: 0, wins: 0, r: 0 };
  cur.trades += 1;
  if (t.result === "win") cur.wins += 1;
  cur.r += t.rMultiple ?? 0;
  map.set(key, cur);
}

export function groupBy(trades: Trade[], keyFn: (t: Trade) => { key: string; label: string }) {
  const map = new Map<string, { label: string; trades: number; wins: number; r: number }>();
  for (const t of trades) {
    const { key, label } = keyFn(t);
    bump(map, key || "none", label || "—", t);
  }
  return finalize(map);
}

export function conceptMatrix(trades: Trade[]) {
  const map = new Map<string, { label: string; trades: number; wins: number; r: number }>();
  for (const t of trades) {
    for (const liq of t.taken) bump(map, `taken:${liq}`, `${liq} sweep`, t);
    if (t.pdArray) bump(map, `pd:${t.pdArray}`, t.pdArray, t);
    for (const tr of t.triggers) bump(map, `tr:${tr}`, tr, t);
    if (t.session) bump(map, `sess:${t.session}`, t.session, t);
    if (t.killZone) bump(map, `kz:${t.killZone}`, t.killZone, t);
    bump(map, `loc:${t.location}`, t.location, t);
    if (t.smt.present !== "no") bump(map, `smt:${t.smt.present}`, `SMT ${t.smt.present}`, t);
    if (t.ote.used === "used") bump(map, "ote", "OTE", t);
    if (t.crt.used) bump(map, "crt", "CRT", t);
    if (t.judas.present === "yes") bump(map, "judas", "Judas", t);
    if (t.modelName) bump(map, `model:${t.modelId || t.modelName}`, t.modelName, t);
  }
  return finalize(map);
}

export function errorBreakdown(trades: Trade[]) {
  const map = new Map<string, { label: string; trades: number; wins: number; r: number }>();
  for (const t of trades) {
    const keys = t.errors.length ? t.errors : t.primaryError ? [t.primaryError] : ["Unlabeled"];
    for (const e of keys) bump(map, e, e, t);
  }
  return finalize(map);
}

export function dayOfWeekTable(trades: Trade[]) {
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const map = new Map<string, { bias: string; liq: string; dir: string; r: number; n: number }>();
  for (const t of closedTrades(trades)) {
    const d = weekdayShort(t.date);
    const cur = map.get(d) ?? { bias: t.dailyBias, liq: t.taken[0] ?? "—", dir: t.side, r: 0, n: 0 };
    cur.r += t.rMultiple ?? 0;
    cur.n += 1;
    cur.bias = t.dailyBias;
    cur.liq = t.taken[0] ?? cur.liq;
    cur.dir = t.side;
    map.set(d, cur);
  }
  return order
    .filter((d) => map.has(d))
    .map((d) => ({ day: d, ...map.get(d)! }));
}

export function maeMfeStats(trades: Trade[]) {
  const closed = closedTrades(trades).filter((t) => t.mfeR != null || t.maeR != null);
  if (!closed.length) return { avgMae: 0, avgMfe: 0, conversion: 0, n: 0 };
  const avgMae = closed.reduce((a, t) => a + (t.maeR ?? 0), 0) / closed.length;
  const avgMfe = closed.reduce((a, t) => a + (t.mfeR ?? 0), 0) / closed.length;
  const withBoth = closed.filter((t) => t.mfeR && t.mfeR > 0 && t.rMultiple != null);
  const conversion = withBoth.length
    ? withBoth.reduce((a, t) => a + (t.rMultiple ?? 0) / (t.mfeR as number), 0) / withBoth.length
    : 0;
  return { avgMae, avgMfe, conversion, n: closed.length };
}
