import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Ellipsis,
  Eye,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { useDeskStore } from "@/lib/ict-store";
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
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [sortField, setSortField] = useState<"pnl" | "winRate" | "trades" | "name" | "rules" | "pf" | "avgR">("pnl");
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
  };

  const handleSort = (field: "pnl" | "winRate" | "trades" | "name" | "rules" | "pf" | "avgR") => {
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
        winRate: number;
        netPnL: number;
        profitFactor: number;
        expectancy: number;
        avgR: number;
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
      let totalAssessed = 0;
      let totalFollowed = 0;

      for (const t of sample) {
        const inst = instrumentOf(data, t.market);
        const pnl = tradeDollarPnl(t, inst);
        const net = pnl.net ?? 0;
        netPnL += net;
        if (net > 0) grossProfit += net;
        else if (net < 0) grossLoss += Math.abs(net);

        const r = t.rMultiple ?? 0;
        sumR += r;
        if (t.result === "win") wins += 1;

        // Rules assessment count
        const assessments = t.rulesAssessment ? Object.values(t.rulesAssessment) : [];
        if (assessments.length > 0) {
          totalAssessed += assessments.length;
          totalFollowed += assessments.filter((v) => v === "followed").length;
        } else {
          // Default assumed 8 rules per trade
          totalAssessed += 8;
          totalFollowed += t.ruleFollowed ? 7 : 4;
        }
      }

      const closedCount = sample.length;
      const winRate = closedCount > 0 ? Math.round((wins / closedCount) * 100) : 0;
      const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : Number((grossProfit / grossLoss).toFixed(2));
      const expectancy = closedCount > 0 ? Number((netPnL / closedCount).toFixed(2)) : 0;
      const avgR = closedCount > 0 ? Number((sumR / closedCount).toFixed(2)) : 0;
      const rulesFollowedPct = totalAssessed > 0 ? Math.round((totalFollowed / totalAssessed) * 100) : 100;

      map.set(m.id, {
        closedCount,
        winRate,
        netPnL,
        profitFactor,
        expectancy,
        avgR,
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
      }
      return sortDirection === "desc" ? valB - valA : valA - valB;
    });
  }, [filteredModels, modelStats, sortField, sortDirection]);

  // Overall totals across all closed trades
  const allClosedTrades = useMemo(() => closedTrades(trades), [trades]);

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
    await syncDeskToServer();
    toast.success(updated.active ? `Activated ${m.name}` : `Deactivated ${m.name}`);
  };

  const handleConfirmDelete = async () => {
    if (!deletingModel) return;
    removeModel(deletingModel.id);
    await syncDeskToServer();
    toast.success(`Moved ${deletingModel.name} to recently deleted`);
    setDeletingModel(null);
  };

  const handleRestore = async (id: string, name: string) => {
    const success = restoreModel(id);
    if (success) {
      await syncDeskToServer();
      toast.success(`Restored ${name}`);
    } else {
      toast.error("Could not restore. Another active model already uses that code.");
    }
  };

  const handlePermanentDelete = async () => {
    if (!permDeletingModel) return;
    permanentlyDeleteModel(permDeletingModel.id);
    await syncDeskToServer();
    toast.success(`Permanently deleted ${permDeletingModel.name}`);
    setPermDeletingModel(null);
  };

  const activeViewingModel = useMemo(() => {
    if (!viewingModel) return null;
    return models.find((m) => m.id === viewingModel.id) ?? viewingModel;
  }, [models, viewingModel]);

  return (
    <AppShell>
      <div className="w-full min-w-0">
        {/* Page Title Row */}
        <div className="flex h-12 items-center justify-between">
          <div>
            <h1 className="font-display text-[32px] sm:text-[36px] leading-none tracking-tight text-white">
              Playbook
            </h1>
            <p className="mt-1 text-[12px] text-[#a2a2a0]">
              ICT trading setups, structural execution rules, and edge metrics
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-[13px] font-semibold text-accent-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.98]"
          >
            <Plus className="size-3.5" />
            <span>Create playbook</span>
          </button>
        </div>

        {/* 1. Summary Bar at Top (4 Mini Stat Cards) */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Total Playbooks */}
          <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0c0c]/90 p-4 transition-all duration-200 hover:border-white/[0.14] hover:bg-[#0f0f0f]">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#a2a2a0]">
                Total Playbooks
              </span>
              <div className="flex size-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#d6d6d4]">
                <BookOpen className="size-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold tracking-tight text-white">{models.length}</span>
              <span className="text-[11px] text-[#a2a2a0]">strategies</span>
            </div>
            <p className="mt-1 text-[11px] text-[#a2a2a0]">
              <span className="font-mono text-white">{activeCount}</span> active ·{" "}
              <span className="font-mono text-[#a2a2a0]">{inactiveCount}</span> inactive
            </p>
          </div>

          {/* Card 2: Avg Win Rate */}
          <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0c0c]/90 p-4 transition-all duration-200 hover:border-white/[0.14] hover:bg-[#0f0f0f]">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#a2a2a0]">
                Avg Win Rate
              </span>
              <div className="flex size-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#d6d6d4]">
                <Target className="size-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold tracking-tight text-white">{overallWinRate}%</span>
              <span className="text-[11px] text-[#a2a2a0]">win rate</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#a2a2a0]">
              <span className="font-mono text-[#3ddc84]">{totalWins}W</span>
              <span>·</span>
              <span className="font-mono text-[#ff6b7d]">{totalLosses}L</span>
              <span>·</span>
              <span className="font-mono text-[#a2a2a0]">{totalBE}BE</span>
            </div>
          </div>

          {/* Card 3: Net P&L */}
          <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0c0c]/90 p-4 transition-all duration-200 hover:border-white/[0.14] hover:bg-[#0f0f0f]">
            <div
              className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent ${
                totalNetPnL >= 0 ? "via-[#3ddc84]/40" : "via-[#ff6b7d]/40"
              } to-transparent`}
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#a2a2a0]">
                Net P&amp;L
              </span>
              <div
                className={`flex size-8 items-center justify-center rounded-lg border ${
                  totalNetPnL >= 0
                    ? "border-[#3ddc84]/30 bg-[#3ddc84]/10 text-[#3ddc84]"
                    : "border-[#ff6b7d]/30 bg-[#ff6b7d]/10 text-[#ff6b7d]"
                }`}
              >
                {totalNetPnL >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className={`font-mono text-2xl font-bold tracking-tight ${
                  totalNetPnL >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]"
                }`}
              >
                {fmtCurrency(totalNetPnL)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[#a2a2a0]">
              Gross: <span className="font-mono text-white">{fmtCurrency(totalGrossProfit)}</span>
            </p>
          </div>

          {/* Card 4: Total Trades */}
          <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0c0c]/90 p-4 transition-all duration-200 hover:border-white/[0.14] hover:bg-[#0f0f0f]">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#a2a2a0]">
                Total Trades
              </span>
              <div className="flex size-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#d6d6d4]">
                <Activity className="size-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold tracking-tight text-white">{allClosedTrades.length}</span>
              <span className="text-[11px] text-[#a2a2a0]">closed</span>
            </div>
            <p className="mt-1 text-[11px] text-[#a2a2a0]">
              Avg R:{" "}
              <span className={`font-mono ${overallAvgR >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]"}`}>
                {formatR(overallAvgR)}
              </span>
            </p>
          </div>
        </div>

        {/* Toolbar Row */}
        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          {/* Search */}
          <div className="flex h-10 w-full sm:w-[280px] items-center gap-2 rounded-lg border border-white/[0.09] bg-[#151515]/80 px-3 text-[13px] text-white focus-within:border-white/[0.2]">
            <Search className="size-4 shrink-0 text-[#6f6f6d]" />
            <input
              type="text"
              placeholder="Search name, code, market..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent text-[13px] placeholder-[#6f6f6d] outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="flex size-5 shrink-0 items-center justify-center rounded text-[#a2a2a0] hover:text-white"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Segmented Filter */}
          <div className="flex h-10 overflow-hidden rounded-lg border border-white/[0.1] bg-[#121212] p-0.5 text-[12px] font-medium">
            <button
              type="button"
              onClick={() => setFilterTab("active")}
              className={`flex items-center rounded-md px-3 transition-colors ${
                filterTab === "active"
                  ? "bg-white/[0.12] font-semibold text-white shadow-xs"
                  : "text-[#a2a2a0] hover:text-white"
              }`}
            >
              Active <span className="font-mono ml-1.5 text-[11px] text-[#a2a2a0]">{activeCount}</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("inactive")}
              className={`flex items-center rounded-md px-3 transition-colors ${
                filterTab === "inactive"
                  ? "bg-white/[0.12] font-semibold text-white shadow-xs"
                  : "text-[#a2a2a0] hover:text-white"
              }`}
            >
              Inactive <span className="font-mono ml-1.5 text-[11px] text-[#a2a2a0]">{inactiveCount}</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("all")}
              className={`flex items-center rounded-md px-3 transition-colors ${
                filterTab === "all"
                  ? "bg-white/[0.12] font-semibold text-white shadow-xs"
                  : "text-[#a2a2a0] hover:text-white"
              }`}
            >
              All <span className="font-mono ml-1.5 text-[11px] text-[#a2a2a0]">{models.length}</span>
            </button>
          </div>

          {/* Sort Dropdown Selector */}
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-10 items-center gap-1.5 rounded-lg border border-white/[0.1] bg-[#121212] px-3 text-[12px] font-medium text-[#d6d6d4] transition-colors hover:border-white/[0.2] hover:text-white"
                >
                  <span className="text-[#a2a2a0]">Sort:</span>
                  <span className="font-semibold text-white">{sortLabels[sortField]}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-44 border-white/[0.1] bg-[#121212] text-white shadow-xl">
                {(
                  [
                    ["pnl", "Net P&L"],
                    ["winRate", "Win Rate"],
                    ["trades", "Trades"],
                    ["name", "Playbook Name"],
                    ["pf", "Profit Factor"],
                    ["avgR", "Avg R"],
                    ["rules", "Rules Followed %"],
                  ] as const
                ).map(([field, label]) => (
                  <DropdownMenuItem
                    key={field}
                    onClick={() => {
                      if (sortField === field) {
                        setSortDirection((d) => (d === "desc" ? "asc" : "desc"));
                      } else {
                        setSortField(field);
                        setSortDirection("desc");
                      }
                    }}
                    className={`flex items-center justify-between text-xs ${
                      sortField === field ? "bg-white/[0.08] font-semibold text-white" : "text-[#a2a2a0]"
                    }`}
                  >
                    <span>{label}</span>
                    {sortField === field &&
                      (sortDirection === "desc" ? (
                        <ArrowDown className="size-3 text-accent" />
                      ) : (
                        <ArrowUp className="size-3 text-accent" />
                      ))}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="button"
              onClick={() => setSortDirection((d) => (d === "desc" ? "asc" : "desc"))}
              title={`Sort direction: ${sortDirection === "desc" ? "Descending" : "Ascending"}`}
              aria-label={`Sort direction: ${sortDirection === "desc" ? "Descending" : "Ascending"}`}
              className="flex size-10 items-center justify-center rounded-lg border border-white/[0.1] bg-[#121212] text-[#d6d6d4] transition-colors hover:border-white/[0.2] hover:text-white"
            >
              {sortDirection === "desc" ? (
                <ArrowDown className="size-3.5 text-accent" />
              ) : (
                <ArrowUp className="size-3.5 text-accent" />
              )}
            </button>
          </div>

          {/* 3. Table Mode Toggle */}
          <div className="flex h-10 items-center rounded-lg border border-white/[0.1] bg-[#121212] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("card")}
              title="Card Grid view"
              aria-label="Card Grid view"
              className={`flex size-8.5 items-center justify-center rounded-md transition-colors ${
                viewMode === "card"
                  ? "bg-white/[0.12] text-white shadow-xs"
                  : "text-[#a2a2a0] hover:text-white"
              }`}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Table view"
              aria-label="Table view"
              className={`flex size-8.5 items-center justify-center rounded-md transition-colors ${
                viewMode === "table"
                  ? "bg-white/[0.12] text-white shadow-xs"
                  : "text-[#a2a2a0] hover:text-white"
              }`}
            >
              <List className="size-4" />
            </button>
          </div>

          {/* Date range caption */}
          <span className="ml-auto hidden text-[12px] text-[#a2a2a0] lg:inline-block">
            Closed trades · Oct 1 – Oct 29, 2026
          </span>
        </div>

        {/* 2. Main Content: Card Grid View or Table View */}
        {viewMode === "card" ? (
          /* Card Grid Layout */
          <div className="mt-4">
            {sortedModels.length === 0 ? (
              <div className="rounded-xl border border-white/[0.08] bg-[#0a0a0a]/85 p-12 text-center text-[#a2a2a0]">
                <BookOpen className="mx-auto size-8 text-[#6f6f6d]" />
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
                    className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-1.5 text-[12px] font-semibold text-accent-foreground hover:brightness-110"
                  >
                    <Plus className="size-3.5" /> Create Playbook
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {sortedModels.map((m) => {
                  const stats = modelStats.get(m.id) ?? {
                    closedCount: 0,
                    winRate: 0,
                    netPnL: 0,
                    profitFactor: 0,
                    expectancy: 0,
                    avgR: 0,
                    rulesFollowedPct: 100,
                    assessedCount: 0,
                    followedCount: 0,
                  };

                  const pfDisplay = stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2);
                  const rulesWarning = stats.rulesFollowedPct < 70;

                  return (
                    <div
                      key={m.id}
                      onClick={() => setViewingModel(m)}
                      className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0c0c] p-4.5 transition-all duration-200 hover:border-accent/40 hover:bg-[#0f0f0f] hover:shadow-[0_8px_30px_-10px_color-mix(in_srgb,var(--color-accent)_25%,transparent)] cursor-pointer"
                    >
                      {/* Top accent subtle hover glow bar */}
                      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-transparent to-transparent transition-opacity duration-300 group-hover:via-accent/80" />

                      {/* Header row: Left code + title, Right dropdown */}
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-mono flex size-9 shrink-0 items-center justify-center rounded-lg border border-accent/40 bg-accent/10 text-[14px] font-bold text-accent transition-colors group-hover:border-accent/70">
                              {m.code}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="truncate font-semibold text-[15px] text-white">
                                  {m.name}
                                </h3>
                                {!m.active && (
                                  <span className="shrink-0 rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-[#a2a2a0]">
                                    Inactive
                                  </span>
                                )}
                              </div>
                              <p className="font-mono mt-0.5 text-[11px] text-[#a2a2a0]">
                                {m.market} · {m.timeframe}
                              </p>
                            </div>
                          </div>

                          {/* Three-dot dropdown menu */}
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

                        {/* Middle: Win Rate visual bar with dynamic color */}
                        <div className="mt-3.5 space-y-1.5 rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a2a2a0]">
                              Win Rate
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-semibold text-white">{stats.winRate}%</span>
                              <span className="font-mono text-[10px] text-[#6f6f6d]">
                                ({stats.closedCount} {stats.closedCount === 1 ? "trade" : "trades"})
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(100, Math.max(0, stats.winRate))}%`,
                                backgroundColor:
                                  stats.winRate >= 60
                                    ? "#3ddc84"
                                    : stats.winRate >= 45
                                    ? "#f5b942"
                                    : stats.closedCount === 0
                                    ? "#6f6f6d"
                                    : "#ff6b7d",
                              }}
                            />
                          </div>
                        </div>

                        {/* Mini-metrics grid: Net P&L | Profit Factor | Avg R | Rules% */}
                        <div className="mt-3 grid grid-cols-4 gap-2 border-y border-white/[0.06] py-2.5">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a2a2a0]">Net P&amp;L</p>
                            <p
                              className={`font-mono text-[13px] font-semibold ${
                                stats.netPnL >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]"
                              }`}
                            >
                              {fmtCurrency(stats.netPnL)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a2a2a0]">Profit Factor</p>
                            <p className="font-mono text-[13px] font-semibold text-white">
                              {pfDisplay}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a2a2a0]">Avg R</p>
                            <p
                              className={`font-mono text-[13px] font-semibold ${
                                stats.avgR >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]"
                              }`}
                            >
                              {formatR(stats.avgR)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a2a2a0]">Rules %</p>
                            <p
                              className={`font-mono text-[13px] font-semibold ${
                                rulesWarning ? "text-[#f5b942]" : "text-[#3ddc84]"
                              }`}
                            >
                              {stats.rulesFollowedPct}%
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Bottom: thin progress bar for "Rules Followed" percentage */}
                      <div className="mt-3.5 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[10px] text-[#a2a2a0]">Rules Followed</span>
                          <span className="font-mono text-[10px] text-[#a2a2a0]">
                            {stats.followedCount} of {stats.assessedCount} ({stats.rulesFollowedPct}%)
                          </span>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(100, Math.max(0, stats.rulesFollowedPct))}%`,
                              backgroundColor:
                                stats.rulesFollowedPct >= 80
                                  ? "#3ddc84"
                                  : stats.rulesFollowedPct >= 65
                                  ? "#f5b942"
                                  : "#ff6b7d",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* 4. Enhanced Table (when in table mode) */
          <section className="relative mt-4 overflow-hidden rounded-xl border border-white/[0.09] bg-[#0a0a0a]/90">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e50914]/60 to-transparent" />

            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] table-fixed text-[13px]">
                <colgroup>
                  <col style={{ width: "280px" }} />
                  <col style={{ width: "70px" }} />
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "95px" }} />
                  <col style={{ width: "100px" }} />
                  <col style={{ width: "80px" }} />
                  <col />
                  <col style={{ width: "48px" }} />
                </colgroup>
                <thead>
                  <tr className="h-10 border-b border-white/[0.07] bg-white/[0.02] text-left text-[10px] font-semibold tracking-[0.12em] text-[#a2a2a0] uppercase">
                    <th className="px-4 font-semibold">
                      <button
                        type="button"
                        onClick={() => handleSort("name")}
                        className="inline-flex items-center gap-1 text-inherit hover:text-white transition-colors"
                      >
                        Playbook
                        {sortField === "name" && (
                          sortDirection === "desc" ? (
                            <ArrowDown className="size-3 text-[#e50914]" />
                          ) : (
                            <ArrowUp className="size-3 text-[#e50914]" />
                          )
                        )}
                      </button>
                    </th>
                    <th className="px-3 text-right font-semibold">
                      <button
                        type="button"
                        onClick={() => handleSort("trades")}
                        className="inline-flex items-center gap-1 text-inherit hover:text-white transition-colors"
                      >
                        Trades
                        {sortField === "trades" && (
                          sortDirection === "desc" ? (
                            <ArrowDown className="size-3 text-[#e50914]" />
                          ) : (
                            <ArrowUp className="size-3 text-[#e50914]" />
                          )
                        )}
                      </button>
                    </th>
                    <th className="px-3 text-right font-semibold">
                      <button
                        type="button"
                        onClick={() => handleSort("winRate")}
                        className="inline-flex items-center gap-1 text-inherit hover:text-white transition-colors"
                      >
                        Win rate
                        {sortField === "winRate" && (
                          sortDirection === "desc" ? (
                            <ArrowDown className="size-3 text-[#e50914]" />
                          ) : (
                            <ArrowUp className="size-3 text-[#e50914]" />
                          )
                        )}
                      </button>
                    </th>
                    <th className="px-3 text-right font-semibold">
                      <button
                        type="button"
                        onClick={() => handleSort("pnl")}
                        className="inline-flex items-center gap-1 text-inherit hover:text-white transition-colors"
                      >
                        Net P&amp;L
                        {sortField === "pnl" && (
                          sortDirection === "desc" ? (
                            <ArrowDown className="size-3 text-[#e50914]" />
                          ) : (
                            <ArrowUp className="size-3 text-[#e50914]" />
                          )
                        )}
                      </button>
                    </th>
                    <th className="px-3 text-right font-semibold">
                      <button
                        type="button"
                        onClick={() => handleSort("pf")}
                        className="inline-flex items-center gap-1 text-inherit hover:text-white transition-colors"
                      >
                        Profit factor
                        {sortField === "pf" && (
                          sortDirection === "desc" ? (
                            <ArrowDown className="size-3 text-[#e50914]" />
                          ) : (
                            <ArrowUp className="size-3 text-[#e50914]" />
                          )
                        )}
                      </button>
                    </th>
                    <th className="px-3 text-right font-semibold">Expectancy</th>
                    <th className="px-3 text-right font-semibold">
                      <button
                        type="button"
                        onClick={() => handleSort("avgR")}
                        className="inline-flex items-center gap-1 text-inherit hover:text-white transition-colors"
                      >
                        Avg R
                        {sortField === "avgR" && (
                          sortDirection === "desc" ? (
                            <ArrowDown className="size-3 text-[#e50914]" />
                          ) : (
                            <ArrowUp className="size-3 text-[#e50914]" />
                          )
                        )}
                      </button>
                    </th>
                    <th className="px-3 text-right font-semibold">
                      <button
                        type="button"
                        onClick={() => handleSort("rules")}
                        className="inline-flex items-center gap-1 text-inherit hover:text-white transition-colors"
                      >
                        Rules followed
                        {sortField === "rules" && (
                          sortDirection === "desc" ? (
                            <ArrowDown className="size-3 text-[#e50914]" />
                          ) : (
                            <ArrowUp className="size-3 text-[#e50914]" />
                          )
                        )}
                      </button>
                    </th>
                    <th aria-label="Actions" className="w-12" />
                  </tr>
                </thead>
                <tbody className="[&>tr]:h-16 [&>tr]:border-b [&>tr]:border-white/[0.05]">
                  {sortedModels.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-sm text-[#a2a2a0]">
                        No playbooks match your criteria.
                      </td>
                    </tr>
                  ) : (
                    sortedModels.map((m) => {
                      const stats = modelStats.get(m.id) ?? {
                        closedCount: 0,
                        winRate: 0,
                        netPnL: 0,
                        profitFactor: 0,
                        expectancy: 0,
                        avgR: 0,
                        rulesFollowedPct: 100,
                        assessedCount: 0,
                        followedCount: 0,
                      };

                      const pfDisplay = stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2);
                      const rulesWarning = stats.rulesFollowedPct < 70;

                      return (
                        <tr
                          key={m.id}
                          onClick={() => setViewingModel(m)}
                          className="cursor-pointer transition-colors even:bg-white/[0.015] hover:bg-white/[0.04]"
                        >
                          {/* Playbook info */}
                          <td className="px-4">
                            <div className="flex items-center gap-3">
                              <span className="font-mono flex size-8 shrink-0 items-center justify-center rounded-md border border-[#e50914]/40 bg-[#e50914]/10 text-[13px] font-semibold text-[#e50914]">
                                {m.code}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-white">{m.name}</p>
                                <p className="font-mono mt-0.5 text-[11px] text-[#a2a2a0]">
                                  {m.market} · {m.timeframe}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Trades */}
                          <td className="font-mono px-3 text-right text-white">
                            {stats.closedCount}
                          </td>

                          {/* Win Rate with inline mini bar */}
                          <td className="px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-1.5 w-10 overflow-hidden rounded-full bg-white/[0.08]">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.min(100, Math.max(0, stats.winRate))}%`,
                                    backgroundColor:
                                      stats.winRate >= 60
                                        ? "#3ddc84"
                                        : stats.winRate >= 45
                                        ? "#f5b942"
                                        : stats.closedCount === 0
                                        ? "#6f6f6d"
                                        : "#ff6b7d",
                                  }}
                                />
                              </div>
                              <span className="font-mono text-white">{stats.winRate}%</span>
                            </div>
                          </td>

                          {/* Net P&L */}
                          <td
                            className={`font-mono px-3 text-right font-medium ${
                              stats.netPnL >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]"
                            }`}
                          >
                            {fmtCurrency(stats.netPnL)}
                          </td>

                          {/* Profit Factor */}
                          <td className="font-mono px-3 text-right text-white">
                            {pfDisplay}
                          </td>

                          {/* Expectancy */}
                          <td
                            className={`font-mono px-3 text-right ${
                              stats.expectancy >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]"
                            }`}
                          >
                            {fmtCurrency(stats.expectancy)}
                          </td>

                          {/* Avg R */}
                          <td
                            className={`font-mono px-3 text-right ${
                              stats.avgR >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]"
                            }`}
                          >
                            {formatR(stats.avgR)}
                          </td>

                          {/* Rules followed */}
                          <td className="px-3 text-right">
                            <p
                              className={`font-mono ${
                                rulesWarning ? "text-[#f5b942]" : "text-white"
                              }`}
                            >
                              {stats.rulesFollowedPct}%
                            </p>
                            <p className="font-mono text-[11px] text-[#a2a2a0]">
                              {stats.followedCount} of {stats.assessedCount} assessed
                            </p>
                          </td>

                          {/* Actions */}
                          <td className="pr-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  aria-label="Model options"
                                  className="flex size-8 items-center justify-center rounded-md text-[#a2a2a0] transition-colors hover:bg-white/[0.08] hover:text-white"
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
          </section>
        )}

        {/* 5 & 7. Summary Footer with Unassigned Trades Badge */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#0c0c0c] px-5 py-3 text-[12px] text-[#a2a2a0]">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span>
              <strong className="font-mono text-[#d6d6d4]">{models.length}</strong> playbooks
            </span>
            <span className="text-white/[0.2]">·</span>
            <span>
              <strong className="font-mono text-[#d6d6d4]">{allClosedTrades.length}</strong> closed trades
            </span>
            <span className="text-white/[0.2]">·</span>
            <span>
              Net P&amp;L{" "}
              <strong className={`font-mono font-semibold ${totalNetPnL >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]"}`}>
                {fmtCurrency(totalNetPnL)}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span>Unassigned trades:</span>
            {unassignedTrades.length > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#f5b942]/30 bg-[#f5b942]/10 px-2.5 py-0.5 font-mono text-[11px] font-medium text-[#f5b942]">
                <AlertTriangle className="size-3" />
                {unassignedTrades.length} unassigned
              </span>
            ) : (
              <span className="font-mono text-[#d6d6d4]">0</span>
            )}
          </div>
        </div>

        {/* 6. Recently Deleted Section */}
        {recentlyDeletedModels.length > 0 && (
          <section className="mt-4 rounded-xl border border-white/[0.09] bg-[#0a0a0a]/85">
            <div
              onClick={() => setDeletedSectionOpen(!deletedSectionOpen)}
              className="flex h-12 cursor-pointer items-center justify-between px-4 transition-colors hover:bg-white/[0.02]"
            >
              <span className="flex items-center gap-2 text-[13px] font-semibold text-white">
                <Trash2 className="size-4 text-[#ff6b7d]" />
                {deletedSectionOpen ? (
                  <ChevronDown className="size-3.5 text-[#a2a2a0]" />
                ) : (
                  <ChevronUp className="size-3.5 text-[#a2a2a0]" />
                )}
                Recently deleted{" "}
                <span className="font-mono rounded bg-white/[0.08] px-2 py-0.5 text-[11px] font-normal text-[#a2a2a0]">
                  {recentlyDeletedModels.length}
                </span>
              </span>
              <span className="text-[12px] text-[#a2a2a0]">Linked trades are preserved</span>
            </div>

            {deletedSectionOpen && (
              <div className="border-t border-white/[0.06]">
                {recentlyDeletedModels.map((item) => {
                  const m = item.model;
                  const deletedDate = new Date(item.deletedAt);
                  const formattedDeleted = !Number.isNaN(deletedDate.getTime())
                    ? `Deleted ${deletedDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}, ${deletedDate.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}`
                    : "Deleted recently";

                  return (
                    <div
                      key={m.id}
                      className="flex flex-wrap items-center justify-between border-b border-white/[0.04] px-4 py-3 text-[13px] last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono flex size-8 items-center justify-center rounded-md border border-white/[0.12] text-[13px] text-[#a2a2a0]">
                          {m.code}
                        </span>
                        <div>
                          <p className="font-medium text-[#d6d6d4]">{m.name}</p>
                          <p className="font-mono text-[11px] text-[#a2a2a0]">{formattedDeleted}</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleRestore(m.id, m.name)}
                          className="flex h-8 items-center rounded-md border border-white/[0.12] bg-white/[0.04] px-3 text-[12px] font-semibold text-white transition hover:bg-white/[0.08]"
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          onClick={() => setPermDeletingModel(m)}
                          className="flex h-8 items-center rounded-md px-3 text-[12px] font-medium text-[#ff6b7d] transition hover:bg-white/[0.04]"
                        >
                          Delete permanently
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
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
