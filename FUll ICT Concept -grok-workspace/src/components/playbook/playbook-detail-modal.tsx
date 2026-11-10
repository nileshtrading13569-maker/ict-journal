import { useState, useMemo } from "react";
import {
  Check,
  X,
  Pencil,
  RotateCcw,
  Trash2,
  Activity,
  Target,
  TrendingUp,
  TrendingDown,
  Award,
  ListChecks,
  LayoutGrid,
  FileText,
  Image,
  Plus,
  Eye,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { closedTrades, fmtCurrency, instrumentOf, tradeDollarPnl } from "@/lib/ict-calc";
import { deskSnapshot, useDeskStore } from "@/lib/ict-store";
import { formatR } from "@/lib/utils";
import { toast } from "sonner";
import { syncDeskToServer } from "@/lib/desk-sync";
import { TradeInspectorDialog } from "@/components/journal/trade-inspector-dialog";
import { TradeFormModal } from "@/components/journal/trade-form-modal";
import { calculateTradeRuleAdherence } from "@/lib/tradezella-helpers";
import type { SetupModel, Trade } from "@/lib/ict-types";

interface PlaybookDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: (SetupModel & { snapshot?: string; notes?: string }) | null;
  onEdit: (model: SetupModel) => void;
  onToggleActive?: (model: SetupModel) => void;
  onDelete?: (model: SetupModel) => void;
  snapshot?: string;
}

export function PlaybookDetailModal({
  open,
  onOpenChange,
  model,
  onEdit,
  onToggleActive,
  onDelete,
  snapshot: propSnapshot,
}: PlaybookDetailModalProps) {
  const data = useDeskStore();
  const trades = useDeskStore((s) => s.trades);
  const models = useDeskStore((s) => s.models);
  const removeTrade = useDeskStore((s) => s.removeTrade);
  const upsertTrade = useDeskStore((s) => s.upsertTrade);

  const [activeTab, setActiveTab] = useState<"overview" | "trades" | "rules" | "notes">("overview");
  const [tradeFilter, setTradeFilter] = useState<"all" | "win" | "loss" | "be">("all");
  const [inspectingTrade, setInspectingTrade] = useState<Trade | null>(null);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [creatingTrade, setCreatingTrade] = useState(false);

  // Interactive local checkbox state for valid and invalid rules preview
  const [checkedValidRules, setCheckedValidRules] = useState<Record<number, boolean>>({});
  const [checkedInvalidRules, setCheckedInvalidRules] = useState<Record<number, boolean>>({});

  if (!model) return null;

  // Filter sample trades associated with this model
  const sample = closedTrades(
    trades.filter(
      (t) =>
        t.modelId === model.id ||
        (t.modelName && t.modelName.toLowerCase() === model.name.toLowerCase()),
    ),
  );

  const wins = sample.filter((t) => t.result === "win");
  const losses = sample.filter((t) => t.result === "loss");
  const bes = sample.filter((t) => t.result === "be");

  const wr = sample.length ? Math.round((wins.length / sample.length) * 100) : 0;
  const netPnL = sample.reduce((acc, t) => {
    const pnl = tradeDollarPnl(t, instrumentOf(data, t.market));
    return acc + (pnl.net ?? 0);
  }, 0);
  const sumR = sample.reduce((acc, t) => acc + (t.rMultiple ?? 0), 0);
  const avgR = sample.length ? Number((sumR / sample.length).toFixed(2)) : 0;

  // Filtered trades for the gallery
  const filteredGalleryTrades = sample.filter((t) => {
    if (tradeFilter === "all") return true;
    return t.result === tradeFilter;
  });

  // Calculate rules followed adherence
  let totalAssessed = 0;
  let totalFollowed = 0;
  for (const t of sample) {
    const adherence = calculateTradeRuleAdherence(t, model);
    totalAssessed += adherence.total;
    totalFollowed += adherence.followed;
  }
  const rulesFollowedPct = totalAssessed > 0 ? Math.round((totalFollowed / totalAssessed) * 100) : 100;

  const validRulesList = model.validWhen?.length
    ? model.validWhen
    : [
        "HTF narrative aligned with dealing range",
        "Key liquidity pool swept (BSL / SSL)",
        "Displacement with clean FVG confirmation",
        "Execution within primary session kill zone",
      ];

  const invalidRulesList = model.invalidWhen?.length
    ? model.invalidWhen
    : [
        "Price trading in mid-range of dealing range",
        "Opposing HTF key level unmitigated",
        "Target already delivered prior to entry",
      ];

  const toggleValidRule = (index: number) => {
    setCheckedValidRules((prev) => ({
      ...prev,
      [index]: prev[index] === undefined ? false : !prev[index],
    }));
  };

  const toggleInvalidRule = (index: number) => {
    setCheckedInvalidRules((prev) => ({
      ...prev,
      [index]: prev[index] === undefined ? true : !prev[index],
    }));
  };

  const notesText = model.description || model.notes || "";
  const blueprintSnapshot = propSnapshot || model.snapshot || model.canvasBlueprint;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          aria-describedby="playbook-detail-desc"
          className="max-h-[92vh] w-[95vw] max-w-[840px] overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0c0c0c] p-0 text-[#f5f5f4] shadow-[0_30px_90px_-20px_rgba(0,0,0,0.95)]"
        >
          <DialogTitle className="sr-only">{model.name}</DialogTitle>
          <DialogDescription id="playbook-detail-desc" className="sr-only">
            Playbook specifications, rule checklist conformance, and trading performance.
          </DialogDescription>

          {/* Decorative Top Accent */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#e50914] to-transparent" />

          {/* Header - DialogContent provides top-4 right-4 close button, pr-14 ensures clean spacing */}
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] py-3.5 pl-6 pr-14">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="font-mono flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#e50914]/40 bg-[#e50914]/10 text-[14px] font-bold text-[#e50914]">
                {model.code}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-[18px] sm:text-[20px] font-bold leading-tight text-white">
                    {model.name}
                  </h2>
                  {!model.active && (
                    <span className="shrink-0 rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-[#a2a2a0]">
                      Inactive
                    </span>
                  )}
                  {model.tier && (
                    <span className="shrink-0 font-mono rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                      Tier {model.tier}
                    </span>
                  )}
                </div>
                <p className="font-mono mt-0.5 text-[11px] text-[#a2a2a0]">
                  {model.market} · {model.timeframe}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {onToggleActive && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onToggleActive(model)}
                  className="h-8 border-white/[0.1] bg-white/[0.03] text-xs text-white transition hover:bg-white/[0.08]"
                >
                  <RotateCcw className="mr-1.5 size-3 text-[#a2a2a0]" />
                  {model.active ? "Deactivate" : "Activate"}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(model);
                }}
                className="h-8 border-white/[0.1] bg-white/[0.03] text-xs text-white transition hover:bg-white/[0.08]"
              >
                <Pencil className="mr-1.5 size-3 text-[#a2a2a0]" /> Edit
              </Button>
              {onDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    onOpenChange(false);
                    onDelete(model);
                  }}
                  className="h-8 text-xs text-[#ff6b7d] hover:bg-[#ff6b7d]/10 hover:text-[#ff6b7d]"
                  title="Delete playbook"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* TradeZella-style Tab Strip */}
          <div className="flex items-center border-b border-white/[0.07] bg-[#0f0f0f] px-6">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`relative flex h-11 items-center gap-2 px-4 text-[12px] font-semibold tracking-wider uppercase transition-colors ${
                activeTab === "overview"
                  ? "text-white after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-[#e50914]"
                  : "text-[#a2a2a0] hover:text-white"
              }`}
            >
              <LayoutGrid className="size-3.5" />
              <span>Overview</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("trades")}
              className={`relative flex h-11 items-center gap-2 px-4 text-[12px] font-semibold tracking-wider uppercase transition-colors ${
                activeTab === "trades"
                  ? "text-white after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-[#e50914]"
                  : "text-[#a2a2a0] hover:text-white"
              }`}
            >
              <Image className="size-3.5" />
              <span>Trades</span>
              <span className="font-mono rounded bg-white/[0.08] px-1.5 py-0.2 text-[10px] text-[#d6d6d4]">
                {sample.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("rules")}
              className={`relative flex h-11 items-center gap-2 px-4 text-[12px] font-semibold tracking-wider uppercase transition-colors ${
                activeTab === "rules"
                  ? "text-white after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-[#e50914]"
                  : "text-[#a2a2a0] hover:text-white"
              }`}
            >
              <ListChecks className="size-3.5" />
              <span>Rules</span>
              <span className="font-mono rounded bg-white/[0.08] px-1.5 py-0.2 text-[10px] text-[#d6d6d4]">
                {validRulesList.length + invalidRulesList.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("notes")}
              className={`relative flex h-11 items-center gap-2 px-4 text-[12px] font-semibold tracking-wider uppercase transition-colors ${
                activeTab === "notes"
                  ? "text-white after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-[#e50914]"
                  : "text-[#a2a2a0] hover:text-white"
              }`}
            >
              <FileText className="size-3.5" />
              <span>Notes</span>
              {notesText.trim() && (
                <span className="size-1.5 rounded-full bg-[#3ddc84]" />
              )}
            </button>
          </div>

          {/* Tab Body */}
          <div className="max-h-[calc(92vh-130px)] min-h-[380px] overflow-y-auto px-6 py-5">
            {/* TAB 1: OVERVIEW */}
            {activeTab === "overview" && (
              <div className="space-y-5">
                {/* Enhanced Stats Banner */}
                <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-white/[0.08] bg-[#121212] p-4 sm:grid-cols-4">
                  <div className="rounded-lg bg-white/[0.02] p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#a2a2a0]">
                      <Activity className="size-3 text-[#a2a2a0]" />
                      <span>Closed trades</span>
                    </div>
                    <p className="font-mono mt-1 text-[20px] font-bold text-white">{sample.length}</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.02] p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#a2a2a0]">
                      <Target className="size-3 text-[#a2a2a0]" />
                      <span>Win rate</span>
                    </div>
                    <p className="font-mono mt-1 text-[20px] font-bold text-white">{wr}%</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.02] p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#a2a2a0]">
                      {netPnL >= 0 ? (
                        <TrendingUp className="size-3 text-[#3ddc84]" />
                      ) : (
                        <TrendingDown className="size-3 text-[#ff6b7d]" />
                      )}
                      <span>Net P&amp;L</span>
                    </div>
                    <p
                      className={`font-mono mt-1 text-[20px] font-bold ${
                        netPnL >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]"
                      }`}
                    >
                      {fmtCurrency(netPnL)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/[0.02] p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#a2a2a0]">
                      <Award className="size-3 text-[#a2a2a0]" />
                      <span>Avg R</span>
                    </div>
                    <p
                      className={`font-mono mt-1 text-[20px] font-bold ${
                        avgR >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]"
                      }`}
                    >
                      {formatR(avgR)}
                    </p>
                  </div>
                </div>

                {/* Category Grouping: 📐 Setup Context */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-l-2 border-[#e50914] pl-2.5 text-[12px] font-semibold uppercase tracking-wider text-white">
                    <span>📐 Setup Context</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/[0.07] bg-[#141414] p-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a2a2a0]">
                        HTF narrative &amp; Context
                      </p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-white">
                        {model.htfNarrative?.trim() || "Bearish weekly/daily. Price in premium of the dealing range."}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-[#141414] p-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a2a2a0]">
                        Liquidity condition
                      </p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-white">
                        {model.liquidityCondition?.trim() || "SSL / PDL / Asia low taken first."}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/[0.07] bg-[#141414] p-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a2a2a0]">
                      PD Array Reference
                    </p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-white">
                      {model.pdArray?.trim() || "1H or 15m bearish FVG / OB in premium."}
                    </p>
                  </div>
                </div>

                {/* Category Grouping: 🎯 Execution Rules */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-l-2 border-[#e50914] pl-2.5 text-[12px] font-semibold uppercase tracking-wider text-white">
                    <span>🎯 Execution Rules</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/[0.07] bg-[#141414] p-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a2a2a0]">
                        Trigger
                      </p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-white">
                        {model.trigger?.trim() || "MSS + displacement + 5m FVG."}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-[#141414] p-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a2a2a0]">
                        Invalidation level
                      </p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-white">
                        {model.invalidation?.trim() || "Displacement back through swept high; FVG fully mitigated."}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-[#141414] p-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a2a2a0]">
                        Target pool
                      </p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-white">
                        {model.target?.trim() || "BSL / PDH / Opposing external liquidity pool"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-[#141414] p-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a2a2a0]">
                        Required timing / Session
                      </p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-white">
                        {model.requiredTiming?.trim() || "NY AM Kill Zone (09:30–11:00 NY) / Primary Session"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Canvas Blueprint / Snapshot Preview */}
                {blueprintSnapshot && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 border-l-2 border-[#e50914] pl-2.5 text-[12px] font-semibold uppercase tracking-wider text-white">
                      <span>Blueprint Schematic</span>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#070707] p-2">
                      <img
                        src={blueprintSnapshot}
                        alt="Playbook Blueprint Schematic"
                        className="w-full rounded-lg object-contain max-h-[300px]"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: TRADES (CHART-FIRST GALLERY) */}
            {activeTab === "trades" && (
              <div className="space-y-4">
                {/* Header Filter Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTradeFilter("all")}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                        tradeFilter === "all"
                          ? "bg-white/[0.12] text-white"
                          : "text-[#a2a2a0] hover:text-white"
                      }`}
                    >
                      All <span className="font-mono text-[10px] ml-1">{sample.length}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTradeFilter("win")}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                        tradeFilter === "win"
                          ? "bg-[#3ddc84]/20 text-[#3ddc84]"
                          : "text-[#a2a2a0] hover:text-white"
                      }`}
                    >
                      Wins <span className="font-mono text-[10px] ml-1">{wins.length}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTradeFilter("loss")}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                        tradeFilter === "loss"
                          ? "bg-[#ff6b7d]/20 text-[#ff6b7d]"
                          : "text-[#a2a2a0] hover:text-white"
                      }`}
                    >
                      Losses <span className="font-mono text-[10px] ml-1">{losses.length}</span>
                    </button>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => setCreatingTrade(true)}
                    className="h-8 gap-1.5 bg-[#e50914] px-3 text-xs font-semibold text-white shadow-sm hover:brightness-110"
                  >
                    <Plus className="size-3.5" />
                    <span>Log Trade with Setup</span>
                  </Button>
                </div>

                {/* Gallery Grid */}
                {filteredGalleryTrades.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="flex size-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.02] text-[#6f6f6d]">
                      <Image className="size-7" />
                    </div>
                    <h4 className="mt-4 text-[15px] font-semibold text-white">No trades found</h4>
                    <p className="mt-1 max-w-sm text-[12px] text-[#a2a2a0]">
                      {tradeFilter === "all"
                        ? "No executions logged with this playbook setup yet."
                        : `No ${tradeFilter.toUpperCase()} trades found under this playbook.`}
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setCreatingTrade(true)}
                      className="mt-4 gap-1.5 bg-[#e50914] text-xs font-semibold text-white hover:brightness-110"
                    >
                      <Plus className="size-3.5" /> Log First Trade
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredGalleryTrades.map((t) => {
                      const inst = instrumentOf(data, t.market);
                      const pnl = tradeDollarPnl(t, inst);
                      const net = pnl.net ?? 0;
                      const hasChart = !!(t.screenshotExec || t.screenshotHtf);
                      const chartSrc = t.screenshotExec || t.screenshotHtf;

                      return (
                        <div
                          key={t.id}
                          onClick={() => setInspectingTrade(t)}
                          className="group relative flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#121212] transition-all duration-200 hover:border-[#e50914]/50 hover:shadow-[0_8px_25px_-8px_rgba(229,9,20,0.3)] cursor-pointer"
                        >
                          {/* Chart Snapshot / Execution Preview */}
                          <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#070707]">
                            {hasChart ? (
                              <img
                                src={chartSrc}
                                alt="Execution chart snapshot"
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              /* Stylized ICT Candle Chart Mockup */
                              <div className="flex h-full w-full flex-col justify-between p-3 bg-gradient-to-br from-[#0c0c0c] to-[#151515]">
                                <div className="flex items-center justify-between text-[10px] text-[#a2a2a0]">
                                  <span className="font-mono font-bold text-white">{t.market}</span>
                                  <span>{t.pdTimeframe || t.fvgTimeframe || "5m"}</span>
                                </div>
                                <div className="flex items-center justify-center gap-1.5 opacity-60">
                                  <div className="h-8 w-2 rounded-xs bg-[#3ddc84]" />
                                  <div className="h-12 w-2 rounded-xs bg-[#3ddc84]" />
                                  <div className="h-6 w-2 rounded-xs bg-[#ff6b7d]" />
                                  <div className="h-10 w-2 rounded-xs bg-[#3ddc84]" />
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-[#6f6f6d]">
                                  <span>Entry: {t.entry ?? "Market"}</span>
                                  <span>SL: {t.sl ?? "Structural"}</span>
                                </div>
                              </div>
                            )}

                            {/* Top Left: Outcome Badge */}
                            <div className="absolute top-2.5 left-2.5">
                              <span
                                className={`font-mono inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold shadow-md backdrop-blur-md ${
                                  t.result === "win"
                                    ? "bg-[#3ddc84]/20 border border-[#3ddc84]/40 text-[#3ddc84]"
                                    : t.result === "loss"
                                    ? "bg-[#ff6b7d]/20 border border-[#ff6b7d]/40 text-[#ff6b7d]"
                                    : "bg-white/[0.1] border border-white/[0.2] text-white"
                                }`}
                              >
                                {t.result === "win" ? (
                                  <ArrowUpRight className="size-3" />
                                ) : (
                                  <ArrowDownRight className="size-3" />
                                )}
                                {fmtCurrency(net)}
                              </span>
                            </div>

                            {/* Top Right: Confluence Tier / Grade Badge */}
                            <div className="absolute top-2.5 right-2.5">
                              {t.grade ? (
                                <span className="font-mono inline-flex items-center rounded-md border border-amber-500/40 bg-black/60 px-2 py-0.5 text-[11px] font-bold text-amber-400 backdrop-blur-md">
                                  Tier {t.grade}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {/* Card Footer Details */}
                          <div className="p-3">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[12px] font-bold text-white">
                                {t.market} · {t.side.toUpperCase()}
                              </span>
                              <span
                                className={`font-mono text-[12px] font-semibold ${
                                  (t.rMultiple ?? 0) >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]"
                                }`}
                              >
                                {formatR(t.rMultiple ?? 0)}
                              </span>
                            </div>

                            <div className="mt-2 flex items-center justify-between text-[11px] text-[#a2a2a0]">
                              <span className="flex items-center gap-1">
                                <Calendar className="size-3 text-[#6f6f6d]" />
                                {t.date}
                              </span>
                              <span className="font-mono text-[10px]">
                                {t.ruleFollowed ? (
                                  <span className="text-[#3ddc84]">✓ Rules Met</span>
                                ) : (
                                  <span className="text-[#f5b942]">⚠ Partial Rules</span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: RULES CHECKLIST */}
            {activeTab === "rules" && (
              <div className="space-y-6">
                {/* Conformance Summary Bar */}
                <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-[#121212] p-4">
                  <div>
                    <span className="text-[10px] font-semibold tracking-wider text-[#a2a2a0] uppercase">
                      Historical Rules Conformance
                    </span>
                    <p className="font-mono mt-1 text-2xl font-bold text-white">
                      {rulesFollowedPct}%
                    </p>
                    <p className="font-mono text-[11px] text-[#a2a2a0]">
                      {totalFollowed} of {totalAssessed} rule assessments honored across logged trades
                    </p>
                  </div>
                  <div className="flex size-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.02]">
                    <span
                      className={`font-mono text-xl font-bold ${
                        rulesFollowedPct >= 80 ? "text-[#3ddc84]" : "text-[#f5b942]"
                      }`}
                    >
                      {rulesFollowedPct >= 80 ? "A+" : "B"}
                    </span>
                  </div>
                </div>

                {/* Valid When Rules */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold tracking-wider text-[#3ddc84] uppercase">
                      ✓ Mandatory Entry Criteria (Valid When)
                    </span>
                    <span className="text-[11px] text-[#a2a2a0]">Interactive Checklist Preview</span>
                  </div>
                  <div className="space-y-1.5">
                    {validRulesList.map((r, i) => {
                      const checked = checkedValidRules[i] !== false;
                      return (
                        <div
                          key={i}
                          onClick={() => toggleValidRule(i)}
                          className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 text-[13px] transition-all ${
                            checked
                              ? "border-[#3ddc84]/30 bg-[#3ddc84]/5 text-white"
                              : "border-white/[0.06] bg-[#141414] text-[#a2a2a0] hover:border-white/[0.12]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex size-5 shrink-0 items-center justify-center rounded border transition-colors ${
                                checked
                                  ? "border-[#3ddc84] bg-[#3ddc84] text-black"
                                  : "border-white/[0.2] bg-white/[0.03]"
                              }`}
                            >
                              {checked && <Check className="size-3.5 stroke-[3]" />}
                            </div>
                            <span className={checked ? "font-medium text-white" : ""}>{r}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Invalid When Disqualifiers */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold tracking-wider text-[#ff6b7d] uppercase">
                      ✕ Setup Disqualifiers (Invalid When)
                    </span>
                    <span className="text-[11px] text-[#a2a2a0]">Avoid execution if present</span>
                  </div>
                  <div className="space-y-1.5">
                    {invalidRulesList.map((r, i) => {
                      const checked = !!checkedInvalidRules[i];
                      return (
                        <div
                          key={i}
                          onClick={() => toggleInvalidRule(i)}
                          className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 text-[13px] transition-all ${
                            checked
                              ? "border-[#ff6b7d]/40 bg-[#ff6b7d]/10 text-white"
                              : "border-white/[0.06] bg-[#141414] text-[#a2a2a0] hover:border-white/[0.12]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex size-5 shrink-0 items-center justify-center rounded border transition-colors ${
                                checked
                                  ? "border-[#ff6b7d] bg-[#ff6b7d] text-white"
                                  : "border-white/[0.2] bg-white/[0.03]"
                              }`}
                            >
                              {checked && <X className="size-3.5 stroke-[3]" />}
                            </div>
                            <span className={checked ? "font-medium text-[#ff6b7d]" : ""}>{r}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: NOTES */}
            {activeTab === "notes" && (
              <div className="space-y-4">
                {notesText.trim() ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-[#a2a2a0]">
                      <span className="font-semibold uppercase tracking-wider">Strategy Notes &amp; Observations</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          onOpenChange(false);
                          onEdit(model);
                        }}
                        className="h-6 px-2 text-[11px] text-white hover:bg-white/[0.08]"
                      >
                        <Pencil className="mr-1 size-3 text-[#a2a2a0]" /> Edit notes
                      </Button>
                    </div>
                    <textarea
                      readOnly
                      value={notesText}
                      rows={10}
                      className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#141414] p-4 font-mono text-[13px] leading-relaxed text-[#d6d6d4] outline-none select-text"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="flex size-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.02] text-[#6f6f6d]">
                      <FileText className="size-7" />
                    </div>
                    <h4 className="mt-4 text-[15px] font-semibold text-white">No notes yet</h4>
                    <p className="mt-1 max-w-sm text-[12px] text-[#a2a2a0]">
                      Edit this playbook to add setup notes, tape reading checklists, or post-session observations.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onOpenChange(false);
                        onEdit(model);
                      }}
                      className="mt-5 border-white/[0.1] bg-white/[0.03] text-xs text-white hover:bg-white/[0.08]"
                    >
                      <Pencil className="mr-1.5 size-3.5 text-[#a2a2a0]" /> Edit playbook
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Trade Inspector Dialog for clicked gallery trades */}
      <TradeInspectorDialog
        trade={inspectingTrade}
        open={!!inspectingTrade}
        onOpenChange={(op) => !op && setInspectingTrade(null)}
        models={models}
        onEditTrade={(t) => {
          setInspectingTrade(null);
          setEditingTrade(t);
        }}
        onDeleteTrade={async (id) => {
          const prevTrades = useDeskStore.getState().trades;
          removeTrade(id);
          try {
            const snapshot = deskSnapshot();
            await syncDeskToServer(snapshot);
            setInspectingTrade(null);
          } catch (err) {
            console.error("[playbook-detail] failed to delete trade:", err);
            useDeskStore.setState({ trades: prevTrades });
            toast.error("Failed to delete trade from cloud.");
          }
        }}
        onUpdateTrade={async (t) => {
          const prevTrades = useDeskStore.getState().trades;
          upsertTrade(t);
          try {
            const snapshot = deskSnapshot();
            await syncDeskToServer(snapshot);
            setInspectingTrade(t);
          } catch (err) {
            console.error("[playbook-detail] failed to update trade:", err);
            useDeskStore.setState({ trades: prevTrades });
            toast.error("Failed to update trade on cloud.");
          }
        }}
      />

      {/* Trade Edit Modal */}
      <TradeFormModal
        trade={editingTrade}
        open={!!editingTrade}
        onOpenChange={(op) => !op && setEditingTrade(null)}
        onSaved={(updated) => {
          setEditingTrade(null);
          setInspectingTrade(updated);
        }}
      />

      {/* Quick Trade Creation Modal pre-tagged with this Playbook */}
      <TradeFormModal
        trade={null}
        open={creatingTrade}
        onOpenChange={setCreatingTrade}
        onSaved={(newTrade) => {
          setCreatingTrade(false);
          setInspectingTrade(newTrade);
        }}
      />
    </>
  );
}
