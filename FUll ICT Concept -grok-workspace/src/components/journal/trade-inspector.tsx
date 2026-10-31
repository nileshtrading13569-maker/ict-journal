import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Image as ImageIcon,
  Paperclip,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/desk/confirm-delete";
import { useDeskStore } from "@/lib/ict-store";
import { syncDeskToServer } from "@/lib/desk-sync";
import { fmtCurrency, instrumentOf, tradeDollarPnl } from "@/lib/ict-calc";
import { cn, formatR } from "@/lib/utils";
import type { Grade, Trade } from "@/lib/ict-types";

interface TradeInspectorProps {
  trade: Trade | null;
  onClose: () => void;
  onEdit: (trade: Trade) => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

const GRADES: Grade[] = ["A+", "A", "A-", "B", "C", "D", "F"];

export function TradeInspector({
  trade,
  onClose,
  onEdit,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}: TradeInspectorProps) {
  const data = useDeskStore();
  const models = useDeskStore((s) => s.models);
  const removeTrade = useDeskStore((s) => s.removeTrade);
  const updateTradeReview = useDeskStore((s) => s.updateTradeReview);
  const updateTradeRule = useDeskStore((s) => s.updateTradeRule);
  const updateTradeGrade = useDeskStore((s) => s.updateTradeGrade);
  const updateTradePlaybook = useDeskStore((s) => s.updateTradePlaybook);
  const updateTradeTags = useDeskStore((s) => s.updateTradeTags);

  const [activeTab, setActiveTab] = useState<"review" | "execution" | "ict">("review");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newSetup, setNewSetup] = useState("");
  const [addingSetup, setAddingSetup] = useState(false);
  const [newMistake, setNewMistake] = useState("");
  const [addingMistake, setAddingMistake] = useState(false);

  if (!trade) return null;

  const inst = instrumentOf(data, trade.market);
  const pnl = tradeDollarPnl(trade, inst);
  const currentModel = models.find((m) => m.id === trade.modelId || m.name === trade.modelName) ?? models[0];

  // Rules assessment calculation
  const rules = trade.rulesAssessment ?? {};
  const defaultRulesList = [
    { key: "htf_bias", category: "Market conditions", label: "HTF bias aligned on 4H and 1H" },
    { key: "premium_discount", category: "Market conditions", label: "Price trading in premium/discount of the dealing range" },
    { key: "no_news", category: "Market conditions", label: "No high-impact news within 30 min" },
    { key: "sweep", category: "Entry criteria", label: "Liquidity swept before entry" },
    { key: "mss", category: "Entry criteria", label: "5m MSS with displacement" },
    { key: "fvg_entry", category: "Entry criteria", label: "Entry at 5m FVG inside kill zone" },
    { key: "target_opposing", category: "Exit criteria", label: "Target at opposing liquidity pool" },
    { key: "partial_at_2r", category: "Exit criteria", label: "Take partial at 2R or structural target" },
    { key: "risk_limit", category: "Risk", label: "Risk ≤ 0.25% of balance" },
    { key: "stop_placement", category: "Risk", label: "Stop beyond the swept structural high/low" },
  ];

  const followedCount = defaultRulesList.filter((r) => (rules[r.key] ?? "followed") === "followed").length;
  const totalCount = defaultRulesList.length;

  const handleRuleToggle = (ruleKey: string, status: "followed" | "not" | "na") => {
    updateTradeRule(trade.id, ruleKey, status);
    void syncDeskToServer();
  };

  const handleReviewToggle = () => {
    const next = !trade.reviewed;
    updateTradeReview(trade.id, next);
    void syncDeskToServer();
    toast.success(next ? "Marked as reviewed" : "Unmarked reviewed");
  };

  const handleGradeChange = (g: Grade) => {
    updateTradeGrade(trade.id, g);
    void syncDeskToServer();
  };

  const handlePlaybookChange = (nextModelId: string) => {
    const nextModel = models.find((m) => m.id === nextModelId);
    if (!nextModel) return;
    updateTradePlaybook(trade.id, nextModel.id, nextModel.name);
    void syncDeskToServer();
    toast.success(`Assigned to ${nextModel.name}`);
  };

  const setupTags = trade.setupTags ?? trade.tags ?? [];
  const mistakeTags = trade.mistakeTags ?? [];

  const handleAddSetupTag = () => {
    const val = newSetup.trim();
    if (val && !setupTags.includes(val)) {
      updateTradeTags(trade.id, [...setupTags, val], mistakeTags);
      void syncDeskToServer();
    }
    setNewSetup("");
    setAddingSetup(false);
  };

  const handleAddMistakeTag = () => {
    const val = newMistake.trim();
    if (val && !mistakeTags.includes(val)) {
      updateTradeTags(trade.id, setupTags, [...mistakeTags, val]);
      void syncDeskToServer();
    }
    setNewMistake("");
    setAddingMistake(false);
  };

  const handleDelete = () => {
    removeTrade(trade.id);
    void syncDeskToServer();
    toast.success("Trade deleted from journal");
    setDeleteOpen(false);
    onClose();
  };

  const openTimeFormatted = trade.date
    ? new Date(trade.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    : "";

  return (
    <>
      <aside
        aria-label="Trade details inspector"
        className="fixed top-16 right-0 bottom-0 z-30 flex w-full max-w-[560px] flex-col border-l border-white/[0.1] bg-[#0b0b0b] shadow-[-24px_0_48px_-12px_rgba(0,0,0,0.85)]"
      >
        {/* Header */}
        <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/[0.07] px-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="font-display text-[28px] leading-none text-white">{trade.market}</h2>
              <span
                className={cn(
                  "rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.1em] uppercase",
                  trade.side === "long"
                    ? "border border-[#3ddc84]/30 bg-[#3ddc84]/10 text-[#3ddc84]"
                    : "border border-[#ff6b7d]/30 bg-[#ff6b7d]/10 text-[#ff6b7d]",
                )}
              >
                {trade.side}
              </span>
            </div>
            <p className="font-mono mt-1.5 text-[11px] text-[#a2a2a0]">
              {openTimeFormatted} · {trade.time} {trade.exitTime ? `→ ${trade.exitTime}` : ""} ET
            </p>
          </div>

          <div className="flex items-center gap-1 text-[16px] text-[#d6d6d4]">
            <button
              type="button"
              disabled={!hasPrev}
              onClick={onPrev}
              title="Previous trade"
              aria-label="Previous trade"
              className="flex size-8 items-center justify-center rounded-md border border-white/[0.09] transition-colors hover:bg-white/[0.05] disabled:opacity-30"
            >
              <ChevronUp className="size-4" />
            </button>
            <button
              type="button"
              disabled={!hasNext}
              onClick={onNext}
              title="Next trade"
              aria-label="Next trade"
              className="flex size-8 items-center justify-center rounded-md border border-white/[0.09] transition-colors hover:bg-white/[0.05] disabled:opacity-30"
            >
              <ChevronDown className="size-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close panel"
              aria-label="Close panel"
              className="ml-1 flex size-8 items-center justify-center rounded-md text-[#a2a2a0] transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* 4 Quick Stats */}
        <div className="grid h-16 shrink-0 grid-cols-4 border-b border-white/[0.07] px-5">
          <div className="flex flex-col justify-center">
            <p className="text-[10px] font-semibold tracking-[0.12em] text-[#a2a2a0] uppercase">Lots</p>
            <p className="font-mono mt-0.5 text-[17px] text-[#f5f5f4]">{trade.lots ?? "—"}</p>
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-[10px] font-semibold tracking-[0.12em] text-[#a2a2a0] uppercase">Net P&amp;L</p>
            <p
              className={cn(
                "font-mono mt-0.5 text-[17px]",
                pnl.net == null
                  ? "text-[#6f6f6d]"
                  : pnl.net >= 0
                    ? "text-[#3ddc84]"
                    : "text-[#ff6b7d]",
              )}
            >
              {fmtCurrency(pnl.net)}
            </p>
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-[10px] font-semibold tracking-[0.12em] text-[#a2a2a0] uppercase">Realized R</p>
            <p
              className={cn(
                "font-mono mt-0.5 text-[17px]",
                trade.rMultiple == null
                  ? "text-[#6f6f6d]"
                  : trade.rMultiple >= 0
                    ? "text-[#3ddc84]"
                    : "text-[#ff6b7d]",
              )}
            >
              {trade.rMultiple != null ? formatR(trade.rMultiple) : "—"}
            </p>
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-[10px] font-semibold tracking-[0.12em] text-[#a2a2a0] uppercase">Status</p>
            <p className="mt-1">
              <span
                className={cn(
                  "rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.08em] uppercase",
                  trade.result === "win"
                    ? "border border-[#3ddc84]/30 bg-[#3ddc84]/10 text-[#3ddc84]"
                    : trade.result === "loss"
                      ? "border border-[#ff6b7d]/30 bg-[#ff6b7d]/10 text-[#ff6b7d]"
                      : trade.result === "be"
                        ? "border border-white/[0.14] bg-white/[0.05] text-[#d6d6d4]"
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
            </p>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex h-10 shrink-0 items-end gap-6 border-b border-white/[0.07] px-5 text-[11px] font-semibold tracking-[0.14em] uppercase">
          <button
            type="button"
            onClick={() => setActiveTab("review")}
            className={cn(
              "pb-2.5 transition-colors",
              activeTab === "review"
                ? "border-b-2 border-[#e50914] text-white"
                : "text-[#a2a2a0] hover:text-white",
            )}
          >
            Review
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("execution")}
            className={cn(
              "pb-2.5 transition-colors",
              activeTab === "execution"
                ? "border-b-2 border-[#e50914] text-white"
                : "text-[#a2a2a0] hover:text-white",
            )}
          >
            Execution
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ict")}
            className={cn(
              "pb-2.5 transition-colors",
              activeTab === "ict"
                ? "border-b-2 border-[#e50914] text-white"
                : "text-[#a2a2a0] hover:text-white",
            )}
          >
            ICT
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {activeTab === "review" ? (
            <div className="space-y-5">
              {/* Playbook selector */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <p className="mb-1.5 text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                    Playbook
                  </p>
                  <div className="relative">
                    <select
                      value={currentModel.id}
                      onChange={(e) => handlePlaybookChange(e.target.value)}
                      aria-label="Selected Playbook"
                      className="flex h-10 w-full appearance-none items-center justify-between rounded-md border border-white/[0.09] bg-[#151515]/80 px-3 pr-8 text-[13px] text-white outline-none focus-visible:border-[#e50914]"
                    >
                      {models.map((m) => (
                        <option key={m.id} value={m.id} className="bg-[#151515] text-white">
                          [{m.code}] {m.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute top-3 right-3 size-4 text-[#a2a2a0]" />
                  </div>
                </div>
                <Link
                  to="/playbook"
                  className="flex h-10 items-center gap-1 rounded-md border border-white/[0.09] bg-white/[0.03] px-3 text-[12px] font-medium text-[#d6d6d4] transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  Open playbook <ChevronRight className="size-3.5" />
                </Link>
              </div>

              {/* Rules Section */}
              <div>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-[13px] font-semibold text-white">Rules</h3>
                  <p className="text-[12px] text-[#a2a2a0]">
                    <span className="font-mono text-[#f5f5f4]">{followedCount}</span> of{" "}
                    <span className="font-mono text-[#f5f5f4]">{totalCount}</span> followed
                  </p>
                </div>

                {["Market conditions", "Entry criteria", "Exit criteria", "Risk"].map((category) => {
                  const items = defaultRulesList.filter((r) => r.category === category);
                  return (
                    <div key={category} className="mt-3">
                      <p className="mb-1 text-[10px] font-semibold tracking-[0.14em] text-[#a2a2a0] uppercase">
                        {category}
                      </p>
                      {items.map((r) => {
                        const st = rules[r.key] ?? "followed";
                        return (
                          <div
                            key={r.key}
                            className="flex min-h-11 items-center justify-between gap-3 border-b border-white/[0.05] py-1.5 text-[13px]"
                          >
                            <span className="text-[#e8e8e6]">{r.label}</span>
                            <div className="flex shrink-0 overflow-hidden rounded-md border border-white/[0.1] text-[11px] font-medium">
                              <button
                                type="button"
                                onClick={() => handleRuleToggle(r.key, "followed")}
                                className={cn(
                                  "px-2.5 py-1.5 transition-colors",
                                  st === "followed"
                                    ? "bg-[#3ddc84]/15 text-[#3ddc84]"
                                    : "text-[#a2a2a0] hover:text-white",
                                )}
                              >
                                Followed
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRuleToggle(r.key, "not")}
                                className={cn(
                                  "border-l border-white/[0.1] px-2.5 py-1.5 transition-colors",
                                  st === "not"
                                    ? "bg-[#ff6b7d]/15 text-[#ff6b7d]"
                                    : "text-[#a2a2a0] hover:text-white",
                                )}
                              >
                                Not
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRuleToggle(r.key, "na")}
                                className={cn(
                                  "border-l border-white/[0.1] px-2.5 py-1.5 transition-colors",
                                  st === "na"
                                    ? "bg-white/[0.1] text-white"
                                    : "text-[#a2a2a0] hover:text-white",
                                )}
                              >
                                N/A
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Tags Section */}
              <div className="border-t border-white/[0.07] pt-4">
                <h3 className="text-[13px] font-semibold text-white">Tags</h3>
                <div className="mt-2 grid grid-cols-[72px_1fr] items-center gap-y-2 text-[12px]">
                  <span className="text-[#a2a2a0]">Setups</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {setupTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-white/[0.12] bg-white/[0.04] px-2 py-1 text-white"
                      >
                        {tag}
                      </span>
                    ))}
                    {addingSetup ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={newSetup}
                          onChange={(e) => setNewSetup(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSetupTag())}
                          placeholder="Tag"
                          className="h-7 w-24 rounded border border-white/[0.2] bg-[#151515] px-2 text-xs text-white"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleAddSetupTag}
                          className="text-xs text-[#3ddc84] hover:underline"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddingSetup(true)}
                        className="rounded-md border border-dashed border-white/[0.14] px-2 py-1 text-[#a2a2a0] hover:border-white/[0.3] hover:text-white"
                      >
                        + Add
                      </button>
                    )}
                  </div>

                  <span className="text-[#a2a2a0]">Mistakes</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {mistakeTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-[#f5b942]/30 bg-[#f5b942]/10 px-2 py-1 text-[#f5b942]"
                      >
                        {tag}
                      </span>
                    ))}
                    {addingMistake ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={newMistake}
                          onChange={(e) => setNewMistake(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddMistakeTag())}
                          placeholder="Mistake"
                          className="h-7 w-24 rounded border border-white/[0.2] bg-[#151515] px-2 text-xs text-white"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleAddMistakeTag}
                          className="text-xs text-[#3ddc84] hover:underline"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddingMistake(true)}
                        className="rounded-md border border-dashed border-white/[0.14] px-2 py-1 text-[#a2a2a0] hover:border-white/[0.3] hover:text-white"
                      >
                        + Add
                      </button>
                    )}
                  </div>

                  <span className="text-[#a2a2a0]">Grade</span>
                  <div className="font-mono flex flex-wrap gap-1 text-[12px]">
                    {GRADES.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => handleGradeChange(g)}
                        className={cn(
                          "rounded-md border px-2 py-1 transition-colors",
                          trade.grade === g
                            ? "border-[#e50914] bg-[#e50914] font-semibold text-white"
                            : "border-white/[0.1] text-[#a2a2a0] hover:border-white/[0.2] hover:text-white",
                        )}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Trade Note */}
              <div className="border-t border-white/[0.07] pt-4">
                <h3 className="text-[13px] font-semibold text-white">Trade note</h3>
                <p className="mt-2 rounded-md border border-white/[0.08] bg-[#151515]/70 p-3 text-[13px] leading-relaxed text-[#d6d6d4]">
                  {trade.notes || "No notes logged for this trade."}
                </p>
              </div>

              {/* Attachments */}
              <div className="border-t border-white/[0.07] pt-4 pb-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold text-white">Attachments</h3>
                  <button
                    type="button"
                    onClick={() => onEdit(trade)}
                    className="flex items-center gap-1 text-[12px] text-[#a2a2a0] hover:text-white"
                  >
                    <Paperclip className="size-3.5" /> Add
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="flex h-24 flex-col justify-end rounded-md border border-white/[0.08] bg-[#151515] p-2 text-[11px] text-[#a2a2a0]">
                    <ImageIcon className="mb-auto size-4 text-[#6f6f6d]" />
                    HTF chart · 1H
                  </div>
                  <div className="flex h-24 flex-col justify-end rounded-md border border-white/[0.08] bg-[#151515] p-2 text-[11px] text-[#a2a2a0]">
                    <ImageIcon className="mb-auto size-4 text-[#6f6f6d]" />
                    Execution · 5m
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === "execution" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <div className="rounded-md border border-white/[0.07] bg-[#151515] p-3">
                  <p className="text-[11px] text-[#a2a2a0] uppercase">Entry price</p>
                  <p className="font-mono mt-1 text-[16px] text-white">
                    {trade.entry != null ? trade.entry.toFixed(inst?.digits ?? 2) : "—"}
                  </p>
                </div>
                <div className="rounded-md border border-white/[0.07] bg-[#151515] p-3">
                  <p className="text-[11px] text-[#a2a2a0] uppercase">Exit price</p>
                  <p className="font-mono mt-1 text-[16px] text-white">
                    {trade.exitPrice != null ? trade.exitPrice.toFixed(inst?.digits ?? 2) : "—"}
                  </p>
                </div>
                <div className="rounded-md border border-white/[0.07] bg-[#151515] p-3">
                  <p className="text-[11px] text-[#a2a2a0] uppercase">Stop loss</p>
                  <p className="font-mono mt-1 text-[16px] text-[#ff6b7d]">
                    {trade.sl != null ? trade.sl.toFixed(inst?.digits ?? 2) : "—"}
                  </p>
                </div>
                <div className="rounded-md border border-white/[0.07] bg-[#151515] p-3">
                  <p className="text-[11px] text-[#a2a2a0] uppercase">Target (TP)</p>
                  <p className="font-mono mt-1 text-[16px] text-[#3ddc84]">
                    {trade.tp1 != null ? trade.tp1.toFixed(inst?.digits ?? 2) : "—"}
                  </p>
                </div>
                <div className="rounded-md border border-white/[0.07] bg-[#151515] p-3">
                  <p className="text-[11px] text-[#a2a2a0] uppercase">MAE</p>
                  <p className="font-mono mt-1 text-[15px] text-[#d6d6d4]">
                    {trade.maeR != null ? `${trade.maeR}R` : "—"}
                  </p>
                </div>
                <div className="rounded-md border border-white/[0.07] bg-[#151515] p-3">
                  <p className="text-[11px] text-[#a2a2a0] uppercase">MFE</p>
                  <p className="font-mono mt-1 text-[15px] text-[#d6d6d4]">
                    {trade.mfeR != null ? `${trade.mfeR}R` : "—"}
                  </p>
                </div>
              </div>

              <div className="rounded-md border border-white/[0.07] bg-[#151515] p-3 text-[13px]">
                <p className="text-[11px] text-[#a2a2a0] uppercase">Fees &amp; Risk summary</p>
                <div className="font-mono mt-2 flex justify-between border-b border-white/[0.05] pb-1 text-[12px]">
                  <span className="text-[#a2a2a0]">Commissions / Fees:</span>
                  <span className="text-white">${trade.fees != null ? trade.fees.toFixed(2) : "1.75"}</span>
                </div>
                <div className="font-mono mt-1 flex justify-between border-b border-white/[0.05] pb-1 text-[12px]">
                  <span className="text-[#a2a2a0]">Gross P&amp;L:</span>
                  <span className="text-white">{fmtCurrency(pnl.gross)}</span>
                </div>
                <div className="font-mono mt-1 flex justify-between text-[12px]">
                  <span className="text-[#a2a2a0]">Net P&amp;L:</span>
                  <span className={pnl.net && pnl.net >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]"}>
                    {fmtCurrency(pnl.net)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-[13px]">
              <div className="rounded-md border border-white/[0.07] bg-[#151515] p-3">
                <p className="text-[11px] text-[#a2a2a0] uppercase">Higher Timeframe Bias</p>
                <p className="mt-1 font-medium capitalize text-white">
                  Weekly {trade.weeklyBias} · Daily {trade.dailyBias}
                </p>
              </div>
              <div className="rounded-md border border-white/[0.07] bg-[#151515] p-3">
                <p className="text-[11px] text-[#a2a2a0] uppercase">Dealing Range &amp; Location</p>
                <p className="mt-1 font-medium capitalize text-white">
                  {trade.location} of {trade.dealingRangeLabel || "Daily"} range
                </p>
              </div>
              <div className="rounded-md border border-white/[0.07] bg-[#151515] p-3">
                <p className="text-[11px] text-[#a2a2a0] uppercase">Liquidity Pools</p>
                <p className="mt-1 text-white">
                  Taken: {trade.taken.length ? trade.taken.join(", ") : "None marked"}
                  <br />
                  Target: {trade.targetLiq.length ? trade.targetLiq.join(", ") : "None marked"}
                </p>
              </div>
              <div className="rounded-md border border-white/[0.07] bg-[#151515] p-3">
                <p className="text-[11px] text-[#a2a2a0] uppercase">Timing &amp; Session</p>
                <p className="mt-1 text-white">
                  {trade.session || "NY"} · {trade.killZone || "NY AM Kill Zone"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex h-16 shrink-0 items-center justify-between border-t border-white/[0.07] px-5">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#d6d6d4]">
            <input
              type="checkbox"
              checked={Boolean(trade.reviewed)}
              onChange={handleReviewToggle}
              className="size-4 rounded border-white/[0.25] bg-white/[0.04] text-[#e50914] focus:ring-[#e50914]"
            />
            Mark reviewed
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              title="Delete trade"
              aria-label="Delete trade"
              className="flex size-9 items-center justify-center rounded-md text-[15px] text-[#a2a2a0] transition-colors hover:bg-white/[0.06] hover:text-[#ff6b7d]"
            >
              <Trash2 className="size-4" />
            </button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onEdit(trade)}
              className="flex h-9 items-center gap-1.5 rounded-md border-white/[0.12] bg-white/[0.04] px-3.5 text-[13px] font-semibold text-white hover:bg-white/[0.08]"
            >
              <Pencil className="size-3.5" /> Edit trade
            </Button>
          </div>
        </div>
      </aside>

      <ConfirmDelete
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete trade?"
        description="This removes the research row from your journal ledger."
        onConfirm={handleDelete}
      />
    </>
  );
}
