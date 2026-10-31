import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Copy,
  Download,
  Ellipsis,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { useDeskStore } from "@/lib/ict-store";
import { fmtCurrency, instrumentOf, tradeDollarPnl } from "@/lib/ict-calc";
import { paginateJournalRows } from "@/lib/journal-pagination";
import { cn, formatR } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Trade } from "@/lib/ict-types";

interface AllViewProps {
  trades: Trade[];
  selectedTradeId: string | null;
  onSelectTrade: (trade: Trade | null) => void;
  onEditTrade: (trade: Trade) => void;
}

export function AllView({
  trades,
  selectedTradeId,
  onSelectTrade,
}: AllViewProps) {
  const data = useDeskStore();
  const models = useDeskStore((s) => s.models);

  const [query, setQuery] = useState("");
  const [filterSide, setFilterSide] = useState<"all" | "long" | "short">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "win" | "loss" | "be">("all");
  const [filterReviewed, setFilterReviewed] = useState<"all" | "reviewed" | "unreviewed">("all");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Customizable visible columns state
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    time: true,
    symbol: true,
    side: true,
    status: true,
    lots: true,
    entry: true,
    exit: true,
    netPnl: true,
    rMultiple: true,
    playbook: true,
    tags: true,
    reviewed: true,
  });

  // Filtered & sorted trades
  const filtered = useMemo(() => {
    return trades
      .filter((t) => {
        // Query search
        if (query.trim()) {
          const q = query.toLowerCase();
          const matchSymbol = t.market.toLowerCase().includes(q);
          const matchPlaybook = t.modelName.toLowerCase().includes(q);
          const matchTags = (t.tags || []).some((tag) => tag.toLowerCase().includes(q));
          if (!matchSymbol && !matchPlaybook && !matchTags) return false;
        }

        // Side filter
        if (filterSide !== "all" && t.side !== filterSide) return false;

        // Status filter
        if (filterStatus !== "all" && t.result !== filterStatus) return false;

        // Reviewed filter
        if (filterReviewed === "reviewed" && !t.reviewed) return false;
        if (filterReviewed === "unreviewed" && t.reviewed) return false;

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(`${a.date}T${a.time || "00:00"}`).getTime();
        const timeB = new Date(`${b.date}T${b.time || "00:00"}`).getTime();
        return sortDirection === "desc" ? timeB - timeA : timeA - timeB;
      });
  }, [trades, query, filterSide, filterStatus, filterReviewed, sortDirection]);

  // Pagination
  const { rows, totalPages, page, startIndex } = useMemo(() => {
    return paginateJournalRows(filtered, currentPage, pageSize);
  }, [filtered, currentPage, pageSize]);

  // Overall totals
  const totalClosed = trades.filter((t) => t.result !== "open");
  const totalNetPnL = totalClosed.reduce((acc, t) => {
    const pnl = tradeDollarPnl(t, instrumentOf(data, t.market));
    return acc + (pnl.net ?? 0);
  }, 0);

  const getModelCode = (trade: Trade) => {
    const m = models.find((mod) => mod.id === trade.modelId || mod.name.toLowerCase() === trade.modelName.toLowerCase());
    return m ? `[${m.code}]` : "[A]";
  };

  const formatOpenTime = (trade: Trade) => {
    try {
      const d = new Date(`${trade.date}T${trade.time || "00:00"}`);
      const datePart = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const timePart = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      return `${datePart}, ${timePart}`;
    } catch {
      return `${trade.date} ${trade.time}`;
    }
  };

  const exportToCSV = () => {
    if (trades.length === 0) {
      toast.error("No trades to export.");
      return;
    }
    const headers = ["ID", "Date", "Time", "Symbol", "Side", "Lots", "Entry", "Exit", "P&L", "R", "Status", "Playbook", "Grade", "Notes"];
    const rows = trades.map((t) => {
      const inst = instrumentOf(data, t.market);
      const pnl = tradeDollarPnl(t, inst);
      return [
        t.id,
        t.date,
        t.time,
        t.market,
        t.side,
        t.lots ?? "",
        t.entry ?? "",
        t.exitPrice ?? "",
        pnl.net ?? 0,
        t.rMultiple ?? 0,
        t.result,
        `"${(t.modelName || "").replace(/"/g, '""')}"`,
        t.grade ?? "",
        `"${(t.notes || "").replace(/"/g, '""')}"`,
      ].join(",");
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `journal-trades-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Trades exported to CSV");
  };

  const copySummaryToClipboard = () => {
    const totalCount = trades.length;
    const winsCount = trades.filter((t) => t.result === "win").length;
    const wr = totalCount > 0 ? Math.round((winsCount / totalCount) * 100) : 0;
    const totalPnl = trades.reduce((acc, t) => {
      const pnl = tradeDollarPnl(t, instrumentOf(data, t.market));
      return acc + (pnl.net ?? 0);
    }, 0);
    const summary = `Journal Performance Summary:\n• Total Trades: ${totalCount}\n• Win Rate: ${wr}%\n• Net P&L: ${fmtCurrency(totalPnl)}`;
    navigator.clipboard.writeText(summary);
    toast.success("Summary copied to clipboard!");
  };

  const resetColumns = () => {
    setVisibleColumns({
      time: true,
      symbol: true,
      side: true,
      status: true,
      lots: true,
      entry: true,
      exit: true,
      netPnl: true,
      rMultiple: true,
      playbook: true,
      tags: true,
      reviewed: true,
    });
    toast.success("Columns reset to default");
  };

  const totalVisibleCols = Object.values(visibleColumns).filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Search and filter toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="flex h-10 w-[260px] items-center gap-2 rounded-md border border-white/[0.09] bg-[#151515]/80 px-3 text-[13px] text-white">
          <Search className="size-3.5 text-[#6f6f6d]" />
          <input
            type="text"
            placeholder="Search trades..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-transparent text-[13px] placeholder-[#6f6f6d] outline-none"
          />
        </div>

        {/* Side filter dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-10 items-center gap-2 rounded-md border border-white/[0.09] bg-white/[0.03] px-3 text-[13px] font-medium text-[#d6d6d4] transition-colors hover:bg-white/[0.06]"
            >
              <SlidersHorizontal className="size-3.5 text-[#a2a2a0]" />
              <span>Side: {filterSide === "all" ? "All" : filterSide === "long" ? "Long" : "Short"}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="border-white/[0.1] bg-[#121212] text-white">
            <DropdownMenuCheckboxItem checked={filterSide === "all"} onCheckedChange={() => setFilterSide("all")}>
              All sides
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={filterSide === "long"} onCheckedChange={() => setFilterSide("long")}>
              Long only
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={filterSide === "short"} onCheckedChange={() => setFilterSide("short")}>
              Short only
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Status filter dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-10 items-center gap-2 rounded-md border border-white/[0.09] bg-white/[0.03] px-3 text-[13px] font-medium text-[#d6d6d4] transition-colors hover:bg-white/[0.06]"
            >
              <span>
                Status:{" "}
                {filterStatus === "all"
                  ? "All"
                  : filterStatus === "win"
                    ? "Wins"
                    : filterStatus === "loss"
                      ? "Losses"
                      : filterStatus === "be"
                        ? "Break-even"
                        : "Open"}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="border-white/[0.1] bg-[#121212] text-white">
            <DropdownMenuCheckboxItem checked={filterStatus === "all"} onCheckedChange={() => setFilterStatus("all")}>
              All outcomes
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={filterStatus === "win"} onCheckedChange={() => setFilterStatus("win")}>
              Wins
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={filterStatus === "loss"} onCheckedChange={() => setFilterStatus("loss")}>
              Losses
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={filterStatus === "be"} onCheckedChange={() => setFilterStatus("be")}>
              Break-even
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={filterStatus === "open"} onCheckedChange={() => setFilterStatus("open")}>
              Open positions
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Reviewed filter dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-10 items-center gap-2 rounded-md border border-white/[0.09] bg-white/[0.03] px-3 text-[13px] font-medium text-[#d6d6d4] transition-colors hover:bg-white/[0.06]"
            >
              <span>Reviewed: {filterReviewed === "all" ? "All" : filterReviewed === "reviewed" ? "Reviewed" : "To review"}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="border-white/[0.1] bg-[#121212] text-white">
            <DropdownMenuCheckboxItem checked={filterReviewed === "all"} onCheckedChange={() => setFilterReviewed("all")}>
              All
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={filterReviewed === "reviewed"} onCheckedChange={() => setFilterReviewed("reviewed")}>
              Reviewed only
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={filterReviewed === "unreviewed"} onCheckedChange={() => setFilterReviewed("unreviewed")}>
              To review only
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Columns & Actions Dropdowns */}
        <div className="ml-auto flex items-center gap-2">
          {/* Columns Selector Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-10 items-center gap-2 rounded-md border border-white/[0.09] bg-white/[0.03] px-3 text-[13px] font-medium text-[#d6d6d4] transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <Columns3 className="size-3.5" />
                <span>Columns</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 border-white/[0.1] bg-[#121212] text-white">
              <DropdownMenuLabel className="text-[11px] font-semibold text-[#a2a2a0] uppercase tracking-wider">
                Toggle Table Columns
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/[0.08]" />
              <DropdownMenuCheckboxItem
                checked={visibleColumns.time}
                onCheckedChange={(v) => setVisibleColumns((p) => ({ ...p, time: v }))}
              >
                Open Time (ET)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visibleColumns.symbol}
                onCheckedChange={(v) => setVisibleColumns((p) => ({ ...p, symbol: v }))}
              >
                Symbol / Market
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visibleColumns.side}
                onCheckedChange={(v) => setVisibleColumns((p) => ({ ...p, side: v }))}
              >
                Side
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visibleColumns.status}
                onCheckedChange={(v) => setVisibleColumns((p) => ({ ...p, status: v }))}
              >
                Status
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visibleColumns.lots}
                onCheckedChange={(v) => setVisibleColumns((p) => ({ ...p, lots: v }))}
              >
                Lots / Size
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visibleColumns.entry}
                onCheckedChange={(v) => setVisibleColumns((p) => ({ ...p, entry: v }))}
              >
                Entry Price
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visibleColumns.exit}
                onCheckedChange={(v) => setVisibleColumns((p) => ({ ...p, exit: v }))}
              >
                Exit Price
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visibleColumns.netPnl}
                onCheckedChange={(v) => setVisibleColumns((p) => ({ ...p, netPnl: v }))}
              >
                Net P&amp;L
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visibleColumns.rMultiple}
                onCheckedChange={(v) => setVisibleColumns((p) => ({ ...p, rMultiple: v }))}
              >
                R-Multiple
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visibleColumns.playbook}
                onCheckedChange={(v) => setVisibleColumns((p) => ({ ...p, playbook: v }))}
              >
                Playbook Setup
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visibleColumns.tags}
                onCheckedChange={(v) => setVisibleColumns((p) => ({ ...p, tags: v }))}
              >
                Tags / Session
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visibleColumns.reviewed}
                onCheckedChange={(v) => setVisibleColumns((p) => ({ ...p, reviewed: v }))}
              >
                Reviewed Check
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator className="bg-white/[0.08]" />
              <DropdownMenuItem onClick={resetColumns} className="text-xs text-[#a2a2a0] hover:text-white">
                <RotateCcw className="mr-2 size-3.5" /> Reset to default
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* More Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="More options"
                className="flex size-10 items-center justify-center rounded-md border border-white/[0.09] bg-white/[0.03] text-[15px] text-[#d6d6d4] transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <Ellipsis className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 border-white/[0.1] bg-[#121212] text-white">
              <DropdownMenuLabel className="text-[11px] font-semibold text-[#a2a2a0] uppercase tracking-wider">
                Journal Actions
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/[0.08]" />
              <DropdownMenuItem onClick={exportToCSV} className="text-xs">
                <Download className="mr-2 size-3.5 text-[#a2a2a0]" />
                Export to CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copySummaryToClipboard} className="text-xs">
                <Copy className="mr-2 size-3.5 text-[#a2a2a0]" />
                Copy Summary
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/[0.08]" />
              <DropdownMenuItem
                onClick={() => {
                  setFilterSide("all");
                  setFilterStatus("all");
                  setFilterReviewed("all");
                  setQuery("");
                  toast.success("Filters reset to default");
                }}
                className="text-xs text-[#a2a2a0] hover:text-white"
              >
                <RotateCcw className="mr-2 size-3.5" />
                Reset all filters
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Trade journal table section */}
      <section className="relative overflow-hidden rounded-xl border border-white/[0.09] bg-[#0a0a0a]/85">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e50914]/60 to-transparent" />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] table-fixed text-[13px]">
            <colgroup>
              {visibleColumns.time && <col style={{ width: "128px" }} />}
              {visibleColumns.symbol && <col style={{ width: "76px" }} />}
              {visibleColumns.side && <col style={{ width: "58px" }} />}
              {visibleColumns.status && <col style={{ width: "88px" }} />}
              {visibleColumns.lots && <col style={{ width: "56px" }} />}
              {visibleColumns.entry && <col style={{ width: "84px" }} />}
              {visibleColumns.exit && <col style={{ width: "84px" }} />}
              {visibleColumns.netPnl && <col style={{ width: "96px" }} />}
              {visibleColumns.rMultiple && <col style={{ width: "66px" }} />}
              {visibleColumns.playbook && <col />}
              {visibleColumns.tags && <col style={{ width: "120px" }} />}
              {visibleColumns.reviewed && <col style={{ width: "70px" }} />}
            </colgroup>
            <thead>
              <tr className="h-9 border-b border-white/[0.07] text-left text-[10px] font-semibold tracking-[0.12em] text-[#a2a2a0] uppercase">
                {visibleColumns.time && (
                  <th className="px-3 font-semibold">
                    <button
                      type="button"
                      onClick={() => setSortDirection((d) => (d === "desc" ? "asc" : "desc"))}
                      className="inline-flex items-center gap-1 text-white hover:text-[#e50914]"
                    >
                      Open (ET)
                      {sortDirection === "desc" ? (
                        <ArrowDown className="size-3 text-[#e50914]" />
                      ) : (
                        <ArrowUp className="size-3 text-[#e50914]" />
                      )}
                    </button>
                  </th>
                )}
                {visibleColumns.symbol && <th className="px-3 font-semibold">Symbol</th>}
                {visibleColumns.side && <th className="px-3 font-semibold">Side</th>}
                {visibleColumns.status && <th className="px-3 font-semibold">Status</th>}
                {visibleColumns.lots && <th className="px-3 text-right font-semibold">Lots</th>}
                {visibleColumns.entry && <th className="px-3 text-right font-semibold">Entry</th>}
                {visibleColumns.exit && <th className="px-3 text-right font-semibold">Exit</th>}
                {visibleColumns.netPnl && <th className="px-3 text-right font-semibold">Net P&amp;L</th>}
                {visibleColumns.rMultiple && <th className="px-3 text-right font-semibold">R</th>}
                {visibleColumns.playbook && <th className="px-3 font-semibold">Playbook</th>}
                {visibleColumns.tags && <th className="px-3 font-semibold">Tags</th>}
                {visibleColumns.reviewed && <th className="px-3 text-center font-semibold">Reviewed</th>}
              </tr>
            </thead>
            <tbody className="[&>tr]:h-10 [&>tr]:border-b [&>tr]:border-white/[0.05]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={totalVisibleCols || 12} className="py-12 text-center text-sm text-[#a2a2a0]">
                    {trades.length === 0 ? "No trades recorded yet. Click 'Log trade' to add one." : "No trades match these filters."}
                  </td>
                </tr>
              ) : (
                rows.map((trade: Trade) => {
                  const inst = instrumentOf(data, trade.market);
                  const pnl = tradeDollarPnl(trade, inst);
                  const isSelected = trade.id === selectedTradeId;
                  const code = getModelCode(trade);
                  const tagLabel = trade.tags?.[0] || trade.setupTags?.[0] || trade.killZone || "";
                  const hasWarningTag =
                    (trade.mistakeTags && trade.mistakeTags.length > 0) ||
                    (trade.tags || []).some((t: string) => t.toLowerCase().includes("outside") || t.toLowerCase().includes("early") || t.toLowerCase().includes("late"));

                  return (
                    <tr
                      key={trade.id}
                      onClick={() => onSelectTrade(isSelected ? null : trade)}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-white/[0.04]",
                        isSelected && "bg-white/[0.05] shadow-[inset_2px_0_0_#e50914]",
                      )}
                    >
                      {/* Open (ET) */}
                      {visibleColumns.time && (
                        <td className="font-mono px-3 text-[12px] text-[#d6d6d4]">
                          {formatOpenTime(trade)}
                        </td>
                      )}

                      {/* Symbol */}
                      {visibleColumns.symbol && (
                        <td className="px-3 font-semibold text-white">{trade.market}</td>
                      )}

                      {/* Side */}
                      {visibleColumns.side && (
                        <td className="px-3 capitalize text-[#d6d6d4]">{trade.side}</td>
                      )}

                      {/* Status */}
                      {visibleColumns.status && (
                        <td className="px-3">
                          <span
                            className={cn(
                              "rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.08em] uppercase",
                              trade.result === "win"
                                ? "border border-[#3ddc84]/30 bg-[#3ddc84]/10 text-[#3ddc84]"
                                : trade.result === "loss"
                                  ? "border border-[#ff6b7d]/30 bg-[#ff6b7d]/10 text-[#ff6b7d]"
                                  : trade.result === "be"
                                    ? "whitespace-nowrap border border-white/[0.14] bg-white/[0.05] text-[#d6d6d4]"
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
                        </td>
                      )}

                      {/* Lots */}
                      {visibleColumns.lots && (
                        <td className="font-mono px-3 text-right text-white">
                          {trade.lots != null ? trade.lots.toFixed(2) : "—"}
                        </td>
                      )}

                      {/* Entry */}
                      {visibleColumns.entry && (
                        <td className="font-mono px-3 text-right text-white">
                          {trade.entry != null ? trade.entry.toFixed(inst?.digits ?? 2) : "—"}
                        </td>
                      )}

                      {/* Exit */}
                      {visibleColumns.exit && (
                        <td className="font-mono px-3 text-right text-white">
                          {trade.exitPrice != null ? trade.exitPrice.toFixed(inst?.digits ?? 2) : "—"}
                        </td>
                      )}

                      {/* Net P&L */}
                      {visibleColumns.netPnl && (
                        <td
                          className={cn(
                            "font-mono px-3 text-right font-medium",
                            pnl.net == null
                              ? "text-[#6f6f6d]"
                              : pnl.net >= 0
                                ? "text-[#3ddc84]"
                                : "text-[#ff6b7d]",
                          )}
                        >
                          {fmtCurrency(pnl.net)}
                        </td>
                      )}

                      {/* R */}
                      {visibleColumns.rMultiple && (
                        <td
                          className={cn(
                            "font-mono px-3 text-right",
                            trade.rMultiple == null
                              ? "text-[#6f6f6d]"
                              : trade.rMultiple >= 0
                                ? "text-[#3ddc84]"
                                : "text-[#ff6b7d]",
                          )}
                        >
                          {trade.rMultiple != null ? formatR(trade.rMultiple) : "—"}
                        </td>
                      )}

                      {/* Playbook */}
                      {visibleColumns.playbook && (
                        <td className="truncate px-3 text-white">
                          <span className="font-mono mr-1.5 inline-block text-[11px] text-[#a2a2a0]">
                            {code}
                          </span>
                          <span>{trade.modelName || "Continuation"}</span>
                        </td>
                      )}

                      {/* Tags */}
                      {visibleColumns.tags && (
                        <td className="truncate px-3 text-[12px]">
                          <span className={cn(hasWarningTag ? "text-[#f5b942]" : "text-[#a2a2a0]")}>
                            {tagLabel || "—"}
                          </span>
                        </td>
                      )}

                      {/* Reviewed */}
                      {visibleColumns.reviewed && (
                        <td className="px-3 text-center">
                          {trade.reviewed ? (
                            <Check className="mx-auto size-3.5 text-[#3ddc84]" />
                          ) : (
                            <span className="text-[#6f6f6d]">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer with summary */}
        <div className="flex h-10 items-center justify-between border-t border-white/[0.07] px-3 text-[12px] text-[#a2a2a0]">
          <div>
            <span className="font-mono text-[#d6d6d4]">{trades.length}</span> trades ·{" "}
            <span className="font-mono text-[#d6d6d4]">{totalClosed.length}</span> closed · Net P&amp;L{" "}
            <span className={cn("font-mono font-medium", totalNetPnL >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]")}>
              {fmtCurrency(totalNetPnL)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono">
              {filtered.length === 0 ? "0–0 of 0" : `${startIndex + 1}–${Math.min(startIndex + pageSize, filtered.length)} of ${filtered.length}`}
            </span>
            <div className="flex gap-1 text-[14px]">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
                className="rounded p-1 text-[#a2a2a0] transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-30"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
                className="rounded p-1 text-[#a2a2a0] transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-30"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
