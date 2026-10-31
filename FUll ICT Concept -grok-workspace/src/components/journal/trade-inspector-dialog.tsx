import { useState, useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  TrendingUp,
  Percent,
  Compass,
  Tag,
  Smile,
  Pencil,
  Trash2,
  ExternalLink,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { DeskData, SetupModel, Trade } from "@/lib/ict-types";
import { TradeCanvasChart } from "./trade-canvas-chart";
import {
  formatCurrency,
  getPlaybookRules,
  getTradeEfficiency,
  getTradeHoldDuration,
  getTradePnL,
  calculateTradeRuleAdherence,
} from "@/lib/tradezella-helpers";
import { formatR } from "@/lib/utils";
import { toast } from "sonner";

interface TradeInspectorDialogProps {
  trade: Trade | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  models: DeskData["models"];
  onEditTrade: (trade: Trade) => void;
  onDeleteTrade: (id: string) => void;
  onUpdateTrade: (trade: Trade) => void;
}

export function TradeInspectorDialog({
  trade,
  open,
  onOpenChange,
  models,
  onEditTrade,
  onDeleteTrade,
  onUpdateTrade,
}: TradeInspectorDialogProps) {
  if (!trade) return null;

  const model = models.find((m) => m.id === trade.modelId || m.name === trade.modelName);
  const rules = useMemo(() => (model ? getPlaybookRules(model) : []), [model]);

  const pnl = getTradePnL(trade);
  const duration = getTradeHoldDuration(trade);
  const efficiency = getTradeEfficiency(trade);
  const adherence = calculateTradeRuleAdherence(trade, model);

  // Toggle rule followed state in playbook checklist
  const toggleRule = (ruleId: string) => {
    const current = trade.ruleChecklist ?? {};
    const updated = { ...current, [ruleId]: !current[ruleId] };
    const followedCount = rules.filter((r) => updated[r.id] === true).length;
    const adherencePct = rules.length > 0 ? Math.round((followedCount / rules.length) * 100) : 100;

    const nextTrade: Trade = {
      ...trade,
      ruleChecklist: updated,
      ruleAdherencePct: adherencePct,
      ruleFollowed: adherencePct >= 80,
    };
    onUpdateTrade(nextTrade);
    toast.success("Rule checklist updated");
  };

  const isWin = trade.result === "win";
  const isLoss = trade.result === "loss";
  const isLong = trade.side === "long";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0a0a0a] border-white/10 p-0 text-foreground">
        {/* Top Header Summary Strip - DialogContent provides top-4 right-4 close button, pr-14 prevents collision */}
        <div className="border-b border-white/[0.08] p-5 pb-4 pr-14">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
                  isLong ? "bg-up/20 text-up border border-up/30" : "bg-down/20 text-down border border-down/30"
                }`}
              >
                {trade.side} {trade.market}
              </span>
              <span
                className={`rounded px-2.5 py-1 text-xs font-semibold uppercase ${
                  isWin
                    ? "bg-up/15 text-up border border-up/30"
                    : isLoss
                    ? "bg-down/15 text-down border border-down/30"
                    : "bg-white/10 text-muted-foreground"
                }`}
              >
                {trade.result} {trade.rMultiple != null && `(${formatR(trade.rMultiple)})`}
              </span>
              {trade.modelName && (
                <Badge variant="default" className="border-white/15 bg-white/[0.04] text-xs">
                  <Compass className="mr-1 size-3 text-accent" />
                  {trade.modelName}
                </Badge>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-white/15 text-xs hover:bg-white/10"
                onClick={() => {
                  onOpenChange(false);
                  onEditTrade(trade);
                }}
              >
                <Pencil className="mr-1 size-3.5" /> Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-destructive hover:bg-destructive/15"
                onClick={() => {
                  if (confirm("Delete this trade record?")) {
                    onDeleteTrade(trade.id);
                    onOpenChange(false);
                    toast.success("Trade removed");
                  }
                }}
              >
                <Trash2 className="mr-1 size-3.5" /> Delete
              </Button>
            </div>
          </div>

          {/* Key Financial KPIs */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Net P&L
              </span>
              <p
                className={`mt-0.5 font-mono text-base font-bold ${
                  pnl > 0 ? "text-up" : pnl < 0 ? "text-down" : "text-muted-foreground"
                }`}
              >
                {formatCurrency(pnl)}
              </p>
            </div>

            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Realized R
              </span>
              <p
                className={`mt-0.5 font-mono text-base font-bold ${
                  trade.rMultiple && trade.rMultiple > 0
                    ? "text-up"
                    : trade.rMultiple && trade.rMultiple < 0
                    ? "text-down"
                    : "text-muted-foreground"
                }`}
              >
                {trade.rMultiple != null ? formatR(trade.rMultiple) : "—"}
              </p>
            </div>

            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Hold Duration
              </span>
              <p className="mt-0.5 flex items-center gap-1 font-mono text-base font-semibold text-foreground">
                <Clock className="size-3.5 text-muted-foreground" /> {duration}
              </p>
            </div>

            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Rule Adherence
              </span>
              <p
                className={`mt-0.5 font-mono text-base font-bold ${
                  adherence.adherencePct >= 80
                    ? "text-up"
                    : adherence.adherencePct >= 60
                    ? "text-warn"
                    : "text-down"
                }`}
              >
                {adherence.adherencePct}%
              </p>
            </div>

            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Efficiency
              </span>
              <p className="mt-0.5 font-mono text-base font-bold text-cyan-400">
                {efficiency}%
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="space-y-5 p-5">
          {/* Section 1: Interactive Candlestick Execution Canvas */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Execution Chart & Price Trajectory
              </h4>
              <span className="text-[11px] text-muted-foreground">
                Hover over candles for OHLCV & Crosshair
              </span>
            </div>
            <TradeCanvasChart trade={trade} height={340} />
          </div>

          {/* Section 2: Excursions & Execution Quality */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-md border border-white/[0.08] bg-white/[0.02] p-4">
              <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-3">
                Excursions (TradeZella MAE / MFE)
              </h4>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-cyan-400 font-medium">MFE (Peak Potential)</span>
                    <span className="font-mono text-foreground font-semibold">
                      {trade.mfeR != null ? `+${trade.mfeR.toFixed(2)}R` : "—"}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 rounded-full"
                      style={{ width: `${Math.min(100, ((trade.mfeR ?? 0) / 4) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Highest unrealized profit reached before exit.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-amber-400 font-medium">MAE (Heat Endured)</span>
                    <span className="font-mono text-foreground font-semibold">
                      {trade.maeR != null ? `${trade.maeR.toFixed(2)}R` : "—"}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: `${Math.min(100, Math.abs(trade.maeR ?? 0) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Maximum drawdown dip during trade lifecycle.
                  </p>
                </div>
              </div>
            </div>

            {/* Execution Pricing Details */}
            <div className="rounded-md border border-white/[0.08] bg-white/[0.02] p-4">
              <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-3">
                Execution Prices & Metrics
              </h4>
              <div className="grid grid-cols-2 gap-y-2.5 text-xs">
                <div>
                  <span className="text-muted-foreground">Entry Price:</span>
                  <p className="font-mono font-semibold text-foreground">
                    {trade.entry != null ? trade.entry.toFixed(2) : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Exit Price:</span>
                  <p className="font-mono font-semibold text-foreground">
                    {trade.exitPrice != null ? trade.exitPrice.toFixed(2) : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Stop Loss:</span>
                  <p className="font-mono font-semibold text-down">
                    {trade.sl != null ? trade.sl.toFixed(2) : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Take Profit:</span>
                  <p className="font-mono font-semibold text-up">
                    {trade.tp1 != null ? trade.tp1.toFixed(2) : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Execution Quality:</span>
                  <p className="font-semibold capitalize text-foreground">
                    {trade.executionQuality || "Optimal"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Emotional State:</span>
                  <p className="font-semibold capitalize text-accent">
                    {trade.emotion || "Calm"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Playbook Rule Adherence Checklist */}
          <div className="rounded-md border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Playbook Rule Adherence Checklist
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  TradeZella tracks whether you respected your pre-defined strategy rules.
                </p>
              </div>
              <Badge
                variant="default"
                className={`font-mono text-xs ${
                  adherence.adherencePct >= 80
                    ? "border-up/40 bg-up/10 text-up"
                    : "border-warn/40 bg-warn/10 text-warn"
                }`}
              >
                {adherence.followed} of {adherence.total} rules followed ({adherence.adherencePct}%)
              </Badge>
            </div>

            {rules.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                No playbook setup linked to this trade. Assign a playbook to track rule adherence.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {rules.map((rule) => {
                  const isChecked = trade.ruleChecklist?.[rule.id] ?? trade.ruleFollowed;
                  return (
                    <button
                      key={rule.id}
                      type="button"
                      onClick={() => toggleRule(rule.id)}
                      className={`flex items-start gap-2.5 rounded-md border p-2.5 text-left text-xs transition-colors ${
                        isChecked
                          ? "border-up/30 bg-up/[0.04] text-foreground hover:bg-up/[0.08]"
                          : "border-white/10 bg-white/[0.01] text-muted-foreground hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className="mt-0.5">
                        {isChecked ? (
                          <CheckCircle2 className="size-4 text-up shrink-0" />
                        ) : (
                          <XCircle className="size-4 text-muted-foreground/60 shrink-0" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <span className="block leading-snug">{rule.text}</span>
                        <span className="text-[10px] font-mono uppercase text-muted-foreground">
                          {rule.category.replace("_", " ")} · {rule.isMandatory ? "Mandatory" : "Confluence"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 4: Tags & Mistakes */}
          <div className="rounded-md border border-white/[0.08] bg-white/[0.02] p-4">
            <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2">
              Tags & Mistake Attribution
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {trade.taken?.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent border border-accent/20"
                >
                  #{tag}
                </span>
              ))}
              {trade.pdArray && (
                <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-foreground">
                  {trade.pdArray}
                </span>
              )}
              {trade.session && (
                <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-muted-foreground">
                  {trade.session} Session
                </span>
              )}
              {trade.errors?.filter((e) => e !== "No actual error").map((err) => (
                <span
                  key={err}
                  className="rounded bg-destructive/20 px-2 py-0.5 text-xs text-destructive border border-destructive/30"
                >
                  Mistake: {err}
                </span>
              ))}
              {(!trade.errors || trade.errors.every((e) => e === "No actual error")) && (
                <span className="rounded bg-up/10 px-2 py-0.5 text-xs text-up border border-up/20">
                  Clean Execution (No mistakes)
                </span>
              )}
            </div>
          </div>

          {/* Section 5: Journal Notes */}
          {trade.notes && (
            <div className="rounded-md border border-white/[0.08] bg-white/[0.02] p-4">
              <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-1.5">
                Journal Notes & Thesis
              </h4>
              <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap font-sans">
                {trade.notes}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
