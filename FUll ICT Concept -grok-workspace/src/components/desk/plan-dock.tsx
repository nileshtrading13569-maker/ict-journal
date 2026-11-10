import { useState, useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronsRight,
  ChevronDown,
  Pencil,
  Check,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useDeskStore, deskSnapshot } from "@/lib/ict-store";
import { syncDeskToServer } from "@/lib/desk-sync";
import { DEFAULT_PLAN_QUESTIONS } from "@/lib/ict-defaults";
import type { PlanQuestion } from "@/lib/ict-types";
import { todayISO, nyParts, nowHHMM, nowIST12, nyTimeToIST12 } from "@/lib/ict-time";
import { fmtCurrency, instrumentOf, tradeDollarPnl } from "@/lib/ict-calc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export { DEFAULT_PLAN_QUESTIONS, type PlanQuestion };

const PLAN_DOCK_OPEN_KEY = "ict-desk-plan-dock-open";

export function PlanDock() {
  const data = useDeskStore();
  const dailyPlans = useDeskStore((s) => s.dailyPlans);
  const checks = useDeskStore((s) => s.checks);
  const trades = useDeskStore((s) => s.trades);
  const storePlanQuestions = useDeskStore((s) => s.planQuestions);
  const setPlanQuestions = useDeskStore((s) => s.setPlanQuestions);
  const toggleCheck = useDeskStore((s) => s.toggleCheck);
  const setPlan = useDeskStore((s) => s.setPlan);

  const today = todayISO();
  const ny = nyParts();
  const dateMMDD = `${ny.month}/${ny.day}`;

  // Dock open/collapsed state (defaults to true or saved state)
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = window.localStorage.getItem(PLAN_DOCK_OPEN_KEY);
    return saved !== null ? saved === "true" : true;
  });

  // Mobile drawer open state
  const [mobileOpen, setMobileOpen] = useState(false);

  // Section collapse states
  const [planSectionOpen, setPlanSectionOpen] = useState(true);
  const [checklistSectionOpen, setChecklistSectionOpen] = useState(true);
  const [sessionSectionOpen, setSessionSectionOpen] = useState(true);
  const [tradesSectionOpen, setTradesSectionOpen] = useState(true);

  // Checklist questions synced with Neon backend store
  const checklistQuestions = useMemo(() => {
    return Array.isArray(storePlanQuestions) && storePlanQuestions.length > 0
      ? storePlanQuestions
      : DEFAULT_PLAN_QUESTIONS;
  }, [storePlanQuestions]);

  // Checklist editor modal state
  const [checklistEditorOpen, setChecklistEditorOpen] = useState(false);
  const [editingQuestions, setEditingQuestions] = useState<PlanQuestion[]>(checklistQuestions);
  const [newQuestionText, setNewQuestionText] = useState("");

  useEffect(() => {
    setEditingQuestions(checklistQuestions);
  }, [checklistQuestions]);

  // Plan writing/editing state
  const currentPlan = dailyPlans[today];
  const planNotes = currentPlan?.notes ?? "";
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [draftPlan, setDraftPlan] = useState(planNotes);

  useEffect(() => {
    setDraftPlan(planNotes);
  }, [planNotes]);

  const handleToggleDock = (open: boolean) => {
    setIsOpen(open);
    try {
      window.localStorage.setItem(PLAN_DOCK_OPEN_KEY, String(open));
    } catch {
      // ignore
    }
  };

  // Checked items set for today
  const checkedSet = useMemo(() => {
    return new Set(checks[today] ?? []);
  }, [checks, today]);

  const completedChecklistCount = useMemo(() => {
    return checklistQuestions.filter((q) => checkedSet.has(q.id)).length;
  }, [checklistQuestions, checkedSet]);

  const handleToggleCheck = async (questionId: string) => {
    toggleCheck(today, questionId);
    try {
      const snapshot = deskSnapshot();
      await syncDeskToServer(snapshot);
    } catch (err) {
      console.error("[plan-dock] failed to sync checklist check:", err);
      // rollback
      toggleCheck(today, questionId);
      toast.error("Could not sync checklist with cloud.");
    }
  };

  const handleSavePlan = async () => {
    const updatedPlan = {
      ...(currentPlan ?? {
        date: today,
        market: "XAUUSD",
        htfStructure: "expansion" as const,
        previousDay: { pdh: null, pdl: null, pdc: null, dailyOpen: null, midnightOpen: null },
        location: "discount" as const,
        liquidityCondition: "Both" as const,
        expectedDraw: "",
        expectedDelivery: "",
        alignments: { weeklyAligned: true, dailyAligned: true, sessionAligned: true },
        amdPhase: "",
        expectedManipulation: "",
        expectedDistribution: "",
        dealingRange: { high: 0, low: 0, current: 0 },
        scenarios: "",
        maxTrades: 2,
        maxDailyLossPct: 1,
        riskPerTrade: 1,
        notes: "",
      }),
      notes: draftPlan.trim(),
      savedAt: new Date().toISOString(),
    };

    const prevPlans = useDeskStore.getState().dailyPlans;
    setPlan(today, updatedPlan);
    setIsEditingPlan(false);

    try {
      const snapshot = deskSnapshot();
      await syncDeskToServer(snapshot);
      toast.success("Pre-market plan saved to cloud");
    } catch (err) {
      console.error("[plan-dock] failed to sync plan:", err);
      useDeskStore.setState({ dailyPlans: prevPlans });
      toast.error("Failed to save plan to cloud.");
    }
  };

  const handleSaveChecklistQuestions = async () => {
    const valid = editingQuestions.filter((q) => q.label.trim().length > 0);
    const finalQuestions = valid.length > 0 ? valid : DEFAULT_PLAN_QUESTIONS;
    const prevQuestions = useDeskStore.getState().planQuestions;
    setPlanQuestions(finalQuestions);
    setChecklistEditorOpen(false);
    try {
      const snapshot = deskSnapshot();
      await syncDeskToServer(snapshot);
      toast.success("Checklist questions synced to cloud");
    } catch (err) {
      console.error("[plan-dock] failed to sync checklist questions:", err);
      setPlanQuestions(prevQuestions ?? DEFAULT_PLAN_QUESTIONS);
      toast.error("Could not sync checklist questions with cloud.");
    }
  };

  const handleAddQuestion = () => {
    if (!newQuestionText.trim()) return;
    const newQ: PlanQuestion = {
      id: `plan-q-${Date.now()}`,
      label: newQuestionText.trim(),
    };
    setEditingQuestions((prev) => [...prev, newQ]);
    setNewQuestionText("");
  };

  // Real-time clock tick for dynamic kill zone & dual timezone updates
  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setClockTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  // Active session and rules kept calculations
  const { activeSessionName, activeSessionTitle, nyTiming, istTiming, rulesKeptDisplay } = useMemo(() => {
    const time = nowHHMM();
    let session = "Inter-session";
    let title = "Outside Kill Zone";
    let ny = `${time} NY`;
    let ist = `${nowIST12()} IST`;

    // ICT Kill Zones in NY Time (HH:MM) with dynamic 12hr AM/PM IST conversion
    if (time >= "02:00" && time <= "05:00") {
      session = "London KZ";
      title = "London Kill Zone";
      ny = "02:00–05:00 NY";
      ist = `${nyTimeToIST12(2, 0)}–${nyTimeToIST12(5, 0)} IST`;
    } else if (time >= "07:00" && time <= "10:00") {
      session = "NY AM KZ";
      title = "NY AM Kill Zone";
      ny = "07:00–10:00 NY";
      ist = `${nyTimeToIST12(7, 0)}–${nyTimeToIST12(10, 0)} IST`;
    } else if (time > "10:00" && time <= "11:30") {
      session = "NY Cont";
      title = "NY Continuation Window";
      ny = "10:00–11:30 NY";
      ist = `${nyTimeToIST12(10, 0)}–${nyTimeToIST12(11, 30)} IST`;
    } else if (time >= "13:30" && time <= "16:00") {
      session = "NY PM";
      title = "NY PM Session";
      ny = "13:30–16:00 NY";
      ist = `${nyTimeToIST12(13, 30)}–${nyTimeToIST12(16, 0)} IST`;
    } else if (time >= "19:00" || time <= "00:00") {
      session = "Asia Session";
      title = "Asia Accumulation";
      ny = "19:00–00:00 NY";
      ist = `${nyTimeToIST12(19, 0)}–${nyTimeToIST12(0, 0)} IST`;
    }

    // Rules kept for today's closed trades
    const todayTrades = trades.filter((t) => t.date === today);
    let rulesKept = "—";
    if (todayTrades.length > 0) {
      const followed = todayTrades.filter((t) => t.ruleFollowed).length;
      const pct = Math.round((followed / todayTrades.length) * 100);
      rulesKept = `${pct}%`;
    } else {
      const closed = trades.filter((t) => t.result !== "open");
      if (closed.length > 0) {
        const followed = closed.filter((t) => t.ruleFollowed).length;
        const pct = Math.round((followed / closed.length) * 100);
        rulesKept = `${pct}% (overall)`;
      }
    }

    return {
      activeSessionName: session,
      activeSessionTitle: title,
      nyTiming: ny,
      istTiming: ist,
      rulesKeptDisplay: rulesKept,
    };
  }, [trades, today, clockTick]);

  // Today's recent trades
  const todayTrades = useMemo(() => {
    return trades
      .filter((t) => t.date === today)
      .slice(0, 5)
      .sort((a, b) => (b.time || "").localeCompare(a.time || ""));
  }, [trades, today]);

  // Reusable panel content in Deep Black / Dark Luxury Theme
  const renderPanelContent = (isMobileView = false) => (
    <div className="flex flex-col h-full space-y-4 text-zinc-200 font-sans">
      {/* Top Header Row */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
        <button
          type="button"
          onClick={() => (isMobileView ? setMobileOpen(false) : handleToggleDock(false))}
          className="flex size-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white hover:border-white/20 hover:bg-white/[0.08] transition-colors cursor-pointer"
          title="Collapse plan rail"
          aria-label="Collapse plan rail"
        >
          <ChevronsRight className="size-4" />
        </button>
        <span className="font-mono text-xs font-bold text-white tracking-wider">
          {dateMMDD}
        </span>
      </div>

      {/* Section 1: THE PLAN */}
      <div>
        <div className="flex items-center justify-between select-none mb-2">
          <button
            type="button"
            onClick={() => setPlanSectionOpen(!planSectionOpen)}
            className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-[#a1a1aa] hover:text-white uppercase transition-colors cursor-pointer"
          >
            <ChevronDown
              className={cn("size-3.5 transition-transform duration-200", !planSectionOpen && "-rotate-90")}
            />
            <span>THE PLAN</span>
          </button>
          <button
            type="button"
            onClick={() => setIsEditingPlan(!isEditingPlan)}
            className="text-[11px] font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            {isEditingPlan ? "Close" : planNotes ? "Edit" : "Write"}
          </button>
        </div>

        {planSectionOpen && (
          <div className="mt-1">
            {isEditingPlan ? (
              <div className="space-y-2">
                <textarea
                  value={draftPlan}
                  onChange={(e) => setDraftPlan(e.target.value)}
                  placeholder="Write today's pre-market narrative, bias, draw on liquidity, key levels..."
                  rows={4}
                  className="w-full text-xs bg-black/60 border border-white/15 rounded-lg p-2.5 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 resize-none font-sans"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDraftPlan(planNotes);
                      setIsEditingPlan(false);
                    }}
                    className="px-2.5 py-1 text-[11px] font-medium text-zinc-400 hover:text-white rounded border border-white/10 hover:border-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePlan}
                    className="px-3 py-1 text-[11px] font-semibold text-white bg-red-600 hover:bg-red-500 rounded transition-colors shadow-xs"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : planNotes ? (
              <div
                onClick={() => setIsEditingPlan(true)}
                className="group relative rounded-lg border border-dashed border-white/20 bg-white/[0.03] p-3 text-xs text-zinc-200 hover:border-white/30 hover:bg-white/[0.05] transition-all cursor-pointer whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto [scrollbar-width:none]"
              >
                {planNotes}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Pencil className="size-3 text-zinc-400" />
                </div>
              </div>
            ) : (
              /* The exact dashed rounded box in deep black */
              <button
                type="button"
                onClick={() => setIsEditingPlan(true)}
                className="w-full rounded-lg border border-dashed border-white/20 bg-white/[0.02] py-3.5 px-3 text-center text-xs text-zinc-400 hover:border-white/40 hover:bg-white/[0.05] hover:text-white transition-all cursor-pointer"
              >
                No pre-market plan yet
              </button>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-white/[0.08]" />

      {/* Section 2: CHECKLIST */}
      <div>
        <div className="flex items-center justify-between select-none mb-2">
          <button
            type="button"
            onClick={() => setChecklistSectionOpen(!checklistSectionOpen)}
            className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-[#a1a1aa] hover:text-white uppercase transition-colors cursor-pointer"
          >
            <ChevronDown
              className={cn("size-3.5 transition-transform duration-200", !checklistSectionOpen && "-rotate-90")}
            />
            <span>CHECKLIST</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-medium text-zinc-400">
              {completedChecklistCount}/{checklistQuestions.length}
            </span>
            <button
              type="button"
              onClick={() => {
                setEditingQuestions([...checklistQuestions]);
                setChecklistEditorOpen(true);
              }}
              className="text-zinc-500 hover:text-zinc-300 transition-colors p-0.5 cursor-pointer"
              title="Edit checklist questions"
              aria-label="Edit checklist questions"
            >
              <Pencil className="size-3.5" />
            </button>
          </div>
        </div>

        {checklistSectionOpen && (
          <div className="space-y-2 mt-2">
            {checklistQuestions.map((item) => {
              const checked = checkedSet.has(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => handleToggleCheck(item.id)}
                  className="flex items-start gap-2.5 cursor-pointer group py-1 text-xs select-none"
                >
                  {/* Round circular checkbox */}
                  <div
                    className={cn(
                      "size-4 shrink-0 rounded-full border transition-all mt-0.5 flex items-center justify-center",
                      checked
                        ? "bg-[#3ddc84] border-[#3ddc84] text-black shadow-[0_0_8px_rgba(61,220,132,0.5)]"
                        : "border-white/30 group-hover:border-white/60 bg-transparent"
                    )}
                  >
                    {checked && <Check className="size-2.5 stroke-[3]" />}
                  </div>
                  <span
                    className={cn(
                      "leading-snug transition-colors text-xs",
                      checked ? "text-zinc-500 line-through" : "text-zinc-300 group-hover:text-white"
                    )}
                  >
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-white/[0.08]" />

      {/* Section 3: SESSION */}
      <div>
        <div className="flex items-center justify-between select-none mb-2">
          <button
            type="button"
            onClick={() => setSessionSectionOpen(!sessionSectionOpen)}
            className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-[#a1a1aa] hover:text-white uppercase transition-colors cursor-pointer"
          >
            <ChevronDown
              className={cn("size-3.5 transition-transform duration-200", !sessionSectionOpen && "-rotate-90")}
            />
            <span>SESSION</span>
          </button>
          <span className="font-mono text-xs text-zinc-400 font-medium">{activeSessionName}</span>
        </div>

        {sessionSectionOpen && (
          <div className="space-y-1.5 mt-1">
            <div className="flex flex-col gap-0.5">
              <p className="text-xs font-semibold text-white leading-tight">
                {activeSessionTitle}
              </p>
              <div className="flex flex-wrap items-center gap-x-1.5 text-[11px] font-mono">
                <span className="text-zinc-300">{nyTiming}</span>
                <span className="text-zinc-600">·</span>
                <span className="text-emerald-400 font-medium">{istTiming}</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-white/[0.05] text-xs">
              <span className="text-zinc-400">Rules kept</span>
              <span className="font-mono text-zinc-200 font-medium">{rulesKeptDisplay}</span>
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-white/[0.08]" />

      {/* Section 4: RECENT TRADES */}
      <div className="pb-2">
        <div className="flex items-center justify-between select-none mb-2">
          <button
            type="button"
            onClick={() => setTradesSectionOpen(!tradesSectionOpen)}
            className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-[#a1a1aa] hover:text-white uppercase transition-colors cursor-pointer"
          >
            <ChevronDown
              className={cn("size-3.5 transition-transform duration-200", !tradesSectionOpen && "-rotate-90")}
            />
            <span>RECENT TRADES</span>
          </button>
          <Link
            to="/journal"
            className="text-[11px] font-medium text-zinc-400 hover:text-white transition-colors"
          >
            All
          </Link>
        </div>

        {tradesSectionOpen && (
          <div className="space-y-2 mt-1">
            {todayTrades.length === 0 ? (
              <p className="text-xs text-zinc-500 py-1">Nothing logged yet.</p>
            ) : (
              todayTrades.map((t) => {
                const inst = instrumentOf(data, t.market);
                const pnl = tradeDollarPnl(t, inst);
                const isWin = (pnl.net ?? 0) > 0;
                const isLoss = (pnl.net ?? 0) < 0;

                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-2 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          "size-5 rounded flex items-center justify-center text-[10px] font-bold font-mono uppercase",
                          t.side === "long"
                            ? "bg-[#3ddc84]/15 text-[#3ddc84] border border-[#3ddc84]/30"
                            : "bg-[#ff6b7d]/15 text-[#ff6b7d] border border-[#ff6b7d]/30"
                        )}
                      >
                        {t.side === "long" ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-white truncate">{t.market}</span>
                          <span className="font-mono text-[10px] text-zinc-500">{t.time}</span>
                        </div>
                        <p className="font-mono text-[10px] text-zinc-400 truncate">{t.modelName || "Setup"}</p>
                      </div>
                    </div>

                    <div className="text-right font-mono text-xs font-bold shrink-0">
                      <span className={isWin ? "text-[#3ddc84]" : isLoss ? "text-[#ff6b7d]" : "text-zinc-400"}>
                        {fmtCurrency(pnl.net)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Rail in Deep Black / Dark Luxury Theme */}
      <aside
        id="plan-dock-sidebar"
        aria-label="Daily plan rail"
        className={cn(
          "sticky top-3 my-3 mr-3.5 ml-1 hidden h-[calc(100dvh-1.5rem)] shrink-0 flex-col overflow-hidden rounded-[34px] border border-white/[0.08] bg-[#0c0c0e]/95 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.08)] transition-[width,padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[width] lg:flex z-20",
          isOpen ? "w-64 xl:w-72 px-4 py-4" : "w-11 px-1 py-4 cursor-pointer hover:border-white/20 hover:bg-[#0f0f13] group select-none"
        )}
        onClick={!isOpen ? () => handleToggleDock(true) : undefined}
      >
        {!isOpen ? (
          /* Collapsed View in Black Theme */
          <div className="flex h-full w-full flex-col items-center justify-between py-4">
            <div className="flex size-7 items-center justify-center rounded-lg text-zinc-500 group-hover:text-white transition-colors">
              <ChevronsRight className="size-4 rotate-180" />
            </div>
            {/* Vertical text PLAN in Deep Black Rail */}
            <div className="flex flex-1 items-end justify-center pb-6">
              <span className="font-mono text-[11px] font-bold tracking-[0.28em] text-zinc-400 group-hover:text-white transition-colors [writing-mode:vertical-rl] -rotate-180 uppercase select-none">
                PLAN
              </span>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 group-hover:bg-[#3ddc84] transition-colors" />
          </div>
        ) : (
          /* Expanded View in Black Theme */
          <div className="h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pr-0.5">
            {renderPanelContent(false)}
          </div>
        )}
      </aside>

      {/* Mobile Floating Tab & Modal Drawer (for small screens) */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 rounded-l-xl border-l border-y border-white/10 bg-[#0c0c0e]/95 backdrop-blur-xl px-2 py-3 shadow-2xl cursor-pointer hover:border-white/25 active:scale-95 transition-all text-xs font-mono font-bold tracking-widest text-zinc-400 hover:text-white [writing-mode:vertical-rl] -rotate-180 lg:hidden"
        title="Open Plan"
        aria-label="Open Plan"
      >
        PLAN
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm lg:hidden animate-in fade-in-0 duration-200">
          <div className="relative w-80 max-w-[90vw] h-full bg-[#0c0c0e] border-l border-white/[0.08] p-4 shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto">
            {renderPanelContent(true)}
          </div>
        </div>
      )}

      {/* Checklist Question Customization Dialog */}
      <Dialog open={checklistEditorOpen} onOpenChange={setChecklistEditorOpen}>
        <DialogContent className="max-w-md border-white/10 bg-[#121214] text-white">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-white">Customize Plan Checklist</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <p className="text-xs text-zinc-400">
              Customize the checklist questions that appear in your pre-flight Plan rail.
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto [scrollbar-width:none]">
              {editingQuestions.map((q, idx) => (
                <div key={q.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={q.label}
                    onChange={(e) => {
                      const updated = [...editingQuestions];
                      updated[idx] = { ...q, label: e.target.value };
                      setEditingQuestions(updated);
                    }}
                    className="flex-1 bg-black/50 border border-white/15 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setEditingQuestions(editingQuestions.filter((item) => item.id !== q.id));
                    }}
                    className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors rounded hover:bg-white/[0.05]"
                    title="Remove question"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-white/[0.08]">
              <input
                type="text"
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddQuestion()}
                placeholder="Add new question..."
                className="flex-1 bg-black/50 border border-white/15 rounded px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/30"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleAddQuestion}
                className="bg-white/10 hover:bg-white/20 text-white text-xs h-8 px-3"
              >
                <Plus className="size-3.5 mr-1" /> Add
              </Button>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setEditingQuestions(DEFAULT_PLAN_QUESTIONS)}
                className="text-xs text-zinc-400 hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
              >
                Reset to default
              </button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setChecklistEditorOpen(false)}
                  className="border-white/10 text-xs h-8 bg-transparent text-zinc-300 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveChecklistQuestions}
                  className="bg-red-600 hover:bg-red-500 text-white text-xs h-8 px-4"
                >
                  Save changes
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
