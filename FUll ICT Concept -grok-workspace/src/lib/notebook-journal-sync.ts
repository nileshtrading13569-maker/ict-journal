import { fmtCurrency, tradeDollarPnl } from "./ict-calc.ts";
import type { Instrument, SetupModel, Trade } from "./ict-types.ts";
import type { NotebookEntry } from "./notebook-defaults.ts";

export interface NotebookDayMetrics {
  netPnl: number;
  grossPnl: number;
  commissions: number;
  totalTrades: number;
  winners: number;
  losers: number;
  winrate: number;
  volume: number;
  profitFactor: number;
  hasLiveTrades: boolean;
  trades: Trade[];
}

export function resolveTradeInstrument(
  instruments: Instrument[] | undefined,
  market: string,
): Instrument | undefined {
  if (!instruments || instruments.length === 0) return undefined;
  return (
    instruments.find((i) => i.symbol.toLowerCase() === (market || "").toLowerCase()) ??
    instruments[0]
  );
}

/**
 * Computes daily metrics for a notebook note date by joining directly against
 * live Journal trades (`deskTrades`) with identical math to `calculateJournalKPIs`,
 * falling back to `manualMetrics` only when no live trades exist for that date.
 */
export function computeNotebookDayMetrics(
  noteDate: string,
  deskTrades: Trade[],
  instruments?: Instrument[],
  manualMetrics?: NotebookEntry["manualMetrics"],
): NotebookDayMetrics | null {
  const dayTrades = deskTrades
    .filter((t) => t.date === noteDate)
    .slice()
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  if (dayTrades.length === 0) {
    if (manualMetrics) {
      return {
        netPnl: manualMetrics.netPnl ?? 0,
        grossPnl: manualMetrics.grossPnl ?? 0,
        commissions: manualMetrics.commissions ?? 0,
        totalTrades: manualMetrics.totalTrades ?? 0,
        winners: manualMetrics.winners ?? 0,
        losers: manualMetrics.losers ?? 0,
        winrate: manualMetrics.winrate ?? 0,
        volume: manualMetrics.volume ?? 0,
        profitFactor: manualMetrics.profitFactor ?? 0,
        hasLiveTrades: false,
        trades: [],
      };
    }
    return null;
  }

  let grossPnl = 0;
  let netPnl = 0;
  let commissions = 0;
  let winners = 0;
  let losers = 0;
  let totalLots = 0;
  let winGross = 0;
  let lossGross = 0;

  for (const t of dayTrades) {
    totalLots += t.lots != null && Number.isFinite(t.lots) ? t.lots : 0;

    if (t.result === "open") {
      commissions += t.fees ?? 0;
      continue;
    }

    const inst = resolveTradeInstrument(instruments, t.market);
    const pnlInfo = tradeDollarPnl(t, inst);
    const net = pnlInfo.net ?? 0;
    const gross = pnlInfo.gross ?? net;
    const fee = pnlInfo.fees ?? 0;

    grossPnl += gross;
    netPnl += net;
    commissions += fee;

    if (t.result === "win") {
      winners += 1;
      if (net > 0) winGross += net;
    } else if (t.result === "loss") {
      losers += 1;
      if (net < 0) lossGross += Math.abs(net);
    } else if (t.result !== "be") {
      if (net > 0) {
        winners += 1;
        winGross += net;
      } else if (net < 0) {
        losers += 1;
        lossGross += Math.abs(net);
      }
    }
  }

  const decidedCount = winners + losers;
  const winrate = decidedCount > 0 ? Number(((winners / decidedCount) * 100).toFixed(1)) : 0;
  const profitFactor =
    lossGross > 0 ? Number((winGross / lossGross).toFixed(2)) : winGross > 0 ? 99.99 : 0;

  return {
    netPnl: Number(netPnl.toFixed(2)),
    grossPnl: Number(grossPnl.toFixed(2)),
    commissions: Number(commissions.toFixed(2)),
    totalTrades: dayTrades.length,
    winners,
    losers,
    winrate,
    volume: Number(totalLots.toFixed(2)),
    profitFactor,
    hasLiveTrades: true,
    trades: dayTrades,
  };
}

export function formatJournalDateTitle(dateIso: string): string {
  const parsed = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateIso;
  return parsed.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatJournalSubDate(dateIso: string): string {
  const parsed = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateIso;
  return parsed.toLocaleDateString("en-US");
}

export function formatTradeMarkdownBlock(
  trade: Trade,
  instruments?: Instrument[],
  models?: SetupModel[],
): string {
  const inst = resolveTradeInstrument(instruments, trade.market);
  const pnl = tradeDollarPnl(trade, inst);
  const modelName =
    models?.find((m) => m.id === trade.modelId)?.name || trade.modelName || "Setup";
  const rText =
    trade.rMultiple != null
      ? `${trade.rMultiple > 0 ? "+" : ""}${trade.rMultiple.toFixed(2)}R`
      : "—";
  const lotsText = trade.lots != null ? trade.lots.toFixed(2) : "—";
  const sideLabel = trade.side.toUpperCase();
  const statusLabel = trade.result.toUpperCase();

  const lines = [
    `#### ${trade.time || "00:00"} ET · **${trade.market} ${sideLabel}** (${statusLabel} · ${fmtCurrency(pnl.net)} · ${rText})`,
    `- **Playbook**: ${modelName}${trade.killZone ? ` · **Session**: ${trade.killZone}` : ""}`,
    `- **Execution**: Entry \`${trade.entry ?? "—"}\` → Exit \`${trade.exitPrice ?? "—"}\` · SL \`${trade.sl ?? "—"}\` · Lots \`${lotsText}\``,
  ];

  const notesParts = [
    trade.notes?.trim() ? `> ${trade.notes.trim().replace(/\n/g, "\n> ")}` : "",
    trade.preTradeNotes?.trim() ? `- **Pre-Trade**: ${trade.preTradeNotes.trim()}` : "",
    trade.managementNotes?.trim() ? `- **Management**: ${trade.managementNotes.trim()}` : "",
    trade.postTradeNotes?.trim() ? `- **Post-Trade**: ${trade.postTradeNotes.trim()}` : "",
  ].filter(Boolean);

  if (notesParts.length > 0) {
    lines.push(...notesParts);
  }

  return lines.join("\n");
}

/**
 * Builds a Database-synced Daily Journal Notebook entry from all Journal trades
 * logged on `dateIso`. Uses live trade references (omits stale `manualMetrics`).
 */
export function buildDailyJournalEntryFromTrades(
  dateIso: string,
  dayTrades: Trade[],
  instruments?: Instrument[],
  models?: SetupModel[],
  dayPlanNote?: string,
): NotebookEntry {
  const title = formatJournalDateTitle(dateIso);
  const subDate = formatJournalSubDate(dateIso);
  const metrics = computeNotebookDayMetrics(dateIso, dayTrades, instruments);

  const tagSet = new Set<string>(["JournalSync"]);
  for (const t of dayTrades) {
    if (t.market) tagSet.add(t.market);
    if (t.killZone && t.killZone !== "Other") tagSet.add(t.killZone);
    else if (t.session) tagSet.add(t.session);
    const mName = models?.find((m) => m.id === t.modelId)?.name || t.modelName;
    if (mName) tagSet.add(mName);
  }

  const nowTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const sortedTrades = dayTrades
    .slice()
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  const tradeBlocks =
    sortedTrades.length > 0
      ? sortedTrades.map((t) => formatTradeMarkdownBlock(t, instruments, models)).join("\n\n")
      : "- No trades logged for this date yet.";

  const summaryLine = metrics
    ? `**Net P&L:** ${fmtCurrency(metrics.netPnl)} · **Trades:** ${metrics.totalTrades} (${metrics.winners}W / ${metrics.losers}L) · **Winrate:** ${metrics.winrate}%`
    : "Session log initialized.";

  const planNoteBlock = dayPlanNote?.trim()
    ? ["", "### 🗒️ Journal Day Note", dayPlanNote.trim()]
    : [];

  const content = [
    `## 📊 ${title} — Journal Synced Tape`,
    summaryLine,
    ...planNoteBlock,
    "",
    "### 🔗 Linked Journal Executions",
    tradeBlocks,
    "",
    "### 🧠 Session Review & Execution Discipline",
    "- **HTF Narrative & Liquidity**: ",
    "- **Rules & Patience**: ",
    "- **Next Session Focus**: ",
  ].join("\n");

  return {
    id: `day-${dateIso}`,
    folder: "Daily Journal",
    title,
    subDate,
    date: dateIso,
    createdAt: `${subDate} ${nowTime}`,
    updatedAt: nowTime,
    pinned: false,
    tags: Array.from(tagSet).slice(0, 6),
    content,
  };
}

/**
 * Generates missing Daily Journal entries for trading dates present in `trades`
 * (or `dailyPlanNotes`) that do not yet have an entry in the "Daily Journal" folder
 * and are not skipped.
 */
export function mergeJournalDatesIntoNotes(
  notes: NotebookEntry[],
  trades: Trade[],
  instruments?: Instrument[],
  models?: SetupModel[],
  skippedDates?: Set<string>,
  dailyPlanNotes?: Record<string, string>,
): { nextNotes: NotebookEntry[]; addedDates: string[] } {
  const existingDailyDates = new Set(
    notes.filter((n) => n.folder === "Daily Journal" && n.date).map((n) => n.date),
  );

  const tradesByDate = new Map<string, Trade[]>();
  for (const t of trades) {
    if (!t.date || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) continue;
    if (existingDailyDates.has(t.date)) continue;
    if (skippedDates?.has(t.date)) continue;
    const list = tradesByDate.get(t.date) ?? [];
    list.push(t);
    tradesByDate.set(t.date, list);
  }

  if (dailyPlanNotes) {
    for (const [dateIso, noteText] of Object.entries(dailyPlanNotes)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) continue;
      if (!noteText?.trim()) continue;
      if (existingDailyDates.has(dateIso)) continue;
      if (skippedDates?.has(dateIso)) continue;
      if (!tradesByDate.has(dateIso)) {
        tradesByDate.set(dateIso, []);
      }
    }
  }

  if (tradesByDate.size === 0) {
    return { nextNotes: notes, addedDates: [] };
  }

  const existingIds = new Set(notes.map((n) => n.id));
  const addedEntries: NotebookEntry[] = [];
  const addedDates: string[] = [];

  const sortedDates = Array.from(tradesByDate.keys()).sort((a, b) => b.localeCompare(a));
  for (const dateIso of sortedDates) {
    const entry = buildDailyJournalEntryFromTrades(
      dateIso,
      tradesByDate.get(dateIso)!,
      instruments,
      models,
      dailyPlanNotes?.[dateIso],
    );
    if (existingIds.has(entry.id)) {
      entry.id = `day-${dateIso}-${Date.now()}`;
    }
    existingIds.add(entry.id);
    addedEntries.push(entry);
    addedDates.push(dateIso);
  }

  return {
    nextNotes: [...addedEntries, ...notes],
    addedDates,
  };
}
