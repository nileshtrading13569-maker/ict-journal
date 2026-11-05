import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Ellipsis,
  Eye,
  Layers,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { deskSnapshot, useDeskStore } from "@/lib/ict-store";
import { syncDeskToServer } from "@/lib/desk-sync";
import { closedTrades, fmtCurrency, instrumentOf, tradeDollarPnl } from "@/lib/ict-calc";
import { formatR } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDelete } from "@/components/desk/confirm-delete";
import { PlaybookFormModal } from "@/components/playbook/playbook-form-modal";
import { PlaybookDetailModal } from "@/components/playbook/playbook-detail-modal";
import type { SetupModel } from "@/lib/ict-types";

export const Route = createFileRoute("/playbook")({ component: PlaybookPage });

function getModelBadgeColors(code: string) {
  const c = (code || "").toUpperCase();
  if (c === "A") {
    return {
      badge: "border-red-500/30 bg-red-500/10 text-red-400",
      tag: "bg-red-950/60 border border-red-800/40 text-red-400",
      defaultTag: "CORE",
    };
  }
  if (c === "B") {
    return {
      badge: "border-red-500/30 bg-red-500/10 text-red-400",
      tag: "bg-red-950/60 border border-red-800/40 text-red-400",
      defaultTag: "PREMIUM FADE",
    };
  }
  if (c === "C") {
    return {
      badge: "border-[#3ddc84]/30 bg-[#3ddc84]/10 text-[#3ddc84]",
      tag: "bg-emerald-950/60 border border-emerald-800/40 text-emerald-400",
      defaultTag: "HIGH CONVICTION",
    };
  }
  if (c === "D") {
    return {
      badge: "border-amber-500/30 bg-amber-500/10 text-amber-400",
      tag: "bg-cyan-950/60 border border-cyan-800/40 text-cyan-400",
      defaultTag: "NY AM KILLZONE",
    };
  }
  if (c === "E") {
    return {
      badge: "border-white/10 bg-white/[0.04] text-[#888888]",
      tag: "bg-white/[0.04] border border-white/10 text-[#888888]",
      defaultTag: "CANDLE RANGE",
    };
  }
  return {
    badge: "border-white/10 bg-white/[0.04] text-[#888888]",
    tag: "bg-white/[0.04] border border-white/10 text-[#888888]",
    defaultTag: "ICT SETUP",
  };
}

function PlaybookPage() {
  const data = useDeskStore();
  const models = useDeskStore((s) => s.models);
  const recentlyDeletedModels = useDeskStore((s) => s.recentlyDeletedModels ?? []);
  const trades = useDeskStore((s) => s.trades);
  const removeModel = useDeskStore((s) => s.removeModel);
  const restoreModel = useDeskStore((s) => s.restoreModel);
  const permanentlyDeleteModel = useDeskStore((s) => s.permanentlyDeleteModel);
  const upsertModel = useDeskStore((s) => s.upsertModel);

  const [query, setQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"active" | "inactive" | "all">("active");
  const [viewMode, setViewMode] = useState<"card" | "table">("table");
  const [sortField, setSortField] = useState<
    "pnl" | "winRate" | "trades" | "name" | "rules" | "pf" | "avgR" | "expectancy" | "avgWinLoss"
  >("pnl");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<SetupModel | null>(null);
  const [viewingModel, setViewingModel] = useState<SetupModel | null>(null);
  const [deletingModel, setDeletingModel] = useState<SetupModel | null>(null);
  const [permDeletingModel, setPermDeletingModel] = useState<SetupModel | null>(null);
  const [deletedSectionOpen, setDeletedSectionOpen] = useState(true);

  const sortLabels: Record<typeof sortField, string> = {
    pnl: "Net P&L",
    winRate: "Win Rate",
    trades: "Trades",
    name: "Name",
    pf: "Profit Factor",
    avgR: "Avg R",
    rules: "Rules %",
    expectancy: "Expectancy",
    avgWinLoss: "Avg Win/Loss",
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Filtered models
  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      if (filterTab === "active" && !m.active) return false;
      if (filterTab === "inactive" && m.active) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const matchName = m.name.toLowerCase().includes(q);
        const matchCode = m.code.toLowerCase().includes(q);
        const matchMarket = (m.market || "").toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchMarket) return false;
      }
      return true;
    });
  }, [models, filterTab, query]);

  // Compute stats for each model
  const modelStats = useMemo(() => {
    const map = new Map<
      string,
      {
        closedCount: number;
        winCount: number;
        lossCount: number;
        winRate: number;
        netPnL: number;
        profitFactor: number;
        expectancy: number;
        expectancyR: number;
        avgR: number;
        avgWin: number | null;
        avgLoss: number | null;
        rulesFollowedPct: number;
        assessedCount: number;
        followedCount: number;
      }
    >();

    for (const m of models) {
      const sample = closedTrades(
        trades.filter((t) => t.modelId === m.id || t.modelName.toLowerCase() === m.name.toLowerCase()),
      );

      let netPnL = 0;
      let grossProfit = 0;
      let grossLoss = 0;
      let sumR = 0;
      let wins = 0;
      let losses = 0;
      let winningCount = 0;
      let losingCount = 0;
      let totalAssessed = 0;
      let totalFollowed = 0;

      for (const t of sample) {
        const inst = instrumentOf(data, t.market);
        const pnl = tradeDollarPnl(t, inst);
        const net = pnl.net ?? 0;
        netPnL += net;
        if (net > 0) {
          grossProfit += net;
          winningCount += 1;
        } else if (net < 0) {
          grossLoss += Math.abs(net);
          losingCount += 1;
        }

        const r = t.rMultiple ?? 0;
        sumR += r;
        if (t.result === "win") wins += 1;
        else if (t.result === "loss") losses += 1;

        // Rules assessment count
        const assessments = t.rulesAssessment ? Object.values(t.rulesAssessment) : [];
        if (assessments.length > 0) {
          totalAssessed += assessments.length;
          totalFollowed += assessments.filter((v) => v === "followed").length;
        } else {
          totalAssessed += 8;
          totalFollowed += t.ruleFollowed ? 7 : 4;
        }
      }

      const closedCount = sample.length;
      const winRate = closedCount > 0 ? Math.round((wins / closedCount) * 100) : 0;
      const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : Number((grossProfit / grossLoss).toFixed(2));
      const expectancy = closedCount > 0 ? Number((netPnL / closedCount).toFixed(2)) : 0;
      const expectancyR = closedCount > 0 ? Number((sumR / closedCount).toFixed(2)) : 0;
      const avgR = closedCount > 0 ? Number((sumR / closedCount).toFixed(2)) : 0;
      const avgWin = winningCount > 0 ? Number((grossProfit / winningCount).toFixed(2)) : null;
      const avgLoss = losingCount > 0 ? Number((grossLoss / losingCount).toFixed(2)) : null;
      const rulesFollowedPct = totalAssessed > 0 ? Math.round((totalFollowed / totalAssessed) * 100) : 100;

      map.set(m.id, {
        closedCount,
        winCount: wins,
        lossCount: losses,
        winRate,
        netPnL,
        profitFactor,
        expectancy,
        expectancyR,
        avgR,
        avgWin,
        avgLoss,
        rulesFollowedPct,
        assessedCount: totalAssessed,
        followedCount: totalFollowed,
      });
    }

    return map;
  }, [models, trades, data]);

  // Sorted list of models
  const sortedModels = useMemo(() => {
    return filteredModels.slice().sort((a, b) => {
      const statsA = modelStats.get(a.id);
      const statsB = modelStats.get(b.id);
      if (sortField === "name") {
        return sortDirection === "desc"
          ? b.name.localeCompare(a.name)
          : a.name.localeCompare(b.name);
      }
      let valA = 0;
      let valB = 0;
      if (sortField === "pnl") {
        valA = statsA?.netPnL ?? 0;
        valB = statsB?.netPnL ?? 0;
      } else if (sortField === "winRate") {
        valA = statsA?.winRate ?? 0;
        valB = statsB?.winRate ?? 0;
      } else if (sortField === "trades") {
        valA = statsA?.closedCount ?? 0;
        valB = statsB?.closedCount ?? 0;
      } else if (sortField === "pf") {
        valA = statsA?.profitFactor === Infinity ? 999999 : (statsA?.profitFactor ?? 0);
        valB = statsB?.profitFactor === Infinity ? 999999 : (statsB?.profitFactor ?? 0);
      } else if (sortField === "avgR") {
        valA = statsA?.avgR ?? 0;
        valB = statsB?.avgR ?? 0;
      } else if (sortField === "rules") {
        valA = statsA?.rulesFollowedPct ?? 0;
        valB = statsB?.rulesFollowedPct ?? 0;
      } else if (sortField === "expectancy") {
        valA = statsA?.expectancy ?? 0;
        valB = statsB?.expectancy ?? 0;
      } else if (sortField === "avgWinLoss") {
        valA = statsA?.avgWin ?? 0;
        valB = statsB?.avgWin ?? 0;
      }
      return sortDirection === "desc" ? valB - valA : valA - valB;
    });
  }, [filteredModels, modelStats, sortField, sortDirection]);

  // Overall totals across all closed trades
  const allClosedTrades = useMemo(() => closedTrades(trades), [trades]);

  const tradeDateLabel = useMemo(() => {
    if (allClosedTrades.length === 0) return "closed trades · all-time";
    const dates = allClosedTrades.map((t) => t.date).filter(Boolean).sort();
    if (dates.length === 0) return "closed trades · all-time";
    const min = dates[0];
    const max = dates[dates.length - 1];
    if (min === max) {
      return `closed trades · ${min}`;
    }
    return `closed trades · ${min} – ${max}`;
  }, [allClosedTrades]);

  const { totalNetPnL, totalGrossProfit, totalWins, totalLosses, totalBE, overallAvgR, overallWinRate } = useMemo(() => {
    let net = 0;
    let gross = 0;
    let wins = 0;
    let losses = 0;
    let be = 0;
    let rSum = 0;

    for (const t of allClosedTrades) {
      const pnl = tradeDollarPnl(t, instrumentOf(data, t.market));
      const n = pnl.net ?? 0;
      net += n;
      if (n > 0) gross += n;
      if (t.result === "win") wins += 1;
      else if (t.result === "loss") losses += 1;
      else if (t.result === "be") be += 1;
      rSum += t.rMultiple ?? 0;
    }

    const wr = allClosedTrades.length > 0 ? Math.round((wins / allClosedTrades.length) * 100) : 0;
    const avgR = allClosedTrades.length > 0 ? Number((rSum / allClosedTrades.length).toFixed(2)) : 0;

    return {
      totalNetPnL: net,
      totalGrossProfit: gross,
      totalWins: wins,
      totalLosses: losses,
      totalBE: be,
      overallWinRate: wr,
      overallAvgR: avgR,
    };
  }, [allClosedTrades, data]);

  // Unassigned trades calculation
  const unassignedTrades = useMemo(() => {
    return allClosedTrades.filter((t) => {
      if (!t.modelId && !t.modelName) return true;
      if (t.modelName && t.modelName.toLowerCase() === "unassigned") return true;
      const matched = models.some(
        (m) => m.id === t.modelId || m.name.toLowerCase() === (t.modelName || "").toLowerCase(),
      );
      return !matched;
    });
  }, [allClosedTrades, models]);

  // Best performer
  const bestPerformer = useMemo(() => {
    let best: { model: SetupModel; stats: NonNullable<ReturnType<typeof modelStats.get>> } | null = null;
    for (const m of models) {
      const s = modelStats.get(m.id);
      if (!s || s.closedCount === 0) continue;
      if (!best || s.netPnL > best.stats.netPnL) {
        best = { model: m, stats: s };
      }
    }
    return best;
  }, [models, modelStats]);

  // Most traded
  const mostTraded = useMemo(() => {
    let top: { model: SetupModel; stats: NonNullable<ReturnType<typeof modelStats.get>> } | null = null;
    for (const m of models) {
      const s = modelStats.get(m.id);
      if (!s || s.closedCount === 0) continue;
      if (!top || s.closedCount > top.stats.closedCount) {
        top = { model: m, stats: s };
      }
    }
    return top;
  }, [models, modelStats]);

  // Highest discipline
  const highestDiscipline = useMemo(() => {
    let top: { model: SetupModel; stats: NonNullable<ReturnType<typeof modelStats.get>> } | null = null;
    for (const m of models) {
      const s = modelStats.get(m.id);
      if (!s || s.closedCount === 0) continue;
      if (!top || s.rulesFollowedPct > top.stats.rulesFollowedPct) {
        top = { model: m, stats: s };
      }
    }
    return top;
  }, [models, modelStats]);

  const assignedTradesCount = allClosedTrades.length - unassignedTrades.length;
  const executionRatePct = allClosedTrades.length > 0 ? Math.round((assignedTradesCount / allClosedTrades.length) * 100) : 100;

  const activeCount = models.filter((m) => m.active).length;
  const inactiveCount = models.filter((m) => !m.active).length;

  const handleOpenCreate = () => {
    setEditingModel(null);
    setCreateModalOpen(true);
  };

  const handleOpenEdit = (m: SetupModel) => {
    setEditingModel(m);
    setCreateModalOpen(true);
  };

  const handleToggleActive = async (m: SetupModel) => {
    const updated = { ...m, active: !m.active };
    upsertModel(updated);
    try {
      const snapshot = deskSnapshot();
      await syncDeskToServer(snapshot);
      toast.success(updated.active ? `Activated ${m.name}` : `Deactivated ${m.name}`);
    } catch (err) {
      console.error("[playbook] failed to sync model active toggle:", err);
      upsertModel(m);
      toast.error("Failed to sync playbook status with cloud.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingModel) return;
    const modelToDelete = deletingModel;
    removeModel(modelToDelete.id);
    try {
      const snapshot = deskSnapshot();
      await syncDeskToServer(snapshot);
      toast.success(`Moved ${modelToDelete.name} to recently deleted`);
      setDeletingModel(null);
    } catch (err) {
      console.error("[playbook] failed to delete model:", err);
      restoreModel(modelToDelete.id);
      toast.error("Failed to delete playbook from cloud.");
    }
  };

  const handleRestore = async (id: string, name: string) => {
    const success = restoreModel(id);
    if (success) {
      try {
        const snapshot = deskSnapshot();
        await syncDeskToServer(snapshot);
        toast.success(`Restored ${name}`);
      } catch (err) {
        console.error("[playbook] failed to sync restored model:", err);
        removeModel(id);
        toast.error("Failed to sync restored playbook with cloud.");
      }
    } else {
      toast.error("Could not restore. Another active model already uses that code.");
    }
  };

  const handleRestoreAll = async () => {
    const list = useDeskStore.getState().recentlyDeletedModels ?? [];
    if (list.length === 0) return;
    const currentModels = useDeskStore.getState().models;
    const toRestore = list.map((item) => item.model);
    const existingCodes = new Set(currentModels.map((m) => m.code.toLowerCase()));
    const validToRestore = toRestore.filter((m) => !existingCodes.has(m.code.toLowerCase()));
    if (validToRestore.length === 0) {
      toast.error("Could not restore. Active models already use those setup codes.");
      return;
    }
    useDeskStore.setState((s) => ({
      models: [...s.models, ...validToRestore],
      recentlyDeletedModels: (s.recentlyDeletedModels ?? []).filter(
        (item) => !validToRestore.some((r) => r.id === item.model.id)
      ),
    }));
    try {
      const snapshot = deskSnapshot();
      await syncDeskToServer(snapshot);
      toast.success(`Restored ${validToRestore.length} playbooks`);
    } catch (err) {
      console.error("[playbook] failed to sync restore all:", err);
      useDeskStore.setState({ models: currentModels, recentlyDeletedModels: list });
      toast.error("Failed to sync restored playbooks with cloud.");
    }
  };

  const handlePermanentDelete = async () => {
    if (!permDeletingModel) return;
    const modelToPermDelete = permDeletingModel;
    const prevDeleted = useDeskStore.getState().recentlyDeletedModels ?? [];
    permanentlyDeleteModel(modelToPermDelete.id);
    try {
      const snapshot = deskSnapshot();
      await syncDeskToServer(snapshot);
      toast.success(`Permanently deleted ${modelToPermDelete.name}`);
      setPermDeletingModel(null);
    } catch (err) {
      console.error("[playbook] failed to permanently delete model:", err);
      useDeskStore.setState({ recentlyDeletedModels: prevDeleted });
      toast.error("Failed to delete playbook from cloud.");
    }
  };

  const handleExportStats = () => {
    const exportData = models.map((m) => {
      const stats = modelStats.get(m.id);
      return {
        code: m.code,
        name: m.name,
        market: m.market,
        timeframe: m.timeframe,
        trades: stats?.closedCount ?? 0,
        winRate: `${stats?.winRate ?? 0}%`,
        netPnL: stats?.netPnL ?? 0,
        profitFactor: stats?.profitFactor === Infinity ? "Infinity" : (stats?.profitFactor ?? 0),
        expectancy: stats?.expectancy ?? 0,
        avgR: stats?.avgR ?? 0,
        avgWin: stats?.avgWin ?? null,
        avgLoss: stats?.avgLoss ?? null,
        rulesFollowedPct: `${stats?.rulesFollowedPct ?? 100}%`,
      };
    });
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `playbook_stats_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Playbook statistics exported successfully");
  };

  const activeViewingModel = useMemo(() => {
    if (!viewingModel) return null;
    return models.find((m) => m.id === viewingModel.id) ?? viewingModel;
  }, [models, viewingModel]);

  return (
    <AppShell>
      <div className="w-full min-w-0 space-y-5">
        {/* Top Header Row (matching V3.8 EDGE ENGINE screenshot) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-3xl sm:text-4xl text-white tracking-tight">
              Playbook
            </h1>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border border-white/10 bg-white/[0.03] text-[#8e8e8e]">
              V3.8 EDGE ENGINE
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportStats}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-[#121212] hover:bg-white/[0.06] hover:border-white/20 text-xs font-medium text-[#cccccc] transition-colors"
            >
              <Download className="size-3.5 text-[#999999]" />
              <span>Export Stats</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-[0_0_18px_rgba(239,68,68,0.35)] transition-all active:scale-[0.98]"
            >
              <span className="text-sm font-bold leading-none">+ +</span>
              <span>Create playbook</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[300px]">
            {/* Search */}
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#666666]" />
              <input
                type="text"
                placeholder="Search name, setup code, instrument..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-[#111111] border border-white/10 rounded-lg pl-9 pr-8 py-1.5 text-xs text-white placeholder-[#666666] focus:outline-none focus:border-white/25 transition-colors"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a2a2a0] hover:text-white"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center rounded-lg border border-white/10 bg-[#111111] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFilterTab("active")}
                className={`px-3 py-1 rounded-md font-mono text-[11px] font-semibold transition-all ${
                  filterTab === "active" ? "bg-white/10 text-white shadow-xs" : "text-[#a1a1aa] hover:text-white"
                }`}
              >
                ACTIVE <span className="ml-1">{activeCount}</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("inactive")}
                className={`px-3 py-1 rounded-md font-mono text-[11px] font-semibold transition-all ${
                  filterTab === "inactive" ? "bg-white/10 text-white shadow-xs" : "text-[#a1a1aa] hover:text-white"
                }`}
              >
                INACTIVE <span className="ml-1">{inactiveCount}</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("all")}
                className={`px-3 py-1 rounded-md font-mono text-[11px] font-semibold transition-all ${
                  filterTab === "all" ? "bg-white/10 text-white shadow-xs" : "text-[#a1a1aa] hover:text-white"
                }`}
              >
                ALL <span className="ml-1">{models.length}</span>
              </button>
            </div>
          </div>

          {/* Right Toolbar Items */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-[#111111] text-xs text-[#a0a0a0]">
              <Calendar className="size-3.5 text-[#a1a1aa]" />
              <span className="capitalize">{tradeDateLabel}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#3ddc84] ml-0.5"></span>
            </div>

            <button
              type="button"
              className="p-1.5 rounded-lg border border-white/10 bg-[#111111] hover:bg-white/[0.06] text-[#888888] hover:text-white transition-colors"
              title="Filter Settings"
            >
              <SlidersHorizontal className="size-4" />
            </button>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg border border-white/10 bg-[#111111] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                title="Table view"
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === "table" ? "bg-white/10 text-white" : "text-[#a1a1aa] hover:text-white"
                }`}
              >
                <List className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("card")}
                title="Card grid view"
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === "card" ? "bg-white/10 text-white" : "text-[#a1a1aa] hover:text-white"
                }`}
              >
                <LayoutGrid className="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 4 Top KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: TOTAL PLAYBOOKS */}
          <div className="rounded-xl border border-white/[0.08] bg-[#0c0c0c] p-3.5 relative overflow-hidden transition-all hover:border-white/15">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-[#a1a1aa]">
                TOTAL PLAYBOOKS
              </span>
              <Layers className="size-4 text-[#555555]" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="font-mono text-2xl font-bold text-white tracking-tight">
                {models.length}
              </span>
              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#3ddc84]/10 border border-[#3ddc84]/30 text-[#3ddc84]">
                {activeCount} ACTIVE
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-[#a1a1aa] border-t border-white/[0.05] pt-2">
              <span>Assigned execution rate</span>
              <span className="font-mono text-white font-medium">
                {allClosedTrades.length > 0 ? `${executionRatePct}%` : "—"} ({assignedTradesCount}/{allClosedTrades.length || 0})
              </span>
            </div>
          </div>

          {/* Card 2: BEST PERFORMER */}
          <div className="rounded-xl border border-white/[0.08] bg-[#0c0c0c] p-3.5 relative overflow-hidden transition-all hover:border-white/15">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-[#a1a1aa]">
                BEST PERFORMER
              </span>
              {bestPerformer ? (
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#3ddc84]/15 border border-[#3ddc84]/40 text-[#3ddc84]">
                  {bestPerformer.model.code}
                </span>
              ) : (
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/10 text-[#666666]">
                  —
                </span>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {bestPerformer ? (
                <>
                  <span className={`font-mono text-2xl font-bold tracking-tight ${bestPerformer.stats.netPnL >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]"}`}>
                    {fmtCurrency(bestPerformer.stats.netPnL)}
                  </span>
                  <span className="text-xs text-[#888888] font-medium truncate">
                    {bestPerformer.model.name}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-mono text-2xl font-bold text-[#555555] tracking-tight">
                    $0.00
                  </span>
                  <span className="text-xs text-[#666666] font-medium truncate">
                    No trade data
                  </span>
                </>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-[#a1a1aa] border-t border-white/[0.05] pt-2">
              <span>Win Rate / Expectancy</span>
              {bestPerformer ? (
                <span className="font-mono text-[#3ddc84] font-medium">
                  {bestPerformer.stats.winRate}% · {formatR(bestPerformer.stats.avgR)}
                </span>
              ) : (
                <span className="font-mono text-[#666666] font-medium">
                  — · —
                </span>
              )}
            </div>
          </div>

          {/* Card 3: MOST TRADED */}
          <div className="rounded-xl border border-white/[0.08] bg-[#0c0c0c] p-3.5 relative overflow-hidden transition-all hover:border-white/15">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-[#a1a1aa]">
                MOST TRADED
              </span>
              {mostTraded ? (
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/40 text-red-400">
                  {mostTraded.model.code}
                </span>
              ) : (
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/10 text-[#666666]">
                  —
                </span>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {mostTraded ? (
                <>
                  <span className="font-mono text-2xl font-bold text-white tracking-tight">
                    {mostTraded.stats.closedCount}
                  </span>
                  <span className="text-xs text-[#888888]">Trades</span>
                  <span className="text-xs text-[#bbbbbb] font-medium truncate">
                    {mostTraded.model.name}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-mono text-2xl font-bold text-[#555555] tracking-tight">
                    0
                  </span>
                  <span className="text-xs text-[#666666]">Trades</span>
                  <span className="text-xs text-[#666666] font-medium truncate">
                    No trade data
                  </span>
                </>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-[#a1a1aa] border-t border-white/[0.05] pt-2">
              <span>Volume share</span>
              <span className="font-mono text-white font-medium">
                {allClosedTrades.length > 0 && mostTraded
                  ? `${((mostTraded.stats.closedCount / allClosedTrades.length) * 100).toFixed(1)}% of total`
                  : "—"}
              </span>
            </div>
          </div>

          {/* Card 4: HIGHEST DISCIPLINE */}
          <div className="rounded-xl border border-white/[0.08] bg-[#0c0c0c] p-3.5 relative overflow-hidden transition-all hover:border-white/15">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-[#a1a1aa]">
                HIGHEST DISCIPLINE
              </span>
              <div className={`size-4 rounded-full flex items-center justify-center ${
                highestDiscipline ? "bg-[#3ddc84]/15 border border-[#3ddc84]/40 text-[#3ddc84]" : "bg-white/[0.04] border border-white/10 text-[#666666]"
              }`}>
                <CheckCircle2 className="size-3" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {highestDiscipline ? (
                <>
                  <span className="font-mono text-2xl font-bold text-[#3ddc84] tracking-tight">
                    {highestDiscipline.stats.rulesFollowedPct}%
                  </span>
                  <span className="text-xs text-[#888888] font-medium">
                    {highestDiscipline.stats.followedCount} / {highestDiscipline.stats.assessedCount} Checklist
                  </span>
                </>
              ) : (
                <>
                  <span className="font-mono text-2xl font-bold text-[#555555] tracking-tight">
                    —
                  </span>
                  <span className="text-xs text-[#666666] font-medium">
                    0 / 0 Checklist
                  </span>
                </>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-[#a1a1aa] border-t border-white/[0.05] pt-2">
              <span>Playbook model</span>
              <span className="font-mono text-[#888888] font-medium truncate">
                {highestDiscipline ? `${highestDiscipline.model.code} · ${highestDiscipline.model.name}` : "No trade data"}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content: Table View (default) or Card Grid View */}
        {viewMode === "table" ? (
          <div className="rounded-xl border border-white/[0.08] bg-[#0a0a0a] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.07] bg-white/[0.015] text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
                    <th className="py-3 px-4 font-semibold">
                      <button
                        type="button"
                        onClick={() => handleSort("name")}
                        className="inline-flex items-center gap-1 text-inherit hover:text-white transition-colors"
                      >
                        PLAYBOOK MODEL
                        {sortField === "name" && (
                          sortDirection === "desc" ? <ArrowDown className="size-3 text-red-500" /> : <ArrowUp className="size-3 text-red-500" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-3 text-right font-semibold">
                      <button
                        type="button"
                        onClick={() => handleSort("trades")}
                        className="inline-flex items-center gap-1 text-inherit hover:text-white transition-colors"
                      >
                        TRADES
                        {sortField === "trades" && (
                          sortDirection === "desc" ? <ArrowDown className="size-3 text-red-500" /> : <ArrowUp className="size-3 text-red-500" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-3 text-right font-semibold">
                      <button
                        type="button"
                        onClick={() => handleSort("winRate")}
                        className="inline-flex items-center gap-1 text-inherit hover:text-white transition-colors"
                      >
                        WIN RATE
                        {sortField === "winRate" && (
                          sortDirection === "desc" ? <ArrowDown className="size-3 text-red-500" /> : <ArrowUp className="size-3 text-red-500" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-3 text-right font-semibold">
                      <button
                        type="button"
                        onClick={() => handleSort("pnl")}
                        className="inline-flex items-center gap-1 text-inherit hover:text-white transition-colors"
                      >
                        NET P&amp;L
                        {sortField === "pnl" && (
                          sortDirection === "desc" ? <ArrowDown className="size-3 text-red-500" /> : <ArrowUp className="size-3 text-red-500" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-3 text-right font-semibold">
                      <button
                        type="button"
                        onClick={() => handleSort("pf")}
                        className="inline-flex items-center gap-1 text-inherit hover:text-white transition-colors"
                      >
                        PROFIT FAC
                        {sortField === "pf" && (
                          sortDirection === "desc" ? <ArrowDown className="size-3 text-red-500" /> : <ArrowUp className="size-3 text-red-500" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-3 text-right font-semibold">
                      <button
                        type="button"
                        onClick={() => handleSort("expectancy")}
                        className="inline-flex items-center gap-1 text-inherit hover:text-white transition-colors"
                      >
                        EXPECTANCY
                        {sortField === "expectancy" && (
                          sortDirection === "desc" ? <ArrowDown className="size-3 text-red-500" /> : <ArrowUp className="size-3 text-red-500" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-3 text-right font-semibold">
                      <button
                        type="button"
                        onClick={() => handleSort("avgR")}
                        className="inline-flex items-center gap-1 text-inherit hover:text-white transition-colors"
                      >
                        AVG R
                        {sortField === "avgR" && (
                          sortDirection === "desc" ? <ArrowDown className="size-3 text-red-500" /> : <ArrowUp className="size-3 text-red-500" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-3 text-right font-semibold">
                      <button
                        type="button"
                        onClick={() => handleSort("avgWinLoss")}
                        className="inline-flex items-center gap-1 text-inherit hover:text-white transition-colors"
                      >
                        AVG WIN / LOSS
                        {sortField === "avgWinLoss" && (
                          sortDirection === "desc" ? <ArrowDown className="size-3 text-red-500" /> : <ArrowUp className="size-3 text-red-500" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4 text-left font-semibold">
                      <button
                        type="button"
                        onClick={() => handleSort("rules")}
                        className="inline-flex items-center gap-1 text-inherit hover:text-white transition-colors"
                      >
                        RULE FOLLOWED
                        {sortField === "rules" && (
                          sortDirection === "desc" ? <ArrowDown className="size-3 text-red-500" /> : <ArrowUp className="size-3 text-red-500" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-3 text-center w-10 text-[#a1a1aa]">···</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {sortedModels.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-sm text-[#a2a2a0]">
                        {models.length === 0 && recentlyDeletedModels.length > 0 ? (
                          <div className="flex flex-col items-center justify-center gap-3">
                            <p className="text-white font-medium text-sm">
                              All playbooks ({recentlyDeletedModels.length}) are currently in Recently Deleted.
                            </p>
                            <p className="text-xs text-[#888888] max-w-md">
                              Restore playbooks to resume tracking, or create a brand new custom setup.
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              <button
                                type="button"
                                onClick={handleRestoreAll}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#3ddc84]/15 border border-[#3ddc84]/40 text-xs font-semibold text-[#3ddc84] hover:bg-[#3ddc84]/25 transition-colors"
                              >
                                <RotateCcw className="size-3.5" /> Restore All Playbooks ({recentlyDeletedModels.length})
                              </button>
                              <button
                                type="button"
                                onClick={handleOpenCreate}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors"
                              >
                                <Plus className="size-3.5" /> Create Playbook
                              </button>
                            </div>
                          </div>
                        ) : query ? (
                          "No playbooks match your search query."
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-2">
                            <p>No playbooks match your criteria.</p>
                            <button
                              type="button"
                              onClick={handleOpenCreate}
                              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
                            >
                              <Plus className="size-3.5" /> Create Playbook
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    sortedModels.map((m) => {
                      const stats = modelStats.get(m.id) ?? {
                        closedCount: 0,
                        winCount: 0,
                        lossCount: 0,
                        winRate: 0,
                        netPnL: 0,
                        profitFactor: 0,
                        expectancy: 0,
                        expectancyR: 0,
                        avgR: 0,
                        avgWin: null,
                        avgLoss: null,
                        rulesFollowedPct: 100,
                        assessedCount: 0,
                        followedCount: 0,
                      };

                      const colors = getModelBadgeColors(m.code);
                      const pfDisplay = stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2);
                      const progressBg =
                        stats.rulesFollowedPct >= 80 ? "bg-[#3ddc84]" : stats.rulesFollowedPct >= 70 ? "bg-amber-400" : "bg-[#ff6b7d]";
                      const rulesTextCol =
                        stats.rulesFollowedPct >= 80 ? "text-[#3ddc84]" : stats.rulesFollowedPct >= 70 ? "text-amber-400" : "text-[#ff6b7d]";

                      return (
                        <tr
                          key={m.id}
                          onClick={() => setViewingModel(m)}
                          className="group cursor-pointer hover:bg-white/[0.03] transition-colors"
                        >
                          {/* Playbook Model */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <span className={`w-6 h-6 rounded flex items-center justify-center font-mono font-bold text-xs border ${colors.badge}`}>
                                {m.code}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-white group-hover:text-red-400 transition-colors truncate">
                                    {m.name}
                                  </span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${colors.tag}`}>
                                    {colors.defaultTag}
                                  </span>
                                </div>
                                <div className="text-[11px] font-mono text-[#a1a1aa] mt-0.5 truncate">
                                  {m.market} · {m.timeframe} · {m.trigger || m.pdArray || "Standard ICT Setup"}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Trades */}
                          <td className="py-3 px-3 text-right font-mono font-bold text-white text-xs">
                            {stats.closedCount}
                          </td>

                          {/* Win Rate */}
                          <td className="py-3 px-3 text-right font-mono">
                            <div className={`font-bold ${stats.winRate >= 50 ? "text-[#3ddc84]" : "text-[#ff6b7d]"}`}>
                              {stats.winRate.toFixed(1)}%
                            </div>
                            <div className="text-[10px] text-[#a1a1aa]">
                              {stats.winCount}W - {stats.lossCount}L
                            </div>
                          </td>

                          {/* Net P&L */}
                          <td className={`py-3 px-3 text-right font-mono font-bold ${stats.netPnL >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]"}`}>
                            {fmtCurrency(stats.netPnL)}
                          </td>

                          {/* Profit Fac */}
                          <td className="py-3 px-3 text-right font-mono text-[#cccccc]">
                            {stats.profitFactor === Infinity ? (
                              <span className="text-[#3ddc84] text-sm">∞</span>
                            ) : (
                              pfDisplay
                            )}
                          </td>

                          {/* Expectancy */}
                          <td className="py-3 px-3 text-right font-mono">
                            <div className={`font-bold ${stats.expectancy >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]"}`}>
                              {fmtCurrency(stats.expectancy)}
                            </div>
                            <div className={`text-[10px] ${stats.expectancyR >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]"}`}>
                              {formatR(stats.expectancyR)} / trd
                            </div>
                          </td>

                          {/* Avg R */}
                          <td className={`py-3 px-3 text-right font-mono font-bold ${stats.avgR >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]"}`}>
                            {formatR(stats.avgR)}
                          </td>

                          {/* Avg Win / Loss */}
                          <td className="py-3 px-3 text-right font-mono text-[11px]">
                            {stats.avgWin !== null && stats.avgLoss !== null ? (
                              <>
                                <span className="text-[#3ddc84]">+{fmtCurrency(stats.avgWin)}</span>{" "}
                                <span className="text-white/20">/</span>{" "}
                                <span className="text-[#ff6b7d]">-{fmtCurrency(stats.avgLoss)}</span>
                              </>
                            ) : stats.avgWin !== null ? (
                              <>
                                <span className="text-[#3ddc84]">+{fmtCurrency(stats.avgWin)}</span>{" "}
                                <span className="text-white/20">/ -</span>
                              </>
                            ) : stats.avgLoss !== null ? (
                              <>
                                <span className="text-white/20">- / </span>
                                <span className="text-[#ff6b7d]">-{fmtCurrency(stats.avgLoss)}</span>
                              </>
                            ) : (
                              <span className="text-[#a1a1aa]">- / -</span>
                            )}
                          </td>

                          {/* Rule Followed */}
                          <td className="py-3 px-4 min-w-[140px]">
                            <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                              <span className={`font-bold ${rulesTextCol}`}>{stats.rulesFollowedPct}%</span>
                              <span className="text-[#a1a1aa] text-[10px]">
                                {stats.followedCount}/{stats.assessedCount} rules
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${progressBg}`} style={{ width: `${stats.rulesFollowedPct}%` }} />
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  aria-label="Model options"
                                  className="p-1 rounded text-[#666666] hover:text-white hover:bg-white/10 transition-colors"
                                >
                                  <Ellipsis className="size-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="w-48 border-white/[0.1] bg-[#121212] text-white">
                                <DropdownMenuItem onClick={() => setViewingModel(m)}>
                                  <Eye className="mr-2 size-3.5 text-[#a2a2a0]" /> View details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenEdit(m)}>
                                  <Pencil className="mr-2 size-3.5 text-[#a2a2a0]" /> Edit playbook
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggleActive(m)}>
                                  <RotateCcw className="mr-2 size-3.5 text-[#a2a2a0]" />
                                  {m.active ? "Deactivate" : "Activate"}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-white/[0.08]" />
                                <DropdownMenuItem
                                  onClick={() => setDeletingModel(m)}
                                  className="text-[#ff6b7d] focus:text-[#ff6b7d]"
                                >
                                  <Trash2 className="mr-2 size-3.5" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Bottom Summary Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-white/[0.06] bg-black/40 text-[11px] text-[#a1a1aa]">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <span><strong className="text-white font-mono">{models.length}</strong> playbooks</span>
                <span className="text-white/20">·</span>
                <span><strong className="text-white font-mono">{allClosedTrades.length}</strong> closed trades</span>
                <span className="text-white/20">·</span>
                <span>Overall Net P&amp;L: <strong className={`font-mono ${totalNetPnL >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]"}`}>{fmtCurrency(totalNetPnL)}</strong></span>
                <span className="text-white/20">·</span>
                <span>Avg Win Rate: <strong className="text-white font-mono">{overallWinRate}%</strong></span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-[#444444]"></span>
                  <span>Unassigned trades: <strong className="text-white font-mono">{unassignedTrades.length}</strong></span>
                </div>
                <span className="text-white/20">·</span>
                <div>
                  <span>System Expectancy: <strong className={`font-mono ${overallAvgR >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]"}`}>{formatR(overallAvgR)}</strong></span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Card Grid View */
          <div className="mt-4">
            {sortedModels.length === 0 ? (
              <div className="rounded-xl border border-white/[0.08] bg-[#0a0a0a]/85 p-12 text-center text-[#a2a2a0]">
                <BookOpen className="mx-auto size-8 text-[#6f6f6d]" />
                {models.length === 0 && recentlyDeletedModels.length > 0 ? (
                  <>
                    <p className="mt-3 text-[14px] font-medium text-white">
                      All playbooks ({recentlyDeletedModels.length}) are in Recently Deleted
                    </p>
                    <p className="mt-1 text-[12px] text-[#a2a2a0]">
                      Restore playbooks to reactivate them, or create a brand new playbook.
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={handleRestoreAll}
                        className="inline-flex items-center gap-1.5 rounded-md bg-[#3ddc84]/15 border border-[#3ddc84]/40 px-3.5 py-1.5 text-[12px] font-semibold text-[#3ddc84] hover:bg-[#3ddc84]/25"
                      >
                        <RotateCcw className="size-3.5" /> Restore All Playbooks
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenCreate}
                        className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-red-500"
                      >
                        <Plus className="size-3.5" /> Create Playbook
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-3 text-[14px] font-medium text-white">No playbooks found</p>
                    <p className="mt-1 text-[12px] text-[#a2a2a0]">
                      {query
                        ? "Try adjusting your search query or filter"
                        : "Create your first playbook to start logging trades against standard setups."}
                    </p>
                    {!query && (
                      <button
                        type="button"
                        onClick={handleOpenCreate}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-red-500"
                      >
                        <Plus className="size-3.5" /> Create Playbook
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {sortedModels.map((m) => {
                  const stats = modelStats.get(m.id) ?? {
                    closedCount: 0,
                    winCount: 0,
                    lossCount: 0,
                    winRate: 0,
                    netPnL: 0,
                    profitFactor: 0,
                    expectancy: 0,
                    expectancyR: 0,
                    avgR: 0,
                    avgWin: null,
                    avgLoss: null,
                    rulesFollowedPct: 100,
                    assessedCount: 0,
                    followedCount: 0,
                  };

                  const colors = getModelBadgeColors(m.code);

                  return (
                    <div
                      key={m.id}
                      onClick={() => setViewingModel(m)}
                      className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0c0c] p-4.5 transition-all duration-200 hover:border-red-500/40 hover:bg-[#0f0f0f] cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`font-mono flex size-9 shrink-0 items-center justify-center rounded-lg border text-[14px] font-bold ${colors.badge}`}>
                            {m.code}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="truncate font-semibold text-[15px] text-white">
                                {m.name}
                              </h3>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${colors.tag}`}>
                                {colors.defaultTag}
                              </span>
                            </div>
                            <p className="font-mono mt-0.5 text-[11px] text-[#a2a2a0]">
                              {m.market} · {m.timeframe}
                            </p>
                          </div>
                        </div>

                        <div onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label="Model options"
                                className="flex size-7 items-center justify-center rounded-md text-[#a2a2a0] transition-colors hover:bg-white/[0.08] hover:text-white"
                              >
                                <Ellipsis className="size-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-48 border-white/[0.1] bg-[#121212] text-white shadow-xl">
                              <DropdownMenuItem onClick={() => setViewingModel(m)}>
                                <Eye className="mr-2 size-3.5 text-[#a2a2a0]" /> View details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenEdit(m)}>
                                <Pencil className="mr-2 size-3.5 text-[#a2a2a0]" /> Edit playbook
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleActive(m)}>
                                <RotateCcw className="mr-2 size-3.5 text-[#a2a2a0]" />
                                {m.active ? "Deactivate" : "Activate"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-white/[0.08]" />
                              <DropdownMenuItem
                                onClick={() => setDeletingModel(m)}
                                className="text-[#ff6b7d] focus:text-[#ff6b7d]"
                              >
                                <Trash2 className="mr-2 size-3.5" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3 text-center">
                        <div>
                          <p className="text-[10px] uppercase text-[#a1a1aa]">Net P&amp;L</p>
                          <p className={`font-mono text-xs font-bold ${stats.netPnL >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]"}`}>
                            {fmtCurrency(stats.netPnL)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-[#a1a1aa]">Win Rate</p>
                          <p className="font-mono text-xs font-bold text-white">
                            {stats.winRate}%
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-[#a1a1aa]">Rules</p>
                          <p className="font-mono text-xs font-bold text-[#3ddc84]">
                            {stats.rulesFollowedPct}%
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Recently Deleted Section (Collapsible) */}
        {recentlyDeletedModels.length > 0 && (
          <div className="rounded-xl border border-white/[0.08] bg-[#0c0c0c] overflow-hidden mt-4">
            <div
              onClick={() => setDeletedSectionOpen(!deletedSectionOpen)}
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors border-b border-white/[0.05]"
            >
              <div className="flex items-center gap-2 text-xs text-[#888888]">
                <Trash2 className="size-4 text-[#666666]" />
                <span>Recently deleted ({recentlyDeletedModels.length})</span>
                <span className="text-white/20">·</span>
                <span className="text-[#666666]">Linked execution trades are permanently kept in journal</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleRestoreAll();
                  }}
                  className="px-2.5 py-1 rounded border border-white/10 hover:border-white/20 bg-white/[0.04] text-[11px] font-medium text-[#cccccc] hover:text-white transition-colors"
                >
                  Restore all ({recentlyDeletedModels.length})
                </button>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-[#888888] tracking-wider uppercase">
                  <span>{deletedSectionOpen ? "COLLAPSE" : "EXPAND"}</span>
                  <ChevronDown className={`size-3.5 transition-transform ${deletedSectionOpen ? "rotate-0" : "-rotate-90"}`} />
                </div>
              </div>
            </div>

            {deletedSectionOpen && (
              <div className="p-4 space-y-3">
                {recentlyDeletedModels.map((item) => {
                  const m = item.model;
                  const deletedDate = new Date(item.deletedAt);
                  const formattedDeleted = !Number.isNaN(deletedDate.getTime())
                    ? `Deleted ${deletedDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}`
                    : "Deleted recently";

                  return (
                    <div
                      key={m.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-white/[0.05] bg-[#0e0e0e]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded border border-white/10 bg-white/[0.03] flex items-center justify-center font-mono font-bold text-xs text-[#888888]">
                          {m.code}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white">{m.name}</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-950/60 border border-red-800/40 text-red-400 uppercase tracking-wider">
                              ARCHIVED
                            </span>
                          </div>
                          <p className="text-[11px] text-[#666666] font-mono mt-0.5">
                            {formattedDeleted} · Setup preserved in journal history
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => handleRestore(m.id, m.name)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-white/10 hover:border-white/25 bg-white/[0.02] text-xs font-medium text-[#cccccc] transition-colors"
                        >
                          <RotateCcw className="size-3.5 text-[#888888]" />
                          Restore
                        </button>
                        <button
                          type="button"
                          onClick={() => setPermDeletingModel(m)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-red-900/40 hover:border-red-600/60 bg-red-950/20 text-xs font-medium text-red-400 transition-colors"
                        >
                          <Trash2 className="size-3.5 text-red-400" />
                          Delete permanently
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Form Modal (Create or Edit) */}
      <PlaybookFormModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        model={editingModel}
      />

      {/* Detail Modal */}
      <PlaybookDetailModal
        open={!!viewingModel}
        onOpenChange={(open) => !open && setViewingModel(null)}
        model={activeViewingModel}
        onEdit={(m) => {
          setViewingModel(null);
          handleOpenEdit(m);
        }}
        onToggleActive={handleToggleActive}
        onDelete={(m) => {
          setViewingModel(null);
          setDeletingModel(m);
        }}
      />

      {/* Confirm Soft Delete */}
      <ConfirmDelete
        open={!!deletingModel}
        onOpenChange={(open) => !open && setDeletingModel(null)}
        title={`Delete "${deletingModel?.name}"?`}
        description="This will move the playbook to Recently Deleted. Linked trades will keep their references."
        onConfirm={handleConfirmDelete}
      />

      {/* Confirm Permanent Delete */}
      <ConfirmDelete
        open={!!permDeletingModel}
        onOpenChange={(open) => !open && setPermDeletingModel(null)}
        title={`Permanently delete "${permDeletingModel?.name}"?`}
        description="This cannot be undone. This playbook will be completely removed."
        onConfirm={handlePermanentDelete}
      />
    </AppShell>
  );
}
