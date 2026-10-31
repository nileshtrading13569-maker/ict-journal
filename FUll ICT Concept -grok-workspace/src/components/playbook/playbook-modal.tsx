import { useState, useMemo } from "react";
import {
  Compass,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Sparkles,
  BarChart2,
  ListChecks,
  PenTool,
  Clock,
  TrendingUp,
  Percent,
  Layers,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { PlaybookStructuredRule, SetupModel, Trade } from "@/lib/ict-types";
import { PlaybookCanvas } from "./playbook-canvas";
import {
  formatCurrency,
  getPlaybookRules,
  getTradePnL,
  calculateTradeRuleAdherence,
} from "@/lib/tradezella-helpers";
import { formatR } from "@/lib/utils";
import { toast } from "sonner";

interface PlaybookModalProps {
  model: SetupModel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trades: Trade[];
  onSaveModel: (updated: SetupModel) => void;
  onInspectTrade?: (trade: Trade) => void;
}

export function PlaybookModal({
  model,
  open,
  onOpenChange,
  trades,
  onSaveModel,
  onInspectTrade,
}: PlaybookModalProps) {
  if (!model) return null;

  const [activeTab, setActiveTab] = useState<"blueprint" | "checklist" | "analytics" | "trades">("blueprint");
  const [newRuleText, setNewRuleText] = useState("");
  const [newRuleCategory, setNewRuleCategory] = useState<PlaybookStructuredRule["category"]>("trigger");
  const [newRuleMandatory, setNewRuleMandatory] = useState(true);

  // Model's structured rules
  const rules = useMemo(() => getPlaybookRules(model), [model]);

  // Trades linked to this model
  const linkedTrades = useMemo(
    () => trades.filter((t) => t.modelId === model.id || t.modelName === model.name),
    [trades, model],
  );

  // Calculate Strategy Performance Metrics
  const total = linkedTrades.length;
  const wins = linkedTrades.filter((t) => t.result === "win").length;
  const losses = linkedTrades.filter((t) => t.result === "loss").length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const netPnL = linkedTrades.reduce((sum, t) => sum + getTradePnL(t), 0);
  const netR = linkedTrades.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0);
  const avgR = total > 0 ? (netR / total).toFixed(2) : "0.00";

  // TradeZella Rule Adherence Correlation
  const disciplinedTrades = linkedTrades.filter(
    (t) => calculateTradeRuleAdherence(t, model).adherencePct >= 80,
  );
  const violatedTrades = linkedTrades.filter(
    (t) => calculateTradeRuleAdherence(t, model).adherencePct < 80,
  );

  const disciplinedWins = disciplinedTrades.filter((t) => t.result === "win").length;
  const disciplinedWinRate =
    disciplinedTrades.length > 0 ? Math.round((disciplinedWins / disciplinedTrades.length) * 100) : 0;
  const disciplinedAvgR =
    disciplinedTrades.length > 0
      ? (disciplinedTrades.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0) / disciplinedTrades.length).toFixed(2)
      : "0.00";

  const violatedWins = violatedTrades.filter((t) => t.result === "win").length;
  const violatedWinRate =
    violatedTrades.length > 0 ? Math.round((violatedWins / violatedTrades.length) * 100) : 0;
  const violatedAvgR =
    violatedTrades.length > 0
      ? (violatedTrades.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0) / violatedTrades.length).toFixed(2)
      : "0.00";

  // Save canvas blueprint snapshot
  const handleSaveCanvasSnapshot = (dataUrl: string) => {
    const updated: SetupModel = {
      ...model,
      canvasBlueprint: dataUrl,
    };
    onSaveModel(updated);
  };

  // Add rule to model
  const handleAddRule = () => {
    if (!newRuleText.trim()) return;
    const rule: PlaybookStructuredRule = {
      id: `${model.id}-custom-${Date.now()}`,
      category: newRuleCategory,
      text: newRuleText.trim(),
      isMandatory: newRuleMandatory,
    };
    const nextRules = [...rules, rule];
    const updated: SetupModel = {
      ...model,
      rulesList: nextRules,
    };
    onSaveModel(updated);
    setNewRuleText("");
    toast.success("Rule added to playbook checklist");
  };

  // Delete rule
  const handleDeleteRule = (ruleId: string) => {
    const nextRules = rules.filter((r) => r.id !== ruleId);
    const updated: SetupModel = {
      ...model,
      rulesList: nextRules,
    };
    onSaveModel(updated);
    toast.success("Rule removed from checklist");
  };

  // Toggle rule mandatory state
  const handleToggleMandatory = (ruleId: string) => {
    const nextRules = rules.map((r) =>
      r.id === ruleId ? { ...r, isMandatory: !r.isMandatory } : r,
    );
    const updated: SetupModel = {
      ...model,
      rulesList: nextRules,
    };
    onSaveModel(updated);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0a0a0a] border-white/10 p-0 text-foreground">
        {/* Header Summary */}
        <div className="border-b border-white/[0.08] p-5 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="rounded bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent border border-accent/30 font-mono">
                {model.code}
              </span>
              <DialogTitle className="font-display text-xl tracking-tight text-foreground">
                {model.name}
              </DialogTitle>
              <Badge variant="default" className="text-xs border-white/15 bg-white/5 font-mono">
                {model.market} · {model.timeframe}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {model.active ? "● Active Strategy" : "○ Archived"}
              </span>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase">Win Rate</span>
              <p className="mt-0.5 font-mono text-base font-bold text-foreground">
                {winRate}% <span className="text-xs font-normal text-muted-foreground">({wins}W / {losses}L)</span>
              </p>
            </div>
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase">Net P&L</span>
              <p
                className={`mt-0.5 font-mono text-base font-bold ${
                  netPnL > 0 ? "text-up" : netPnL < 0 ? "text-down" : "text-muted-foreground"
                }`}
              >
                {formatCurrency(netPnL)}
              </p>
            </div>
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase">Realized Net R</span>
              <p
                className={`mt-0.5 font-mono text-base font-bold ${
                  netR > 0 ? "text-up" : netR < 0 ? "text-down" : "text-muted-foreground"
                }`}
              >
                {formatR(netR)}
              </p>
            </div>
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase">Avg R / Trade</span>
              <p className="mt-0.5 font-mono text-base font-bold text-foreground">
                {avgR}R
              </p>
            </div>
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase">Tracked Trades</span>
              <p className="mt-0.5 font-mono text-base font-bold text-foreground">
                {total}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="p-5">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="mb-4 bg-white/[0.04] border border-white/10">
              <TabsTrigger value="blueprint" className="text-xs">
                <PenTool className="mr-1.5 size-3.5" />
                Canvas Blueprint Studio
              </TabsTrigger>
              <TabsTrigger value="checklist" className="text-xs">
                <ListChecks className="mr-1.5 size-3.5" />
                5-Phase Checklist ({rules.length})
              </TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs">
                <BarChart2 className="mr-1.5 size-3.5" />
                Adherence Correlation
              </TabsTrigger>
              <TabsTrigger value="trades" className="text-xs">
                <Layers className="mr-1.5 size-3.5" />
                Linked Trades ({total})
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Interactive Playbook Canvas */}
            <TabsContent value="blueprint" className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Draw and annotate your ideal textbook setup blueprint on the canvas.
                </span>
                <span className="font-mono text-[11px]">
                  Supports Candles, FVG Boxes, Liquidity Lines, and Arrows
                </span>
              </div>
              <PlaybookCanvas
                initialSnapshot={model.canvasBlueprint}
                onSaveSnapshot={handleSaveCanvasSnapshot}
                presetModel={
                  model.id === "model-a" || model.id === "model-b"
                    ? model.id
                    : model.id === "model-c"
                    ? "model-c"
                    : "model-a"
                }
                height={380}
              />
            </TabsContent>

            {/* Tab 2: 5-Phase Checklist Builder */}
            <TabsContent value="checklist" className="space-y-4">
              <div className="rounded-md border border-white/[0.08] bg-white/[0.02] p-3 text-xs text-muted-foreground">
                TradeZella turns discipline into a metric. Define your entry confluences, risk rules, and invalidation criteria. Every journaled trade will be scored against these rules.
              </div>

              {/* Categorized Rules List */}
              <div className="space-y-2">
                {rules.map((rule, idx) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-white/[0.08] bg-white/[0.02] p-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-[11px] text-muted-foreground">#{idx + 1}</span>
                      <div>
                        <p className="font-medium text-foreground">{rule.text}</p>
                        <span className="text-[10px] font-mono uppercase text-muted-foreground">
                          Phase: {rule.category.replace("_", " ")}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={rule.isMandatory ? "default" : "outline"}
                        className={`h-6 text-[10px] px-2 ${
                          rule.isMandatory ? "bg-accent text-white" : "border-white/15 text-muted-foreground"
                        }`}
                        onClick={() => handleToggleMandatory(rule.id)}
                      >
                        {rule.isMandatory ? "Mandatory (Hard Rule)" : "Optional Confluence"}
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteRule(rule.id)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add New Rule Row */}
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.02] p-3">
                <Input
                  value={newRuleText}
                  onChange={(e) => setNewRuleText(e.target.value)}
                  placeholder="Enter rule text (e.g. Asia High swept between 09:30-10:00 EST)..."
                  className="h-8 flex-1 text-xs bg-black/40 border-white/10"
                />
                <select
                  value={newRuleCategory}
                  onChange={(e) => setNewRuleCategory(e.target.value as any)}
                  className="h-8 rounded-md border border-white/10 bg-black/40 px-2 text-xs text-foreground focus:outline-none"
                >
                  <option value="context">1. Pre-Conditions</option>
                  <option value="trigger">2. Formation & Trigger</option>
                  <option value="entry_risk">3. Entry & Risk</option>
                  <option value="management">4. Management & Exit</option>
                  <option value="invalidation">5. Invalidation</option>
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-white/15"
                  onClick={() => setNewRuleMandatory(!newRuleMandatory)}
                >
                  {newRuleMandatory ? "Mandatory" : "Optional"}
                </Button>
                <Button size="sm" onClick={handleAddRule} className="h-8 bg-accent text-xs hover:bg-accent/90">
                  <Plus className="mr-1 size-3.5" /> Add Rule
                </Button>
              </div>
            </TabsContent>

            {/* Tab 3: Rule Adherence Correlation Analytics */}
            <TabsContent value="analytics" className="space-y-4">
              <div className="rounded-md border border-white/[0.08] bg-white/[0.02] p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  The TradeZella Discipline Matrix
                </h4>
                <p className="text-xs text-muted-foreground mb-4">
                  Compare performance when 100% of playbook rules were followed versus when rules were broken.
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Disciplined Card */}
                  <div className="rounded-md border border-up/30 bg-up/[0.04] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-up uppercase tracking-wider">
                        <CheckCircle2 className="size-4" /> When Disciplined (≥80% Rules Followed)
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {disciplinedTrades.length} trades
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded bg-black/40 p-2 text-center">
                        <span className="text-[10px] text-muted-foreground uppercase">Win Rate</span>
                        <p className="font-mono text-lg font-bold text-up">{disciplinedWinRate}%</p>
                      </div>
                      <div className="rounded bg-black/40 p-2 text-center">
                        <span className="text-[10px] text-muted-foreground uppercase">Avg R-Multiple</span>
                        <p className="font-mono text-lg font-bold text-up">+{disciplinedAvgR}R</p>
                      </div>
                    </div>
                  </div>

                  {/* Violated Card */}
                  <div className="rounded-md border border-down/30 bg-down/[0.04] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-down uppercase tracking-wider">
                        <XCircle className="size-4" /> When Rules Were Broken (&lt;80% Followed)
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {violatedTrades.length} trades
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded bg-black/40 p-2 text-center">
                        <span className="text-[10px] text-muted-foreground uppercase">Win Rate</span>
                        <p className="font-mono text-lg font-bold text-down">{violatedWinRate}%</p>
                      </div>
                      <div className="rounded bg-black/40 p-2 text-center">
                        <span className="text-[10px] text-muted-foreground uppercase">Avg R-Multiple</span>
                        <p className="font-mono text-lg font-bold text-down">{violatedAvgR}R</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 4: Linked Trades */}
            <TabsContent value="trades" className="space-y-2">
              {linkedTrades.length === 0 ? (
                <div className="rounded-md border border-dashed border-white/10 p-8 text-center text-xs text-muted-foreground">
                  No trades logged with this playbook setup yet.
                </div>
              ) : (
                linkedTrades.map((t) => {
                  const pnl = getTradePnL(t);
                  const isLong = t.side === "long";
                  const isWin = t.result === "win";

                  return (
                    <div
                      key={t.id}
                      onClick={() => onInspectTrade?.(t)}
                      className="cursor-pointer flex items-center justify-between rounded-md border border-white/[0.08] bg-white/[0.02] p-3 text-xs transition-colors hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            isLong ? "bg-up/20 text-up" : "bg-down/20 text-down"
                          }`}
                        >
                          {t.side}
                        </span>
                        <span className="font-mono font-semibold text-foreground">{t.date} {t.time}</span>
                        <span className="text-muted-foreground">
                          {t.entry?.toFixed(2) ?? "—"} → {t.exitPrice?.toFixed(2) ?? "—"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`font-mono font-bold ${
                            pnl > 0 ? "text-up" : pnl < 0 ? "text-down" : "text-muted-foreground"
                          }`}
                        >
                          {formatCurrency(pnl)} ({t.rMultiple != null ? formatR(t.rMultiple) : "—"})
                        </span>
                        <Badge
                          variant={isWin ? "up" : "down"}
                          className={isWin ? "border-up/30 text-up" : "border-down/30 text-down"}
                        >
                          {t.result}
                        </Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
