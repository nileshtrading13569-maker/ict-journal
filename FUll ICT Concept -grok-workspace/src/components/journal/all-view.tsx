import { useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { useDeskStore } from "@/lib/ict-store";
import { formatKPIR } from "@/lib/ict-stats";
import {
  calculateTradeRuleAdherence,
  formatCurrency,
  getTradeHoldDuration,
  getTradePnL,
} from "@/lib/tradezella-helpers";
import { paginateJournalRows } from "@/lib/journal-pagination";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SetupModel, Trade } from "@/lib/ict-types";

export const JOURNAL_TABLE_COLUMNS = [
  "checkbox",
  "open_time",
  "symbol",
  "side",
  "status",
  "lots",
  "entry",
  "exit",
  "net_pnl",
  "realized_r",
  "playbook",
  "tags",
  "rules",
  "grade",
  "reviewed",
] as const;

export function formatPrice(price: number, market?: string): string {
  const m = (market || "").toUpperCase();
  const isForex =
    (/^(EUR|GBP|USD|AUD|NZD|CAD|CHF)/.test(m) && !m.includes("BTC") && !m.includes("ETH")) ||
    m.includes("EURUSD");
  const isJpy = m.includes("JPY");
  const digits = isForex ? (isJpy ? 3 : 5) : 2;
  return price.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatOpenDateTime(dateStr: string, timeStr?: string): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  const mm = parts[1] || "";
  const dd = parts[2] || "";
  const time = timeStr ? timeStr.slice(0, 5) : "00:00";
  return mm && dd ? `${mm}/${dd} ${time}` : `${dateStr} ${time}`;
}

export function isMistakeTag(tag: string): boolean {
  const t = tag.toLowerCase();
  return (
    t.includes("late") ||
    t.includes("chase") ||
    t.includes("early") ||
    t.includes("fomo") ||
    t.includes("outside") ||
    t.includes("impulse") ||
    t.includes("revenge") ||
    t.includes("greed") ||
    t.includes("fear") ||
    t.includes("hesitat") ||
    t.includes("overleverag") ||
    t.includes("mistake")
  );
}

export function getPlaybookLetter(trade: Trade, models: SetupModel[] = []): string {
  const m = models.find(
    (mod) => mod.id === trade.modelId || mod.name.toLowerCase() === trade.modelName?.toLowerCase(),
  );
  if (m?.code) return m.code.toUpperCase();
  const name = (trade.modelName || "").toLowerCase();
  if (name.includes("raid")) return "A";
  if (name.includes("soup")) return "B";
  if (name.includes("judas")) return "C";
  if (name.includes("fvg")) return "B";
  if (name.includes("breaker")) return "A";
  return "A";
}

export interface AllViewProps {
  trades: Trade[];
  selectedTradeId: string | null;
  onSelectTrade: (trade: Trade | null) => void;
  onEditTrade: (trade: Trade) => void;
  onLogTrade?: () => void;
}

export function AllView({
  trades,
  selectedTradeId,
  onSelectTrade,
}: AllViewProps) {
  const models = useDeskStore((s) => s.models);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRangeKey, setSelectedRangeKey] = useState<string>("oct_2026");
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6; // Matching screenshot 2: 6 trades per page

  // Label for Date Range Selector button
  const dateRangeLabel = useMemo(() => {
    switch (selectedRangeKey) {
      case "oct_2026":
        return "Oct 1 – Oct 29, 2026";
      case "all":
        return "All Logged Dates";
      case "last_7":
        return "Last 7 Days";
      case "last_30":
        return "Last 30 Days";
      default:
        return "Oct 1 – Oct 29, 2026";
    }
  }, [selectedRangeKey]);

  // Filter trades by search query and date range
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchSymbol = t.market.toLowerCase().includes(q);
        const matchPlaybook = (t.modelName || "").toLowerCase().includes(q);
        const matchTags = (t.tags || []).some((tag) => tag.toLowerCase().includes(q));
        const matchSetupTags = (t.setupTags || []).some((tag) => tag.toLowerCase().includes(q));
        const matchMistakeTags = (t.mistakeTags || []).some((tag) => tag.toLowerCase().includes(q));
        const matchNotes = (t.notes || "").toLowerCase().includes(q);

        if (
          !matchSymbol &&
          !matchPlaybook &&
          !matchTags &&
          !matchSetupTags &&
          !matchMistakeTags &&
          !matchNotes
        ) {
          return false;
        }
      }

      // 2. Date Range Filter
      if (selectedRangeKey === "oct_2026") {
        if (t.date && (t.date < "2026-10-01" || t.date > "2026-10-31")) {
          return false;
        }
      } else if (selectedRangeKey === "last_7") {
        const now = new Date("2026-10-29T23:59:59Z").getTime();
        const tradeTime = new Date(`${t.date}T12:00:00Z`).getTime();
        if (now - tradeTime > 7 * 86400000 || tradeTime > now) {
          return false;
        }
      } else if (selectedRangeKey === "last_30") {
        const now = new Date("2026-10-29T23:59:59Z").getTime();
        const tradeTime = new Date(`${t.date}T12:00:00Z`).getTime();
        if (now - tradeTime > 30 * 86400000 || tradeTime > now) {
          return false;
        }
      }

      return true;
    });
  }, [trades, searchQuery, selectedRangeKey]);

  // Sort trades descending by date/time
  const sortedTrades = useMemo(() => {
    return filteredTrades.slice().sort((a, b) => {
      const timeA = `${a.date}T${a.time || "00:00"}`;
      const timeB = `${b.date}T${b.time || "00:00"}`;
      return timeB.localeCompare(timeA);
    });
  }, [filteredTrades]);

  // Pagination (6 items per page)
  const { rows, totalPages, page, startIndex } = useMemo(() => {
    return paginateJournalRows(sortedTrades, currentPage, pageSize);
  }, [sortedTrades, currentPage, pageSize]);

  // Master checkbox selection helpers
  const currentPageIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const isAllCurrentSelected =
    currentPageIds.length > 0 && currentPageIds.every((id) => selectedRowIds.has(id));

  const toggleSelectAll = () => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (isAllCurrentSelected) {
        for (const id of currentPageIds) next.delete(id);
      } else {
        for (const id of currentPageIds) next.add(id);
      }
      return next;
    });
  };

  const toggleRowSelect = (id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div data-testid="journal-all-view" className="space-y-3">
      {/* Filter Toolbar: Search Bar + Date Range Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Instant Search Bar */}
          <div className="flex h-10 w-80 items-center gap-2 rounded-lg border border-neutral-800/80 bg-[#141416] px-3 text-sm text-white">
            <Search className="size-4 text-[#71717a] shrink-0" />
            <input
              type="text"
              placeholder="Search symbol, playbook, tag, notes..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-transparent text-sm placeholder-[#71717a] outline-none"
            />
          </div>

          {/* Date Range Selector Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-10 items-center gap-2 rounded-lg border border-neutral-800/80 bg-[#141416] px-3.5 text-xs sm:text-sm font-medium text-neutral-200 transition-colors hover:border-neutral-700 hover:text-white cursor-pointer"
              >
                <CalendarIcon className="size-4 text-neutral-400 shrink-0" />
                <span>{dateRangeLabel}</span>
                <ChevronDown className="size-3.5 text-neutral-400 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 border-white/[0.1] bg-[#121212] text-white">
              <DropdownMenuItem
                onClick={() => {
                  setSelectedRangeKey("oct_2026");
                  setCurrentPage(1);
                }}
                className={cn(
                  "cursor-pointer text-xs",
                  selectedRangeKey === "oct_2026" && "font-semibold text-white",
                )}
              >
                Oct 1 – Oct 29, 2026 (Active)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedRangeKey("all");
                  setCurrentPage(1);
                }}
                className={cn(
                  "cursor-pointer text-xs",
                  selectedRangeKey === "all" && "font-semibold text-white",
                )}
              >
                All Logged Dates
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedRangeKey("last_7");
                  setCurrentPage(1);
                }}
                className={cn(
                  "cursor-pointer text-xs",
                  selectedRangeKey === "last_7" && "font-semibold text-white",
                )}
              >
                Last 7 Days
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedRangeKey("last_30");
                  setCurrentPage(1);
                }}
                className={cn(
                  "cursor-pointer text-xs",
                  selectedRangeKey === "last_30" && "font-semibold text-white",
                )}
              >
                Last 30 Days
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 15-Column Table Section */}
      <section className="relative overflow-hidden rounded-xl border border-neutral-800/80 bg-[#0c0c0e]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1024px] table-fixed text-[13px]">
            <colgroup>
              {/* 1. Checkbox */}
              <col style={{ width: "42px" }} />
              {/* 2. OPEN (ET) */}
              <col style={{ width: "115px" }} />
              {/* 3. SYMBOL */}
              <col style={{ width: "80px" }} />
              {/* 4. SIDE */}
              <col style={{ width: "74px" }} />
              {/* 5. STATUS */}
              <col style={{ width: "76px" }} />
              {/* 6. LOTS */}
              <col style={{ width: "56px" }} />
              {/* 7. ENTRY */}
              <col style={{ width: "84px" }} />
              {/* 8. EXIT */}
              <col style={{ width: "84px" }} />
              {/* 9. NET P&L */}
              <col style={{ width: "95px" }} />
              {/* 10. REALIZED R */}
              <col style={{ width: "84px" }} />
              {/* 11. PLAYBOOK */}
              <col style={{ width: "155px" }} />
              {/* 12. TAGS */}
              <col style={{ width: "140px" }} />
              {/* 13. RULES */}
              <col style={{ width: "68px" }} />
              {/* 14. GRADE */}
              <col style={{ width: "65px" }} />
              {/* 15. REV */}
              <col style={{ width: "52px" }} />
            </colgroup>

            {/* Header Row (15 Columns) */}
            <thead>
              <tr className="h-10 border-b border-white/[0.07] bg-[#101012] text-left text-[10px] font-semibold tracking-[0.12em] text-[#71717a] uppercase">
                {/* 1. Master Checkbox */}
                <th className="px-3 text-center">
                  <div
                    onClick={toggleSelectAll}
                    role="checkbox"
                    aria-checked={isAllCurrentSelected}
                    aria-label="Select all trades"
                    className={cn(
                      "mx-auto flex size-4 items-center justify-center rounded border transition-colors cursor-pointer",
                      isAllCurrentSelected
                        ? "border-[#e50914] bg-[#e50914] text-white"
                        : "border-neutral-700 bg-neutral-900/80 hover:border-neutral-500",
                    )}
                  >
                    {isAllCurrentSelected && <Check className="size-3 stroke-[3]" />}
                  </div>
                </th>
                {/* 2. OPEN (ET) */}
                <th className="px-3 font-semibold">OPEN (ET)</th>
                {/* 3. SYMBOL */}
                <th className="px-3 font-semibold">SYMBOL</th>
                {/* 4. SIDE */}
                <th className="px-3 font-semibold">SIDE</th>
                {/* 5. STATUS */}
                <th className="px-3 font-semibold">STATUS</th>
                {/* 6. LOTS */}
                <th className="px-3 text-right font-semibold">LOTS</th>
                {/* 7. ENTRY */}
                <th className="px-3 text-right font-semibold">ENTRY</th>
                {/* 8. EXIT */}
                <th className="px-3 text-right font-semibold">EXIT</th>
                {/* 9. NET P&L */}
                <th className="px-3 text-right font-semibold">NET P&amp;L</th>
                {/* 10. REALIZED R */}
                <th className="px-3 text-right font-semibold">REALIZED R</th>
                {/* 11. PLAYBOOK */}
                <th className="px-3 font-semibold">PLAYBOOK</th>
                {/* 12. TAGS */}
                <th className="px-3 font-semibold">TAGS</th>
                {/* 13. RULES */}
                <th className="px-3 text-center font-semibold">RULES</th>
                {/* 14. GRADE */}
                <th className="px-3 text-center font-semibold">GRADE</th>
                {/* 15. REV */}
                <th className="px-3 text-center font-semibold">REV</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-14 text-center text-sm text-[#71717a]">
                    {trades.length === 0
                      ? "No trades recorded yet. Click '+ Log trade' to add your first execution."
                      : "No trades match the current search or date filter."}
                  </td>
                </tr>
              ) : (
                rows.map((trade: Trade) => {
                  const isSelected = trade.id === selectedTradeId;
                  const isChecked = isSelected || selectedRowIds.has(trade.id);
                  const pnl = getTradePnL(trade);
                  const holdDuration = getTradeHoldDuration(trade, true);
                  const model = models.find(
                    (m) =>
                      m.id === trade.modelId ||
                      m.name.toLowerCase() === trade.modelName?.toLowerCase(),
                  );
                  const letterCode = getPlaybookLetter(trade, models);
                  const adherence = calculateTradeRuleAdherence(trade, model);

                  // Extract tags: combine setupTags, mistakeTags, tags, session
                  const setupTags = trade.setupTags || trade.tags || [];
                  const mistakeTags = trade.mistakeTags || [];
                  const allTagPills: { label: string; isMistake: boolean }[] = [];

                  for (const st of setupTags) {
                    if (st) {
                      allTagPills.push({ label: st, isMistake: isMistakeTag(st) });
                    }
                  }
                  for (const mt of mistakeTags) {
                    if (mt && !allTagPills.some((p) => p.label === mt)) {
                      allTagPills.push({ label: mt, isMistake: true });
                    }
                  }
                  if (allTagPills.length === 0 && trade.session) {
                    allTagPills.push({ label: trade.session, isMistake: false });
                  }

                  return (
                    <tr
                      key={trade.id}
                      data-testid={`trade-row-${trade.id}`}
                      onClick={() => onSelectTrade(isSelected ? null : trade)}
                      className={cn(
                        "group h-12 cursor-pointer border-b border-white/[0.05] transition-colors",
                        isSelected
                          ? "border-l-4 border-l-[#e50914] bg-[#e50914]/5"
                          : "border-l-4 border-l-transparent hover:bg-white/[0.03]",
                      )}
                    >
                      {/* 1. Checkbox */}
                      <td
                        className="px-3 text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRowSelect(trade.id);
                        }}
                      >
                        <div
                          role="checkbox"
                          aria-checked={isChecked}
                          aria-label={`Select trade ${trade.market} ${trade.date}`}
                          className={cn(
                            "mx-auto flex size-4 items-center justify-center rounded border transition-colors cursor-pointer",
                            isChecked
                              ? "border-[#e50914] bg-[#e50914] text-white"
                              : "border-neutral-700 bg-neutral-900/80 hover:border-neutral-500",
                          )}
                        >
                          {isChecked && <Check className="size-3 stroke-[3]" />}
                        </div>
                      </td>

                      {/* 2. OPEN (ET): 2 lines (date/time + duration) */}
                      <td className="px-3 font-mono leading-tight">
                        <div className="text-[12px] font-medium text-white">
                          {formatOpenDateTime(trade.date, trade.time)}
                        </div>
                        <div className="text-[11px] text-[#71717a]">{holdDuration}</div>
                      </td>

                      {/* 3. SYMBOL */}
                      <td className="px-3">
                        <span className="inline-flex items-center justify-center rounded border border-neutral-800 bg-[#18181b] px-2 py-0.5 font-mono text-[11px] font-semibold text-white">
                          {trade.market}
                        </span>
                      </td>

                      {/* 4. SIDE */}
                      <td className="px-3">
                        <span
                          className={cn(
                            "inline-block rounded-full px-2 py-0.5 text-center text-[10px] font-semibold tracking-wider uppercase",
                            trade.side === "long"
                              ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                              : "border border-red-500/30 bg-red-500/10 text-red-400",
                          )}
                        >
                          {trade.side.toUpperCase()}
                        </span>
                      </td>

                      {/* 5. STATUS */}
                      <td className="px-3">
                        <span
                          className={cn(
                            "inline-block rounded-full px-2 py-0.5 text-center text-[10px] font-semibold tracking-wider uppercase",
                            trade.result === "win"
                              ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                              : trade.result === "loss"
                                ? "border border-red-500/30 bg-red-500/10 text-red-400"
                                : trade.result === "be"
                                  ? "border border-neutral-700 bg-neutral-800 text-neutral-300"
                                  : "border border-amber-500/30 bg-amber-500/10 text-amber-400",
                          )}
                        >
                          {trade.result === "win"
                            ? "WIN"
                            : trade.result === "loss"
                              ? "LOSS"
                              : trade.result === "be"
                                ? "BE"
                                : "OPEN"}
                        </span>
                      </td>

                      {/* 6. LOTS */}
                      <td className="px-3 text-right font-mono text-[12px] text-white">
                        {trade.lots != null ? trade.lots.toFixed(2) : "—"}
                      </td>

                      {/* 7. ENTRY */}
                      <td className="px-3 text-right font-mono text-[12px] text-neutral-200">
                        {trade.entry != null ? formatPrice(trade.entry, trade.market) : "—"}
                      </td>

                      {/* 8. EXIT */}
                      <td className="px-3 text-right font-mono text-[12px] text-neutral-200">
                        {trade.exitPrice != null ? formatPrice(trade.exitPrice, trade.market) : "—"}
                      </td>

                      {/* 9. NET P&L */}
                      <td className="px-3 text-right font-mono text-[12px] font-medium">
                        <span
                          className={cn(
                            pnl > 0
                              ? "text-emerald-400"
                              : pnl < 0
                                ? "text-red-400"
                                : "text-neutral-400",
                          )}
                        >
                          {formatCurrency(pnl)}
                        </span>
                      </td>

                      {/* 10. REALIZED R */}
                      <td className="px-3 text-right font-mono text-[12px]">
                        <span
                          className={cn(
                            trade.rMultiple != null && trade.rMultiple > 0
                              ? "text-emerald-400"
                              : trade.rMultiple != null && trade.rMultiple < 0
                                ? "text-red-400"
                                : "text-neutral-400",
                          )}
                        >
                          {trade.rMultiple != null ? formatKPIR(trade.rMultiple) : "—"}
                        </span>
                      </td>

                      {/* 11. PLAYBOOK */}
                      <td className="px-3">
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className={cn(
                              "flex size-5 shrink-0 items-center justify-center rounded font-mono text-[10px] font-bold",
                              letterCode === "A"
                                ? "bg-[#e50914] text-white"
                                : "bg-neutral-800 text-neutral-300",
                            )}
                          >
                            {letterCode}
                          </span>
                          <span className="truncate text-[12px] font-medium text-white">
                            {trade.modelName || "Standard Setup"}
                          </span>
                        </div>
                      </td>

                      {/* 12. TAGS */}
                      <td className="px-3">
                        <div className="flex max-w-[140px] flex-wrap items-center gap-1 overflow-hidden">
                          {allTagPills.length > 0 ? (
                            allTagPills.slice(0, 2).map((tag, idx) => (
                              <span
                                key={idx}
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap",
                                  tag.isMistake
                                    ? "border border-amber-500/40 bg-amber-500/10 text-amber-400"
                                    : "border border-neutral-800 bg-neutral-900 text-neutral-300",
                                )}
                              >
                                {tag.label}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-[#71717a]">—</span>
                          )}
                        </div>
                      </td>

                      {/* 13. RULES */}
                      <td className="px-3 text-center font-mono text-[12px] font-medium">
                        <span
                          className={cn(
                            adherence.adherencePct >= 80
                              ? "text-emerald-400"
                              : adherence.adherencePct >= 60
                                ? "text-amber-400"
                                : "text-red-400",
                          )}
                        >
                          {adherence.ratio}
                        </span>
                      </td>

                      {/* 14. GRADE */}
                      <td className="px-3 text-center">
                        {trade.grade ? (
                          <span
                            className={cn(
                              "inline-block rounded px-2 py-0.5 text-center text-xs font-bold",
                              trade.grade === "A"
                                ? "bg-[#e50914] text-white"
                                : "border border-neutral-800 bg-[#18181b] text-neutral-200",
                            )}
                          >
                            {trade.grade}
                          </span>
                        ) : (
                          <span className="text-neutral-600">—</span>
                        )}
                      </td>

                      {/* 15. REV */}
                      <td className="px-3 text-center">
                        {trade.reviewed ? (
                          <CheckCircle2 className="mx-auto size-4 text-emerald-400" />
                        ) : (
                          <span className="text-neutral-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex h-11 items-center justify-between border-t border-white/[0.07] bg-[#101012] px-4 text-xs text-[#71717a]">
          <div className="font-mono">
            {filteredTrades.length === 0 ? (
              <span>Showing 0–0 of 0 logged trades</span>
            ) : (
              <span>
                Showing {startIndex + 1}–{Math.min(startIndex + pageSize, filteredTrades.length)} of{" "}
                {filteredTrades.length} logged trades
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="rounded px-2.5 py-1 text-xs font-medium text-neutral-300 transition-colors hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
            >
              Prev
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
              <button
                key={pNum}
                type="button"
                onClick={() => setCurrentPage(pNum)}
                className={cn(
                  "flex size-7 items-center justify-center rounded font-mono text-xs font-medium transition-colors cursor-pointer",
                  pNum === page
                    ? "bg-neutral-800 text-white font-bold"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800/60",
                )}
              >
                {pNum}
              </button>
            ))}

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="rounded px-2.5 py-1 text-xs font-medium text-neutral-300 transition-colors hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
