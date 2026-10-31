import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useDeskStore } from "@/lib/ict-store";
import { syncDeskToServer } from "@/lib/desk-sync";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const removeTrade = useDeskStore((s) => s.removeTrade);
  const removeMissed = useDeskStore((s) => s.removeMissed);

  const [activeTab, setActiveTab] = useState<"all" | "day" | "calendar" | "quarter" | "missed">("all");
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [tradeFormOpen, setTradeFormOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [selectedDayDate, setSelectedDayDate] = useState(() => todayISO());
  const [missedOpen, setMissedOpen] = useState(false);
  const [editMissed, setEditMissed] = useState<MissedTrade | null>(null);

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

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1152px] px-4 pt-6 sm:px-8">
        {/* Page Title Row */}
        <div className="flex h-12 items-center justify-between">
          <h1 className="font-display text-[36px] leading-none tracking-tight text-white">Journal</h1>
          <button
            type="button"
            onClick={openLogTrade}
            className="flex h-9 items-center gap-1.5 rounded-md bg-accent px-3.5 text-[13px] font-semibold text-accent-foreground shadow-sm transition-colors hover:brightness-110"
          >
            <Plus className="size-3.5" />
            <span>Log trade</span>
          </button>
        </div>

        {/* View Tabs */}
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as typeof activeTab)} className="mt-2">
          <TabsList className="flex h-10 items-end gap-6 border-b border-white/[0.07] bg-transparent p-0 text-[11px] font-semibold tracking-[0.14em] uppercase">
            <TabsTrigger
              value="all"
              className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2.5 text-[#a2a2a0] shadow-none data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              All <span className="font-mono ml-1 text-[#a2a2a0]">{trades.length}</span>
            </TabsTrigger>
            <TabsTrigger
              value="day"
              className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2.5 text-[#a2a2a0] shadow-none data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              Day
            </TabsTrigger>
            <TabsTrigger
              value="calendar"
              className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2.5 text-[#a2a2a0] shadow-none data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              Calendar
            </TabsTrigger>
            <TabsTrigger
              value="quarter"
              className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2.5 text-[#a2a2a0] shadow-none data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              Quarter
            </TabsTrigger>
            <TabsTrigger
              value="missed"
              className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2.5 text-[#a2a2a0] shadow-none data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              Missed <span className="font-mono ml-1 text-[#a2a2a0]">{missed.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <AllView
              trades={trades}
              selectedTradeId={selectedTrade?.id ?? null}
              onSelectTrade={setSelectedTrade}
              onEditTrade={openEditTrade}
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
