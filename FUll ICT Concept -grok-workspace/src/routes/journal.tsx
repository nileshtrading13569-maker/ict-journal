import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { deskSnapshot, useDeskStore } from "@/lib/ict-store";
import { syncDeskToServer } from "@/lib/desk-sync";
import { importTradesFromCsv } from "@/lib/journal-csv";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JournalKpiCards } from "@/components/journal/journal-kpi-cards";
import { AllView } from "@/components/journal/all-view";
import { DayView } from "@/components/journal/day-view";
import { TradeInspector } from "@/components/journal/trade-inspector";
import { TradeFormModal } from "@/components/journal/trade-form-modal";
import { CalendarPanel } from "@/components/journal/calendar-panel";
import { QuarterPanel } from "@/components/journal/quarter-panel";
import { MissedPanel } from "@/components/journal/missed-panel";
import { MissedForm } from "@/components/desk/missed-form";
import { todayISO } from "@/lib/utils";
import type { MissedTrade, Trade } from "@/lib/ict-types";

export const Route = createFileRoute("/journal")({ component: JournalPage });

function JournalPage() {
  const trades = useDeskStore((s) => s.trades);
  const missed = useDeskStore((s) => s.missed);
  const models = useDeskStore((s) => s.models);
  const rules = useDeskStore((s) => s.rules);
  const upsertTrade = useDeskStore((s) => s.upsertTrade);
  const removeTrade = useDeskStore((s) => s.removeTrade);
  const removeMissed = useDeskStore((s) => s.removeMissed);

  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const [activeTab, setActiveTab] = useState<"all" | "day" | "calendar" | "quarter" | "missed">("all");
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [tradeFormOpen, setTradeFormOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [selectedDayDate, setSelectedDayDate] = useState(() => todayISO());
  const [missedOpen, setMissedOpen] = useState(false);
  const [editMissed, setEditMissed] = useState<MissedTrade | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const raw = searchStr || (typeof window !== "undefined" ? window.location.search : "");
    const paramDate = new URLSearchParams(raw).get("date");
    if (paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate)) {
      setSelectedDayDate(paramDate);
      setActiveTab("day");
    }
  }, [searchStr]);

  // Active month period label for prop desk subtitle (e.g. "OCT 2026")
  const activePeriodLabel = useMemo(() => {
    const candidate = trades[0]?.date || todayISO();
    try {
      const [year, month] = candidate.split("-");
      if (year && month) {
        const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        const mIdx = parseInt(month, 10) - 1;
        if (mIdx >= 0 && mIdx < 12) {
          return `${monthNames[mIdx]} ${year}`;
        }
      }
    } catch {
      // Fallback
    }
    return "OCT 2026";
  }, [trades]);

  // Sorted list of trades for previous / next navigation in inspector
  const sortedTrades = useMemo(() => {
    return trades.slice().sort((a, b) => {
      const timeA = `${a.date}T${a.time || "00:00"}`;
      const timeB = `${b.date}T${b.time || "00:00"}`;
      return timeB.localeCompare(timeA);
    });
  }, [trades]);

  const selectedTradeId = selectedTrade?.id ?? null;
  const liveSelectedTrade = useDeskStore((s) =>
    selectedTradeId ? (s.trades.find((t) => t.id === selectedTradeId) ?? null) : null,
  );
  const selectedIndex = liveSelectedTrade
    ? sortedTrades.findIndex((t) => t.id === liveSelectedTrade.id)
    : -1;
  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex !== -1 && selectedIndex < sortedTrades.length - 1;

  const handlePrevTrade = () => {
    if (hasPrev) {
      setSelectedTrade(sortedTrades[selectedIndex - 1]);
    }
  };

  const handleNextTrade = () => {
    if (hasNext) {
      setSelectedTrade(sortedTrades[selectedIndex + 1]);
    }
  };

  const openLogTrade = () => {
    setEditingTrade(null);
    setTradeFormOpen(true);
  };

  const openEditTrade = (t: Trade) => {
    setEditingTrade(t);
    setTradeFormOpen(true);
  };

  const openNewMissed = () => {
    setEditMissed(null);
    setMissedOpen(true);
  };

  const openEditMissed = (row: MissedTrade) => {
    setEditMissed(row);
    setMissedOpen(true);
  };

  const handleCsvFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const csvText = await file.text();
      const result = importTradesFromCsv(csvText, { models, rules }, trades);

      for (const trade of result.trades) {
        upsertTrade(trade);
      }

      // Persist in-memory Zustand store changes to Neon Postgres
      const snapshot = deskSnapshot();
      await syncDeskToServer(snapshot);

      toast.success(
        `Imported ${result.trades.length} trade${result.trades.length === 1 ? "" : "s"}${
          result.skipped > 0 ? ` (${result.skipped} skipped duplicate/invalid)` : ""
        }`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import CSV");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <AppShell>
      <div className="w-full min-w-0">
        {/* Header Row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Title & Subtitle */}
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-white sm:text-[34px]">
              Journal
            </h1>
            <span className="text-[11px] font-medium tracking-widest text-[#a1a1aa] uppercase">
              PROP DESK · {activePeriodLabel}
            </span>
          </div>

          {/* Action Buttons & Auto-Sync Indicator */}
          <div className="flex flex-col items-start sm:items-end gap-1.5">
            <div className="flex items-center gap-2">
              {/* Invisible file input for CSV Import */}
              <input
                ref={fileInputRef}
                type="file"
                aria-label="Upload CSV trade log"
                accept=".csv,text/csv"
                onChange={handleCsvFileChange}
                className="hidden"
                disabled={isImporting}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/80 px-3.5 text-xs font-medium text-neutral-200 shadow-sm transition-colors hover:bg-neutral-800 hover:text-white disabled:opacity-50 cursor-pointer"
              >
                <Upload className="size-3.5 text-neutral-400" />
                <span>{isImporting ? "Importing..." : "Import CSV"}</span>
              </button>

              <button
                type="button"
                onClick={openLogTrade}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-[#e50914] px-4 py-2 text-xs font-medium text-white shadow transition-colors hover:bg-[#b80710] cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>+ Log trade</span>
              </button>
            </div>

            {/* Auto-Sync Status Indicator */}
            <div className="flex items-center gap-1.5 text-[11px] text-[#a1a1aa]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>Auto-sync enabled · MT5 Raw Spread</span>
            </div>
          </div>
        </div>

        {/* View Tabs & KPI Cards & Content */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as typeof activeTab)}
          className="mt-4"
        >
          {/* Frosted Glass Segmented Control matching reference Image 2 */}
          <div className="flex items-center overflow-x-auto pb-1 [scrollbar-width:none]">
            <TabsList className="inline-flex h-11 items-center gap-1 rounded-full border border-white/[0.18] bg-white/[0.04] p-1 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_1.5px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.35)] w-auto max-w-full">
              <TabsTrigger
                value="all"
                className="group relative inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold tracking-wider uppercase text-white/60 border border-transparent shadow-none bg-transparent transition-all duration-200 after:hidden hover:text-white hover:bg-white/[0.05] data-[state=active]:bg-white/[0.15] data-[state=active]:text-white data-[state=active]:border-white/[0.22] data-[state=active]:shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_2px_8px_rgba(0,0,0,0.4)]"
              >
                <span>ALL</span>
                <span className="font-mono ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.08] text-white/80 border border-white/10 group-data-[state=active]:bg-white/[0.18] group-data-[state=active]:text-white">
                  {trades.length}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="day"
                className="relative inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold tracking-wider uppercase text-white/60 border border-transparent shadow-none bg-transparent transition-all duration-200 after:hidden hover:text-white hover:bg-white/[0.05] data-[state=active]:bg-white/[0.15] data-[state=active]:text-white data-[state=active]:border-white/[0.22] data-[state=active]:shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_2px_8px_rgba(0,0,0,0.4)]"
              >
                DAY
              </TabsTrigger>
              <TabsTrigger
                value="calendar"
                className="relative inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold tracking-wider uppercase text-white/60 border border-transparent shadow-none bg-transparent transition-all duration-200 after:hidden hover:text-white hover:bg-white/[0.05] data-[state=active]:bg-white/[0.15] data-[state=active]:text-white data-[state=active]:border-white/[0.22] data-[state=active]:shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_2px_8px_rgba(0,0,0,0.4)]"
              >
                CALENDAR
              </TabsTrigger>
              <TabsTrigger
                value="quarter"
                className="relative inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold tracking-wider uppercase text-white/60 border border-transparent shadow-none bg-transparent transition-all duration-200 after:hidden hover:text-white hover:bg-white/[0.05] data-[state=active]:bg-white/[0.15] data-[state=active]:text-white data-[state=active]:border-white/[0.22] data-[state=active]:shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_2px_8px_rgba(0,0,0,0.4)]"
              >
                QUARTER
              </TabsTrigger>
              <TabsTrigger
                value="missed"
                className="group relative inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold tracking-wider uppercase text-white/60 border border-transparent shadow-none bg-transparent transition-all duration-200 after:hidden hover:text-white hover:bg-white/[0.05] data-[state=active]:bg-white/[0.15] data-[state=active]:text-white data-[state=active]:border-white/[0.22] data-[state=active]:shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_2px_8px_rgba(0,0,0,0.4)]"
              >
                <span>MISSED</span>
                <span className="font-mono ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.08] text-white/80 border border-white/10 group-data-[state=active]:bg-white/[0.18] group-data-[state=active]:text-white">
                  {missed.length}
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 5 KPI Metric Cards Mounted Below Tabs */}
          <div className="mt-4">
            <JournalKpiCards trades={trades} />
          </div>

          <TabsContent value="all" className="mt-4">
            <AllView
              trades={trades}
              selectedTradeId={selectedTrade?.id ?? null}
              onSelectTrade={setSelectedTrade}
              onEditTrade={openEditTrade}
              onLogTrade={openLogTrade}
            />
          </TabsContent>

          <TabsContent value="day" className="mt-5">
            <DayView
              trades={trades}
              selectedDate={selectedDayDate}
              onSelectDate={setSelectedDayDate}
              onSelectTrade={setSelectedTrade}
              onEditTrade={openEditTrade}
            />
          </TabsContent>

          <TabsContent value="calendar" className="mt-5">
            <CalendarPanel
              trades={trades}
              missed={missed}
              models={models}
              onLogTrade={openLogTrade}
              onLogMissed={openNewMissed}
              onEditTrade={openEditTrade}
              onDeleteTrade={async (id) => {
                const prevTrades = useDeskStore.getState().trades;
                removeTrade(id);
                try {
                  const snapshot = deskSnapshot();
                  await syncDeskToServer(snapshot);
                  toast.success("Trade deleted");
                } catch (err) {
                  console.error("[journal] failed to delete trade:", err);
                  useDeskStore.setState({ trades: prevTrades });
                  toast.error("Failed to delete trade from cloud.");
                }
              }}
            />
          </TabsContent>

          <TabsContent value="quarter" className="mt-5">
            <QuarterPanel
              trades={trades}
              missed={missed}
              onLogTrade={openLogTrade}
              onLogMissed={openNewMissed}
            />
          </TabsContent>

          <TabsContent value="missed" className="mt-5">
            <MissedPanel
              missed={missed}
              onEdit={openEditMissed}
              onDelete={async (id) => {
                const prevMissed = useDeskStore.getState().missed;
                removeMissed(id);
                try {
                  const snapshot = deskSnapshot();
                  await syncDeskToServer(snapshot);
                  toast.success("Missed trade deleted");
                } catch (err) {
                  console.error("[journal] failed to delete missed trade:", err);
                  useDeskStore.setState({ missed: prevMissed });
                  toast.error("Failed to delete missed trade from cloud.");
                }
              }}
              onAdd={openNewMissed}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Trade Inspector Side Panel */}
      {liveSelectedTrade && (
        <TradeInspector
          trade={liveSelectedTrade}
          onClose={() => setSelectedTrade(null)}
          onEdit={openEditTrade}
          onPrev={handlePrevTrade}
          onNext={handleNextTrade}
          hasPrev={hasPrev}
          hasNext={hasNext}
        />
      )}

      {/* Trade Form Modal (Add / Edit) */}
      <TradeFormModal
        open={tradeFormOpen}
        onOpenChange={setTradeFormOpen}
        trade={editingTrade}
        onSaved={(saved) => {
          if (selectedTradeId === saved.id) {
            setSelectedTrade(saved);
          }
        }}
      />

      {/* Missed Form Modal */}
      <MissedForm open={missedOpen} onOpenChange={setMissedOpen} row={editMissed} />
    </AppShell>
  );
}
