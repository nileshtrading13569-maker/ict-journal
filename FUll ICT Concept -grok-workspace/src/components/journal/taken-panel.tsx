import { useMemo, useState } from "react";
import {
  Download,
  Plus,
  Upload,
  Search,
  SlidersHorizontal,
  Table as TableIcon,
  LayoutGrid,
  TrendingUp,
  Clock,
  ShieldCheck,
  Eye,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { buildTradesCsv, downloadText, importTradesFromCsv } from "@/lib/journal-csv";
import type { DeskData, Side, Trade, TradeResult } from "@/lib/ict-types";
import { TradeCard } from "./trade-card";
import { TradeInspectorDialog } from "./trade-inspector-dialog";
import {
  formatCurrency,
  getTradePnL,
  getTradeHoldDuration,
  getTradeEfficiency,
  calculateTradeRuleAdherence,
} from "@/lib/tradezella-helpers";
import { formatR } from "@/lib/utils";

export function TakenPanel({
  trades,
  models,
  rules,
  onUpsert,
  onEdit,
  onDelete,
  onNewTrade,
}: {
  trades: Trade[];
  models: DeskData["models"];
  rules: DeskData["rules"];
  onUpsert: (trade: Trade) => void;
  onEdit: (trade: Trade) => void;
  onDelete: (id: string) => void;
  onNewTrade: () => void;
}) {
  const [query, setQuery] = useState("");
  const [side, setSide] = useState<"all" | Side>("all");
  const [result, setResult] = useState<"all" | TradeResult>("all");
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [inspectTrade, setInspectTrade] = useState<Trade | null>(null);

  const sorted = useMemo(
    () => trades.slice().sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)),
    [trades],
  );

  const filtered = sorted.filter((trade) => {
    const needle = query.trim().toLowerCase();
    const matchesQuery =
      !needle ||
      [trade.market, trade.modelName, trade.session, trade.killZone, trade.notes].some((value) =>
        value.toLowerCase().includes(needle),
      );
    return (
      matchesQuery &&
      (side === "all" || trade.side === side) &&
      (result === "all" || trade.result === result) &&
      (modelFilter === "all" || trade.modelId === modelFilter || trade.modelName === modelFilter)
    );
  });

  // Calculate TradeZella Overview KPIs
  const totalTrades = filtered.length;
  const wins = filtered.filter((t) => t.result === "win").length;
  const losses = filtered.filter((t) => t.result === "loss").length;
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
  const netPnL = filtered.reduce((sum, t) => sum + getTradePnL(t), 0);
  const netR = filtered.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0);
  const avgR = totalTrades > 0 ? (netR / totalTrades).toFixed(2) : "0.00";

  // Calculate overall Rule Adherence Rate %
  const adheredCount = filtered.filter((t) => {
    const m = models.find((mod) => mod.id === t.modelId || mod.name === t.modelName);
    return calculateTradeRuleAdherence(t, m).adherencePct >= 80;
  }).length;
  const adherenceRate = totalTrades > 0 ? Math.round((adheredCount / totalTrades) * 100) : 100;

  const exportCsv = () => {
    downloadText(
      buildTradesCsv(sorted),
      "text/csv",
      `tradezella-journal-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    toast.success("Trade CSV exported successfully");
  };

  const importCsv = async (file: File) => {
    try {
      if (file.size > 1_000_000) throw new Error("CSV file exceeds 1 MB limit.");
      const { trades: parsed, skipped } = importTradesFromCsv(await file.text(), { models, rules }, trades);
      if (!window.confirm(`Import ${parsed.length} trades? ${skipped} duplicate rows will be skipped.`)) {
        return;
      }
      parsed.forEach(onUpsert);
      toast.success(`Imported ${parsed.length} trades${skipped ? `; skipped ${skipped}` : ""}`);
    } catch (error) {
      console.error("[journal] failed to import trade CSV:", error);
      toast.error(error instanceof Error ? error.message : "Could not import this CSV.");
    }
  };

  return (
    <div className="space-y-4">
      {/* TradeZella Ribbon KPIs */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <div className="rounded-md border border-white/[0.08] bg-white/[0.02] p-2.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Total Trades
          </span>
          <p className="mt-0.5 font-mono text-base font-bold text-foreground">
            {totalTrades} <span className="text-xs font-normal text-muted-foreground">({wins}W / {losses}L)</span>
          </p>
        </div>

        <div className="rounded-md border border-white/[0.08] bg-white/[0.02] p-2.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Win Rate
          </span>
          <p className="mt-0.5 font-mono text-base font-bold text-foreground">
            {winRate}%
          </p>
        </div>

        <div className="rounded-md border border-white/[0.08] bg-white/[0.02] p-2.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Net P&L
          </span>
          <p
            className={`mt-0.5 font-mono text-base font-bold ${
              netPnL > 0 ? "text-up" : netPnL < 0 ? "text-down" : "text-muted-foreground"
            }`}
          >
            {formatCurrency(netPnL)}
          </p>
        </div>

        <div className="rounded-md border border-white/[0.08] bg-white/[0.02] p-2.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Net R-Multiple
          </span>
          <p
            className={`mt-0.5 font-mono text-base font-bold ${
              netR > 0 ? "text-up" : netR < 0 ? "text-down" : "text-muted-foreground"
            }`}
          >
            {formatR(netR)}
          </p>
        </div>

        <div className="rounded-md border border-white/[0.08] bg-white/[0.02] p-2.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Avg Realized R
          </span>
          <p className="mt-0.5 font-mono text-base font-bold text-foreground">
            {avgR}R
          </p>
        </div>

        <div className="rounded-md border border-white/[0.08] bg-white/[0.02] p-2.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Rule Adherence
          </span>
          <p
            className={`mt-0.5 font-mono text-base font-bold ${
              adherenceRate >= 80 ? "text-up" : "text-warn"
            }`}
          >
            {adherenceRate}%
          </p>
        </div>
      </div>

      {/* Filter and Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/[0.08] bg-white/[0.02] p-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter ticker, playbook, tag, notes..."
              className="h-8 pl-8 text-xs bg-black/40 border-white/10"
            />
          </div>

          {/* Direction Filter */}
          <select
            value={side}
            onChange={(e) => setSide(e.target.value as "all" | Side)}
            className="h-8 rounded-md border border-white/10 bg-black/40 px-2 text-xs text-foreground focus:outline-none"
          >
            <option value="all">Side: All</option>
            <option value="long">Longs Only</option>
            <option value="short">Shorts Only</option>
          </select>

          {/* Result Filter */}
          <select
            value={result}
            onChange={(e) => setResult(e.target.value as "all" | TradeResult)}
            className="h-8 rounded-md border border-white/10 bg-black/40 px-2 text-xs text-foreground focus:outline-none"
          >
            <option value="all">Result: All</option>
            <option value="win">Wins</option>
            <option value="loss">Losses</option>
            <option value="be">Break Even</option>
            <option value="open">Open</option>
          </select>

          {/* Playbook Filter */}
          <select
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            className="h-8 rounded-md border border-white/10 bg-black/40 px-2 text-xs text-foreground focus:outline-none"
          >
            <option value="all">Playbook: All</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* View Toggles & Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-white/10 p-0.5 bg-black/40">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`rounded px-2 py-1 text-xs transition-colors ${
                viewMode === "table" ? "bg-white/15 text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Table View"
            >
              <TableIcon className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`rounded px-2 py-1 text-xs transition-colors ${
                viewMode === "grid" ? "bg-white/15 text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="size-3.5" />
            </button>
          </div>

          <Button size="sm" variant="outline" className="h-8 border-white/15 text-xs" onClick={exportCsv}>
            <Download className="mr-1 size-3" /> Export
          </Button>

          <Button size="sm" variant="outline" className="h-8 border-white/15 text-xs" asChild>
            <label className="cursor-pointer">
              <Upload className="mr-1 size-3" /> Import
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) void importCsv(file);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </Button>

          <Button size="sm" onClick={onNewTrade} className="h-8 bg-accent text-xs hover:bg-accent/90">
            <Plus className="mr-1 size-3.5" /> Log Trade
          </Button>
        </div>
      </div>

      {/* Main Trade Content View */}
      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-white/10 p-8 text-center text-xs text-muted-foreground">
          No trades found matching your filters.
        </div>
      ) : viewMode === "table" ? (
        /* TradeZella Comprehensive Trade Table */
        <div className="overflow-x-auto rounded-md border border-white/[0.08] bg-[#070707]">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.02] text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2.5">Date / Time</th>
                <th className="px-3 py-2.5">Ticker</th>
                <th className="px-3 py-2.5">Side</th>
                <th className="px-3 py-2.5">Playbook Setup</th>
                <th className="px-3 py-2.5">Result</th>
                <th className="px-3 py-2.5">Net P&L</th>
                <th className="px-3 py-2.5">Realized R</th>
                <th className="px-3 py-2.5">Entry / Exit</th>
                <th className="px-3 py-2.5">Duration</th>
                <th className="px-3 py-2.5">Adherence</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map((trade) => {
                const pnl = getTradePnL(trade);
                const duration = getTradeHoldDuration(trade);
                const isLong = trade.side === "long";
                const isWin = trade.result === "win";
                const isLoss = trade.result === "loss";
                const model = models.find((m) => m.id === trade.modelId || m.name === trade.modelName);
                const adherence = calculateTradeRuleAdherence(trade, model);

                return (
                  <tr
                    key={trade.id}
                    onClick={() => setInspectTrade(trade)}
                    className="cursor-pointer transition-colors hover:bg-white/[0.04]"
                  >
                    <td className="px-3 py-2.5 font-mono text-muted-foreground whitespace-nowrap">
                      <span className="font-semibold text-foreground">{trade.date}</span>
                      <span className="ml-1.5 text-[10px]">{trade.time}</span>
                    </td>

                    <td className="px-3 py-2.5 font-mono font-semibold text-foreground whitespace-nowrap">
                      {trade.market}
                    </td>

                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          isLong ? "bg-up/20 text-up" : "bg-down/20 text-down"
                        }`}
                      >
                        {trade.side}
                      </span>
                    </td>

                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {trade.modelName ? (
                        <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] text-foreground font-mono">
                          {trade.modelName}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                          isWin
                            ? "bg-up/15 text-up border border-up/30"
                            : isLoss
                            ? "bg-down/15 text-down border border-down/30"
                            : "bg-white/10 text-muted-foreground"
                        }`}
                      >
                        {trade.result}
                      </span>
                    </td>

                    <td className="px-3 py-2.5 font-mono font-bold whitespace-nowrap">
                      <span className={pnl > 0 ? "text-up" : pnl < 0 ? "text-down" : "text-muted-foreground"}>
                        {formatCurrency(pnl)}
                      </span>
                    </td>

                    <td className="px-3 py-2.5 font-mono font-semibold whitespace-nowrap">
                      <span
                        className={
                          trade.rMultiple && trade.rMultiple > 0
                            ? "text-up"
                            : trade.rMultiple && trade.rMultiple < 0
                            ? "text-down"
                            : "text-muted-foreground"
                        }
                      >
                        {trade.rMultiple != null ? formatR(trade.rMultiple) : "—"}
                      </span>
                    </td>

                    <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {trade.entry?.toFixed(2) ?? "—"} → {trade.exitPrice?.toFixed(2) ?? "—"}
                    </td>

                    <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {duration}
                    </td>

                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span
                        className={`font-mono text-[11px] font-semibold ${
                          adherence.adherencePct >= 80 ? "text-up" : "text-warn"
                        }`}
                      >
                        {adherence.adherencePct}%
                      </span>
                    </td>

                    <td className="px-3 py-2.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="Inspect Canvas Chart"
                          onClick={() => setInspectTrade(trade)}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        >
                          <Eye className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="Edit Trade"
                          onClick={() => onEdit(trade)}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="Delete Trade"
                          onClick={() => {
                            if (confirm("Delete this trade?")) onDelete(trade.id);
                          }}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Card Grid View */
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((trade) => (
            <div key={trade.id} onClick={() => setInspectTrade(trade)} className="cursor-pointer">
              <TradeCard
                trade={trade}
                onEdit={() => onEdit(trade)}
                onDelete={() => onDelete(trade.id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Trade Inspector Popper with Candlestick Canvas Chart */}
      <TradeInspectorDialog
        trade={inspectTrade}
        open={Boolean(inspectTrade)}
        onOpenChange={(open) => !open && setInspectTrade(null)}
        models={models}
        onEditTrade={onEdit}
        onDeleteTrade={onDelete}
        onUpdateTrade={onUpsert}
      />
    </div>
  );
}
