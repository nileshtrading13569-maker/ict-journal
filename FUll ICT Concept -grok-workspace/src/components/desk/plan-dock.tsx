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
import { todayISO, nyParts, nowHHMM } from "@/lib/ict-time";
import { fmtCurrency, instrumentOf, tradeDollarPnl } from "@/lib/ict-calc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface PlanQuestion {
  id: string;
  label: string;
}

export const DEFAULT_PLAN_QUESTIONS: PlanQuestion[] = [
  { id: "plan-q1", label: "Have you done your high timeframe?" },
  { id: "plan-q2", label: "Do you have that FVG gap?" },
  { id: "plan-q3", label: "Do we have an inverse to the upside?" },
  { id: "plan-q4", label: "Did we think about this entry before entering?" },
];

const PLAN_QUESTIONS_KEY = "ict-desk-plan-questions-v2";
const PLAN_DOCK_OPEN_KEY = "ict-desk-plan-dock-open";

export function PlanDock() {
  const data = useDeskStore();
  const dailyPlans = useDeskStore((s) => s.dailyPlans);
  const checks = useDeskStore((s) => s.checks);
  const trades = useDeskStore((s) => s.trades);
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

  // Checklist questions
  const [checklistQuestions, setChecklistQuestions] = useState<PlanQuestion[]>(() => {
    if (typeof window === "undefined") return DEFAULT_PLAN_QUESTIONS;
    try {
      const saved = window.localStorage.getItem(PLAN_QUESTIONS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_PLAN_QUESTIONS;
  });

  // Checklist editor modal state
  const [checklistEditorOpen, setChecklistEditorOpen] = useState(false);
  const [editingQuestions, setEditingQuestions] = useState<PlanQuestion[]>(checklistQuestions);
  const [newQuestionText, setNewQuestionText] = useState("");

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

  const handleSaveChecklistQuestions = () => {
    const valid = editingQuestions.filter((q) => q.label.trim().length > 0);
    const finalQuestions = valid.length > 0 ? valid : DEFAULT_PLAN_QUESTIONS;
    setChecklistQuestions(finalQuestions);
    try {
      window.localStorage.setItem(PLAN_QUESTIONS_KEY, JSON.stringify(finalQuestions));
    } catch {
      // ignore
    }
    setChecklistEditorOpen(false);
    toast.success("Checklist questions updated");
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

  // Active session and rules kept calculations
  const { activeSessionName, activeSessionDetail, rulesKeptDisplay } = useMemo(() => {
    const time = nowHHMM();
    let session = "—";
    let detail = "—";

    // ICT Kill Zones in NY Time (HH:MM)
    if (time >= "02:00" && time <= "05:00") {
      session = "London KZ";
      detail = "London Kill Zone (02:00–05:00 NY)";
    } else if (time >= "07:00" && time <= "10:00") {
      session = "NY AM KZ";
      detail = "NY AM Kill Zone (07:00–10:00 NY)";
    } else if (time > "10:00" && time <= "11:30") {
      session = "NY Continuation";
      detail = "NY Continuation Window";
    } else if (time >= "13:30" && time <= "16:00") {
      session = "NY PM";
      detail = "NY PM Session (13:30–16:00 NY)";
    } else if (time >= "19:00" || time <= "00:00") {
      session = "Asia Session";
      detail = "Asia Accumulation";
    }

    // Rules kept for today's closed trades
    const todayTrades = trades.filter((t) => t.date === today);
    let rulesKept = "—";
    if (todayTrades.length > 0) {
      const followed = todayTrades.filter((t) => t.ruleFollowed).length;
      const pct = Math.round((followed / todayTrades.length) * 100);
      rulesKept = `${pct}%`;
    }

    return {
      activeSessionName: session,
      activeSessionDetail: detail,
      rulesKeptDisplay: rulesKept,
    };
  }, [trades, today]);

  // Today's recent trades
  const todayTrades = useMemo(() => {
    return trades
      .filter((t) => t.date === today)
      .slice(0, 5)
      .sort((a, b) => (b.time || "").localeCompare(a.time || ""));
  }, [trades, today]);

  // Reusable panel content matching exact styling from Image 3
  const renderPanelContent = (isMobileView = false) => (
    <div className="flex flex-col h-full space-y-4 text-[#334155] font-sans">
      {/* Top Header Row (Matches Image 3) */}
      <div className="flex items-center justify-between pb-3">
        <button
          type="button"
          onClick={() => (isMobileView ? setMobileOpen(false) : handleToggleDock(false))}
          className="flex size-6 items-center justify-center text-[#64748b] hover:text-[#1e293b] transition-colors cursor-pointer"
          title="Collapse plan rail"
          aria-label="Collapse plan rail"
        >
          <ChevronsRight className="size-4" />
        </button>
        <span className="font-sans text-sm font-semibold text-[#334155] tracking-tight">
          {dateMMDD}
        </span>
      </div>

      {/* Section 1: THE PLAN (Matches Image 3) */}
      <div>
        <div className="flex items-center justify-between select-none mb-2">
          <button
            type="button"
            onClick={() => setPlanSectionOpen(!planSectionOpen)}
            className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-[#718096] hover:text-[#2d3748] uppercase transition-colors"
          >
            <ChevronDown
              className={cn("size-3.5 transition-transform duration-200", !planSectionOpen && "-rotate-90")}
            />
            <span>THE PLAN</span>
          </button>
          <button
            type="button"
            onClick={() => setIsEditingPlan(!isEditingPlan)}
            className="text-[12px] font-normal text-[#4a5568] hover:text-[#1a202c] transition-colors cursor-pointer"
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
                  className="w-full text-xs bg-white border border-[#cbd5e1] rounded-lg p-2.5 text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:border-[#64748b] focus:ring-1 focus:ring-[#94a3b8] resize-none font-sans"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDraftPlan(planNotes);
                      setIsEditingPlan(false);
                    }}
                    className="px-2.5 py-1 text-[11px] font-medium text-[#64748b] hover:text-[#1e293b] rounded border border-[#cbd5e1] bg-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePlan}
                    className="px-3 py-1 text-[11px] font-semibold text-white bg-[#0f172a] hover:bg-[#1e293b] rounded transition-colors shadow-xs"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : planNotes ? (
              <div
                onClick={() => setIsEditingPlan(true)}
                className="group relative rounded-lg border border-dashed border-[#cbd5e1] bg-white/70 p-3 text-xs text-[#334155] hover:border-[#94a3b8] hover:bg-white transition-all cursor-pointer whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto [scrollbar-width:none]"
              >
                {planNotes}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Pencil className="size-3 text-[#64748b]" />
                </div>
              </div>
            ) : (
              /* The exact dashed rounded box from Image 3 */
              <button
                type="button"
                onClick={() => setIsEditingPlan(true)}
                className="w-full rounded-lg border border-dashed border-[#cbd5e1] bg-white/40 py-3.5 px-3 text-center text-xs text-[#475569] hover:border-[#94a3b8] hover:bg-white/80 hover:text-[#1e293b] transition-all cursor-pointer"
              >
                No pre-market plan yet
              </button>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-[#e2e8f0]" />

      {/* Section 2: CHECKLIST (Matches Image 3) */}
      <div>
        <div className="flex items-center justify-between select-none mb-2">
          <button
            type="button"
            onClick={() => setChecklistSectionOpen(!checklistSectionOpen)}
            className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-[#718096] hover:text-[#2d3748] uppercase transition-colors"
          >
            <ChevronDown
              className={cn("size-3.5 transition-transform duration-200", !checklistSectionOpen && "-rotate-90")}
            />
            <span>CHECKLIST</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="font-sans text-[12px] font-normal text-[#64748b]">
              {completedChecklistCount}/{checklistQuestions.length}
            </span>
            <button
              type="button"
              onClick={() => {
                setEditingQuestions([...checklistQuestions]);
                setChecklistEditorOpen(true);
              }}
              className="text-[#718096] hover:text-[#1e293b] transition-colors p-0.5 cursor-pointer"
              title="Edit checklist questions"
              aria-label="Edit checklist questions"
            >
              <Pencil className="size-3.5" />
            </button>
          </div>
        </div>

        {checklistSectionOpen && (
          <div className="space-y-2.5 mt-2">
            {checklistQuestions.map((item) => {
              const checked = checkedSet.has(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => handleToggleCheck(item.id)}
                  className="flex items-start gap-2.5 cursor-pointer group py-0.5 text-xs select-none"
                >
                  {/* Round circular checkbox matching Image 3 */}
                  <div
                    className={cn(
                      "size-4 shrink-0 rounded-full border transition-all mt-0.5 flex items-center justify-center",
                      checked
                        ? "bg-[#10b981] border-[#10b981] text-white shadow-xs"
                        : "border-[#94a3b8] group-hover:border-[#475569] bg-white"
                    )}
                  >
                    {checked && <Check className="size-2.5 stroke-[3]" />}
                  </div>
                  <span
                    className={cn(
                      "leading-snug transition-colors text-[12.5px]",
                      checked ? "text-[#94a3b8] line-through" : "text-[#334155] group-hover:text-[#0f172a]"
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
      <div className="border-t border-[#e2e8f0]" />

      {/* Section 3: SESSION (Matches Image 3) */}
      <div>
        <div className="flex items-center justify-between select-none mb-1">
          <button
            type="button"
            onClick={() => setSessionSectionOpen(!sessionSectionOpen)}
            className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-[#718096] hover:text-[#2d3748] uppercase transition-colors"
          >
            <ChevronDown
              className={cn("size-3.5 transition-transform duration-200", !sessionSectionOpen && "-rotate-90")}
            />
            <span>SESSION</span>
          </button>
          <span className="font-sans text-xs text-[#718096] font-medium">{activeSessionName}</span>
        </div>

        {sessionSectionOpen && (
          <div className="space-y-2 mt-1">
            <p className="text-xs font-semibold text-[#1e293b]">
              {activeSessionDetail !== "—" ? activeSessionDetail : "—"}
            </p>
            <div className="flex items-center justify-between pt-1 text-[12.5px]">
              <span className="text-[#475569]">Rules kept</span>
              <span className="font-sans text-[#475569] font-medium">{rulesKeptDisplay}</span>
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-[#e2e8f0]" />

      {/* Section 4: RECENT TRADES (Matches Image 3) */}
      <div className="pb-2">
        <div className="flex items-center justify-between select-none mb-2">
          <button
            type="button"
            onClick={() => setTradesSectionOpen(!tradesSectionOpen)}
            className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-[#718096] hover:text-[#2d3748] uppercase transition-colors"
          >
            <ChevronDown
              className={cn("size-3.5 transition-transform duration-200", !tradesSectionOpen && "-rotate-90")}
            />
            <span>RECENT TRADES</span>
          </button>
          <Link
            to="/journal"
            className="text-[12px] font-normal text-[#4a5568] hover:text-[#1a202c] transition-colors"
          >
            All
          </Link>
        </div>

        {tradesSectionOpen && (
          <div className="space-y-2 mt-1">
            {todayTrades.length === 0 ? (
              /* Exact text from Image 3: Nothing logged yet. */
              <p className="text-xs text-[#64748b] py-1">Nothing logged yet.</p>
            ) : (
              todayTrades.map((t) => {
                const inst = instrumentOf(data, t.market);
                const pnl = tradeDollarPnl(t, inst);
                const isWin = (pnl.net ?? 0) > 0;
                const isLoss = (pnl.net ?? 0) < 0;

                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-2 rounded-lg border border-[#cbd5e1] bg-white/60 hover:bg-white transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          "size-5 rounded flex items-center justify-center text-[10px] font-bold font-mono uppercase",
                          t.side === "long"
                            ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                            : "bg-rose-100 text-rose-700 border border-rose-300"
                        )}
                      >
                        {t.side === "long" ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[#0f172a] truncate">{t.market}</span>
                          <span className="font-mono text-[10px] text-[#64748b]">{t.time}</span>
                        </div>
                        <p className="font-mono text-[10px] text-[#475569] truncate">{t.modelName || "Setup"}</p>
                      </div>
                    </div>

                    <div className="text-right font-mono text-xs font-bold shrink-0">
                      <span className={isWin ? "text-emerald-600" : isLoss ? "text-rose-600" : "text-[#64748b]"}>
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
      {/* Desktop Persistent Rail matching Image 2 (Collapsed) and Image 3 (Expanded) */}
      <aside
        id="plan-dock-sidebar"
        aria-label="Daily plan rail"
        className={cn(
          "sticky top-3 my-3 mr-3.5 ml-1 hidden h-[calc(100dvh-1.5rem)] shrink-0 flex-col overflow-hidden rounded-[30px] border border-[#cbd5e1]/80 bg-[#edf1f7] shadow-[0_10px_35px_rgba(0,0,0,0.15)] transition-[width,padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[width] lg:flex z-20",
          isOpen ? "w-64 xl:w-72 px-4 py-4" : "w-11 px-1 py-4 cursor-pointer hover:bg-[#e4e9f2] group select-none"
        )}
        onClick={!isOpen ? () => handleToggleDock(true) : undefined}
      >
        {!isOpen ? (
          /* Exact Collapsed View matching Image 2 */
          <div className="flex h-full w-full flex-col items-center justify-between py-4">
            <div className="flex size-7 items-center justify-center rounded-lg text-[#64748b] group-hover:text-[#1e293b] transition-colors">
              <ChevronsRight className="size-4 rotate-180" />
            </div>
            {/* Vertical text PLAN matching Image 2 */}
            <div className="flex flex-1 items-end justify-center pb-6">
              <span className="font-sans text-[11px] font-bold tracking-[0.25em] text-[#475569] group-hover:text-[#0f172a] transition-colors [writing-mode:vertical-rl] -rotate-180 uppercase select-none">
                PLAN
              </span>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-[#94a3b8] group-hover:bg-[#10b981] transition-colors" />
          </div>
        ) : (
          /* Exact Expanded View matching Image 3 */
          <div className="h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pr-0.5">
            {renderPanelContent(false)}
          </div>
        )}
      </aside>

      {/* Mobile Floating Tab & Modal Drawer (for small screens) */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 rounded-l-xl border-l border-y border-[#cbd5e1] bg-[#edf1f7] px-2 py-3 shadow-xl cursor-pointer hover:bg-[#e4e9f2] active:scale-95 transition-all text-xs font-sans font-bold tracking-widest text-[#475569] hover:text-[#0f172a] [writing-mode:vertical-rl] -rotate-180 lg:hidden"
        title="Open Plan"
        aria-label="Open Plan"
      >
        PLAN
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs lg:hidden animate-in fade-in-0 duration-200">
          <div className="relative w-80 max-w-[90vw] h-full bg-[#edf1f7] border-l border-[#cbd5e1] p-4 shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto">
            {renderPanelContent(true)}
          </div>
        </div>
      )}

      {/* Checklist Question Customization Dialog */}
      <Dialog open={checklistEditorOpen} onOpenChange={setChecklistEditorOpen}>
        <DialogContent className="max-w-md border-[#cbd5e1] bg-[#edf1f7] text-[#1e293b]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-[#0f172a]">Customize Plan Checklist</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <p className="text-xs text-[#64748b]">
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
                    className="flex-1 bg-white border border-[#cbd5e1] rounded px-2.5 py-1.5 text-xs text-[#1e293b] focus:outline-none focus:border-[#64748b]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setEditingQuestions(editingQuestions.filter((item) => item.id !== q.id));
                    }}
                    className="p-1.5 text-[#94a3b8] hover:text-red-500 transition-colors rounded hover:bg-white"
                    title="Remove question"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-[#cbd5e1]">
              <input
                type="text"
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddQuestion()}
                placeholder="Add new question..."
                className="flex-1 bg-white border border-[#cbd5e1] rounded px-2.5 py-1.5 text-xs text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:border-[#64748b]"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleAddQuestion}
                className="bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs h-8 px-3"
              >
                <Plus className="size-3.5 mr-1" /> Add
              </Button>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#cbd5e1]">
              <button
                type="button"
                onClick={() => setEditingQuestions(DEFAULT_PLAN_QUESTIONS)}
                className="text-xs text-[#64748b] hover:text-[#0f172a] underline underline-offset-2 transition-colors cursor-pointer"
              >
                Reset to default
              </button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setChecklistEditorOpen(false)}
                  className="border-[#cbd5e1] text-xs h-8 bg-white text-[#334155]"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveChecklistQuestions}
                  className="bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs h-8 px-4"
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
