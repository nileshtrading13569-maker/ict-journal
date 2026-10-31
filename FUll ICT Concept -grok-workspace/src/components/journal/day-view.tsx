import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useDeskStore } from "@/lib/ict-store";
import { syncDeskToServer } from "@/lib/desk-sync";
import { fmtCurrency, instrumentOf, tradeDollarPnl } from "@/lib/ict-calc";
import { formatDateKey } from "@/lib/journal-dates";
import { cn, formatR } from "@/lib/utils";
import type { Trade } from "@/lib/ict-types";

interface DayViewProps {
  trades: Trade[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onSelectTrade: (trade: Trade) => void;
  onEditTrade: (trade: Trade) => void;
}

export function DayView({
  trades,
  selectedDate,
  onSelectDate,
  onSelectTrade,
}: DayViewProps) {
  const data = useDeskStore();
  const models = useDeskStore((s) => s.models);
  const dailyPlans = useDeskStore((s) => s.dailyPlans);
  const setDailyJournalNote = useDeskStore((s) => s.setDailyJournalNote);

  // Month navigation
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (selectedDate) {
      const d = new Date(selectedDate);
      if (!Number.isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Current note editing
  const activePlan = dailyPlans[selectedDate];
  const savedNoteText = activePlan?.notes ?? "";
  const [noteContent, setNoteContent] = useState(savedNoteText);
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Update noteContent when selected date changes or saved text changes
  useEffect(() => {
    setNoteContent(savedNoteText);
  }, [selectedDate, savedNoteText]);

  // Group trades by date
  const tradesByDate = useMemo(() => {
    const map = new Map<string, Trade[]>();
    for (const t of trades) {
      if (!t.date) continue;
      const list = map.get(t.date) ?? [];
      list.push(t);
      map.set(t.date, list);
    }
    return map;
  }, [trades]);

  // Days list for the selected month
  const monthKey = formatDateKey(currentMonth).slice(0, 7);
  const monthDays = useMemo(() => {
    // Collect all dates in this month with trades or plans
    const datesSet = new Set<string>();
    trades.forEach((t) => {
      if (t.date && t.date.startsWith(monthKey)) datesSet.add(t.date);
    });
    Object.keys(dailyPlans).forEach((d) => {
      if (d.startsWith(monthKey)) datesSet.add(d);
    });
    if (selectedDate.startsWith(monthKey)) {
      datesSet.add(selectedDate);
    }

    // Sort descending
    return Array.from(datesSet).sort((a, b) => b.localeCompare(a));
  }, [trades, dailyPlans, monthKey, selectedDate]);

  // If selectedDate is not set or not in current month, default to first available or today
  useEffect(() => {
    if (monthDays.length > 0 && !monthDays.includes(selectedDate)) {
      onSelectDate(monthDays[0]);
    }
  }, [monthDays, selectedDate, onSelectDate]);

  const shiftMonth = (delta: number) => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1);
    setCurrentMonth(next);
  };

  // Day stats for selectedDate
  const dayTrades = tradesByDate.get(selectedDate) ?? [];
  const closedDayTrades = dayTrades.filter((t) => t.result !== "open");

  const dayStats = useMemo(() => {
    let netPnL = 0;
    let netR = 0;
    let totalFees = 0;
    let wins = 0;

    for (const t of closedDayTrades) {
      const inst = instrumentOf(data, t.market);
      const pnl = tradeDollarPnl(t, inst);
      netPnL += pnl.net ?? 0;
      netR += t.rMultiple ?? 0;
      totalFees += t.fees ?? 1.75;
      if (t.result === "win") wins += 1;
    }

    const winRatePct = closedDayTrades.length > 0 ? Math.round((wins / closedDayTrades.length) * 100) : 0;

    return {
      netPnL,
      netR,
      tradesCount: dayTrades.length,
      winRatePct,
      fees: totalFees,
    };
  }, [dayTrades, closedDayTrades, data]);

  const handleSaveNote = async () => {
    setIsSavingNote(true);
    try {
      setDailyJournalNote(selectedDate, noteContent);
      await syncDeskToServer();
      toast.success("Daily journal note saved");
    } catch (err) {
      console.error("[day-view] note save error:", err);
      toast.error("Saved locally. Could not sync with server.");
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDiscardNote = () => {
    setNoteContent(savedNoteText);
    toast.info("Changes discarded");
  };

  const formatSelectedHeadline = (dateStr: string) => {
    if (!dateStr) return "Today";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  };

  const formatDayListItem = (dateStr: string) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const monthLabel = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Day index sidebar */}
      <div className="w-full shrink-0 lg:w-[196px]">
        {/* Month selector header */}
        <div className="mb-2 flex items-center justify-between px-1 text-[12px] text-[#a2a2a0]">
          <span className="font-medium text-[#d6d6d4]">{monthLabel}</span>
          <div className="flex gap-1 text-[14px]">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="rounded p-0.5 hover:bg-white/[0.08] hover:text-white"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              className="rounded p-0.5 hover:bg-white/[0.08] hover:text-white"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        {/* Day list */}
        <ul className="flex flex-col gap-1">
          {monthDays.length === 0 ? (
            <li className="px-2 py-4 text-center text-xs text-[#a2a2a0]">No journal days this month</li>
          ) : (
            monthDays.map((dateKey) => {
              const isSelected = dateKey === selectedDate;
              const dateTrades = tradesByDate.get(dateKey) ?? [];
              const closed = dateTrades.filter((t) => t.result !== "open");
              const openCount = dateTrades.filter((t) => t.result === "open").length;
              const unreviewed = dateTrades.filter((t) => !t.reviewed).length;

              const dateNetPnL = closed.reduce((acc, t) => {
                const pnl = tradeDollarPnl(t, instrumentOf(data, t.market));
                return acc + (pnl.net ?? 0);
              }, 0);

              return (
                <li
                  key={dateKey}
                  onClick={() => onSelectDate(dateKey)}
                  className={cn(
                    "cursor-pointer rounded-md px-2.5 py-2 transition-colors",
                    isSelected
                      ? "border border-white/[0.12] bg-white/[0.06]"
                      : "hover:bg-white/[0.03]",
                  )}
                >
                  <div className="flex items-baseline justify-between">
                    <span className={cn("text-[13px]", isSelected ? "font-semibold text-white" : "font-medium text-[#d6d6d4]")}>
                      {formatDayListItem(dateKey)}
                    </span>
                    {closed.length > 0 ? (
                      <span
                        className={cn(
                          "font-mono text-[12px]",
                          dateNetPnL >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]",
                        )}
                      >
                        {fmtCurrency(dateNetPnL)}
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] text-[#6f6f6d]">—</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex justify-between text-[11px] text-[#a2a2a0]">
                    <span>
                      {dateTrades.length === 0
                        ? "Plan only"
                        : `${dateTrades.length} trade${dateTrades.length > 1 ? "s" : ""}${openCount > 0 ? ` · ${openCount} open` : ""}`}
                    </span>
                    {unreviewed > 0 && (
                      <span className="text-[#f5b942]">{unreviewed} to review</span>
                    )}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {/* Selected day detail panel */}
      <section className="relative min-w-0 flex-1 overflow-hidden rounded-xl border border-white/[0.09] bg-[#0a0a0a]/85">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e50914]/60 to-transparent" />

        {/* Date header */}
        <div className="flex flex-wrap items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <h2 className="font-display text-[26px] leading-none text-white">
            {formatSelectedHeadline(selectedDate)}
          </h2>
          <span className="text-[12px] text-[#a2a2a0]">New York time (ET)</span>
        </div>

        {/* Daily stats grid */}
        <div className="grid grid-cols-2 gap-3 border-b border-white/[0.06] px-6 py-3.5 sm:grid-cols-5">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] text-[#a2a2a0] uppercase">Net P&amp;L</p>
            <p
              className={cn(
                "font-mono mt-1 text-[20px]",
                dayStats.netPnL >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]",
              )}
            >
              {fmtCurrency(dayStats.netPnL)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] text-[#a2a2a0] uppercase">Net R</p>
            <p
              className={cn(
                "font-mono mt-1 text-[20px]",
                dayStats.netR >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]",
              )}
            >
              {dayStats.netR !== 0 ? formatR(dayStats.netR) : "0.00R"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] text-[#a2a2a0] uppercase">Trades</p>
            <p className="font-mono mt-1 text-[20px] text-white">{dayStats.tradesCount}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] text-[#a2a2a0] uppercase">Win rate</p>
            <p className="font-mono mt-1 text-[20px] text-white">{dayStats.winRatePct}%</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] text-[#a2a2a0] uppercase">Fees</p>
            <p className="font-mono mt-1 text-[20px] text-[#d6d6d4]">${dayStats.fees.toFixed(2)}</p>
          </div>
        </div>

        {/* Daily journal notes section */}
        <div className="px-6 pt-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-white">Daily journal</h3>
            <span className="font-mono text-[12px] text-[#a2a2a0]">
              {activePlan?.savedAt ? `Saved ${activePlan.savedAt}` : "Autosave ready"}
            </span>
          </div>

          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Asia range 3,489.20 – 3,497.40. London swept Asia low, NY AM delivered from 15m FVG into PDH. Notes on execution, psychological triggers, or session reflections..."
            className="h-[144px] w-full resize-y rounded-md border border-white/[0.09] bg-[#151515]/80 p-3.5 text-[13px] leading-relaxed text-[#e8e8e6] outline-none transition focus:border-white/[0.2]"
          />

          <div className="mt-2.5 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleDiscardNote}
              disabled={noteContent === savedNoteText}
              className="flex h-8 items-center rounded-md px-3 text-[12px] font-medium text-[#a2a2a0] hover:bg-white/[0.04] hover:text-white disabled:opacity-30"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSaveNote}
              disabled={isSavingNote}
              className="flex h-8 items-center rounded-md border border-white/[0.12] bg-white/[0.05] px-3 text-[12px] font-semibold text-white transition hover:bg-white/[0.1]"
            >
              {isSavingNote ? "Saving…" : "Save note"}
            </button>
          </div>
        </div>

        {/* Day trade log table */}
        <div className="mt-5 border-t border-white/[0.06]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className="h-9 border-b border-white/[0.06] text-left text-[10px] font-semibold tracking-[0.12em] text-[#a2a2a0] uppercase">
                  <th className="pl-6 pr-3 font-semibold">Time</th>
                  <th className="px-3 font-semibold">Side</th>
                  <th className="px-3 font-semibold">Status</th>
                  <th className="px-3 text-right font-semibold">Lots</th>
                  <th className="px-3 text-right font-semibold">Entry</th>
                  <th className="px-3 text-right font-semibold">Exit</th>
                  <th className="px-3 text-right font-semibold">Net P&amp;L</th>
                  <th className="px-3 text-right font-semibold">R</th>
                  <th className="px-3 font-semibold">Playbook</th>
                  <th className="px-3 font-semibold">Rules</th>
                  <th className="pr-6 pl-3 text-center font-semibold">Reviewed</th>
                </tr>
              </thead>
              <tbody>
                {dayTrades.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-xs text-[#a2a2a0]">
                      No trades logged on this date.
                    </td>
                  </tr>
                ) : (
                  dayTrades.map((trade) => {
                    const inst = instrumentOf(data, trade.market);
                    const pnl = tradeDollarPnl(trade, inst);
                    const mod = models.find((m) => m.id === trade.modelId || m.name === trade.modelName);
                    const code = mod?.code || "A";

                    const assessments = trade.rulesAssessment ?? {};
                    const rulesFollowed = Object.values(assessments).filter((v) => v === "followed").length;
                    const rulesTotal = Object.keys(assessments).length || 8;

                    return (
                      <tr
                        key={trade.id}
                        onClick={() => onSelectTrade(trade)}
                        className="h-10 cursor-pointer border-b border-white/[0.05] transition-colors hover:bg-white/[0.04] last:border-b-0"
                      >
                        <td className="font-mono pl-6 pr-3 text-[12px] text-white">{trade.time || "—"}</td>
                        <td className="px-3 capitalize text-[#d6d6d4]">{trade.side}</td>
                        <td className="px-3">
                          <span
                            className={cn(
                              "rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.08em] uppercase",
                              trade.result === "win"
                                ? "border border-[#3ddc84]/30 bg-[#3ddc84]/10 text-[#3ddc84]"
                                : trade.result === "loss"
                                  ? "border border-[#ff6b7d]/30 bg-[#ff6b7d]/10 text-[#ff6b7d]"
                                  : trade.result === "be"
                                    ? "whitespace-nowrap border border-white/[0.14] bg-white/[0.05] text-[#d6d6d4]"
                                    : "border border-[#f5b942]/30 bg-[#f5b942]/10 text-[#f5b942]",
                            )}
                          >
                            {trade.result === "win"
                              ? "Win"
                              : trade.result === "loss"
                                ? "Loss"
                                : trade.result === "be"
                                  ? "Break-even"
                                  : "Open"}
                          </span>
                        </td>
                        <td className="font-mono px-3 text-right text-white">
                          {trade.lots != null ? trade.lots.toFixed(2) : "—"}
                        </td>
                        <td className="font-mono px-3 text-right text-white">
                          {trade.entry != null ? trade.entry.toFixed(inst?.digits ?? 2) : "—"}
                        </td>
                        <td className="font-mono px-3 text-right text-white">
                          {trade.exitPrice != null ? trade.exitPrice.toFixed(inst?.digits ?? 2) : "—"}
                        </td>
                        <td
                          className={cn(
                            "font-mono px-3 text-right",
                            pnl.net == null
                              ? "text-[#6f6f6d]"
                              : pnl.net >= 0
                                ? "text-[#3ddc84]"
                                : "text-[#ff6b7d]",
                          )}
                        >
                          {fmtCurrency(pnl.net)}
                        </td>
                        <td
                          className={cn(
                            "font-mono px-3 text-right",
                            trade.rMultiple == null
                              ? "text-[#6f6f6d]"
                              : trade.rMultiple >= 0
                                ? "text-[#3ddc84]"
                                : "text-[#ff6b7d]",
                          )}
                        >
                          {trade.rMultiple != null ? formatR(trade.rMultiple) : "—"}
                        </td>
                        <td className="px-3 text-[#d6d6d4]">
                          <span className="font-mono mr-1.5 inline-block text-[11px] text-[#a2a2a0]">
                            {code}
                          </span>
                          {trade.modelName || "Continuation"}
                        </td>
                        <td className="font-mono px-3 text-[12px] text-[#d6d6d4]">
                          {rulesFollowed} / {rulesTotal}
                        </td>
                        <td className="pr-6 pl-3 text-center">
                          {trade.reviewed ? (
                            <Check className="mx-auto size-3.5 text-[#3ddc84]" />
                          ) : (
                            <span className="text-[#6f6f6d]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
