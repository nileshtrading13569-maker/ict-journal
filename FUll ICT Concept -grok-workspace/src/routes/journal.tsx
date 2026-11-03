import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { useDeskStore } from "@/lib/ict-store";
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

  const [activeTab, setActiveTab] = useState<"all" | "day" | "calendar" | "quarter" | "missed">("all");
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [tradeFormOpen, setTradeFormOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [selectedDayDate, setSelectedDayDate] = useState(() => todayISO());
  const [missedOpen, setMissedOpen] = useState(false);
  const [editMissed, setEditMissed] = useState<MissedTrade | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const selectedIndex = selectedTrade ? sortedTrades.findIndex((t) => t.id === selectedTrade.id) : -1;
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
      await syncDeskToServer();

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
            <span className="text-[11px] font-medium tracking-widest text-[#71717a] uppercase">
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
            <div className="flex items-center gap-1.5 text-[11px] text-[#71717a]">
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
          {/* Uppercase Navigation Tabs with Red Underline */}
          <TabsList className="flex h-10 items-end gap-6 border-b border-white/[0.07] bg-transparent p-0 text-[11px] font-semibold tracking-[0.14em] uppercase">
            <TabsTrigger
              value="all"
              className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2.5 text-[#71717a] shadow-none transition-colors data-[state=active]:border-[#e50914] data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              ALL <span className="font-mono ml-1 text-[#a2a2a0]">{trades.length}</span>
            </TabsTrigger>
            <TabsTrigger
              value="day"
              className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2.5 text-[#71717a] shadow-none transition-colors data-[state=active]:border-[#e50914] data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              DAY
            </TabsTrigger>
            <TabsTrigger
              value="calendar"
              className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2.5 text-[#71717a] shadow-none transition-colors data-[state=active]:border-[#e50914] data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              CALENDAR
            </TabsTrigger>
            <TabsTrigger
              value="quarter"
              className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2.5 text-[#71717a] shadow-none transition-colors data-[state=active]:border-[#e50914] data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              QUARTER
            </TabsTrigger>
            <TabsTrigger
              value="missed"
              className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2.5 text-[#71717a] shadow-none transition-colors data-[state=active]:border-[#e50914] data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              MISSED <span className="font-mono ml-1 text-[#a2a2a0]">{missed.length}</span>
            </TabsTrigger>
          </TabsList>

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
                removeTrade(id);
                await syncDeskToServer();
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
              onDelete={removeMissed}
              onAdd={openNewMissed}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Trade Inspector Side Panel */}
      {selectedTrade && (
        <TradeInspector
          trade={selectedTrade}
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
          if (selectedTrade?.id === saved.id) {
            setSelectedTrade(saved);
          }
        }}
      />

      {/* Missed Form Modal */}
      <MissedForm open={missedOpen} onOpenChange={setMissedOpen} row={editMissed} />
    </AppShell>
  );
}
