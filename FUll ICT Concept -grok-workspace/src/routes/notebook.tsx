import { useState, useMemo, useEffect, useRef } from "react";
import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Folder,
  FolderPlus,
  Hash,
  LayoutDashboard,
  MoreHorizontal,
  Pin,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDeskStore } from "@/lib/ict-store";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { fmtCurrency, tradeDollarPnl } from "@/lib/ict-calc";
import type { Trade } from "@/lib/ict-types";
import {
  DEFAULT_FOLDERS,
  SEED_NOTES,
  type NotebookEntry,
} from "@/lib/notebook-defaults";
import { loadNotebookState, saveNotebookState } from "@/lib/notebook-sync";
import {
  buildDailyJournalEntryFromTrades,
  computeNotebookDayMetrics,
  formatTradeMarkdownBlock,
  mergeJournalDatesIntoNotes,
  resolveTradeInstrument,
} from "@/lib/notebook-journal-sync";
import {
  notebookContentToPlainText,
  richHtmlToMarkdown,
} from "@/lib/notebook-rich-text";
import {
  RichNoteEditor,
  type RichNoteEditorHandle,
} from "@/components/notebook/rich-note-editor";

export type { NotebookEntry };

export const Route = createFileRoute("/notebook")({ component: NotebookPage });

interface IntradayEquityPoint {
  index: number;
  label: string;
  time: string;
  tradePnl: number;
  cumulativePnl: number;
  x: number;
  y: number;
}

interface IntradayEquityCurveProps {
  metrics: {
    netPnl: number;
    grossPnl?: number;
    commissions?: number;
    winrate?: number;
    totalTrades?: number;
    hasLiveTrades?: boolean;
    trades?: Trade[];
  } | null;
}

function IntradayEquityCurve({ metrics }: IntradayEquityCurveProps) {
  const instruments = useDeskStore((s) => s.instruments);
  const [hoveredPoint, setHoveredPoint] = useState<IntradayEquityPoint | null>(null);

  const { points, yZero, isProfit, topTick, midTick, botTick, gradId } = useMemo(() => {
    const net = metrics?.netPnl ?? 0;
    const isPos = net >= 0;
    const gId = `intradayGrad-${Math.abs(Math.round(net))}-${metrics?.totalTrades ?? 0}`;

    interface RawItem {
      label: string;
      time: string;
      tradePnl: number;
      cumulativePnl: number;
    }

    let raw: RawItem[] = [];

    if (metrics?.hasLiveTrades && metrics.trades && metrics.trades.length > 0) {
      const sorted = [...metrics.trades]
        .filter((t) => t.result !== "open")
        .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
      raw.push({ label: "Day Open", time: "00:00", tradePnl: 0, cumulativePnl: 0 });
      let cum = 0;
      sorted.forEach((t, i) => {
        const pnl = tradeDollarPnl(t, resolveTradeInstrument(instruments, t.market)).net ?? 0;
        cum = Number((cum + pnl).toFixed(2));
        raw.push({
          label: `Trade #${i + 1} (${t.market || "Exec"})`,
          time: t.time || `T+${i + 1}`,
          tradePnl: pnl,
          cumulativePnl: cum,
        });
      });
      if (sorted.length === 0) {
        raw.push({ label: "Open Executions", time: "Live", tradePnl: 0, cumulativePnl: 0 });
      }
    } else if (metrics && metrics.totalTrades && metrics.totalTrades > 0) {
      // Manual or seed metrics
      raw.push({ label: "Day Open", time: "09:30", tradePnl: 0, cumulativePnl: 0 });
      const count = metrics.totalTrades;
      const gross = metrics.grossPnl ?? net;
      if (count === 2 && (metrics as any).winners === 1 && (metrics as any).losers === 1) {
        raw.push({
          label: "Trade #1 (Win)",
          time: "09:48",
          tradePnl: gross,
          cumulativePnl: gross,
        });
        raw.push({
          label: "Trade #2 (Loss)",
          time: "10:45",
          tradePnl: Number((net - gross).toFixed(2)),
          cumulativePnl: net,
        });
      } else if (count === 1) {
        raw.push({
          label: "Trade #1",
          time: "10:00",
          tradePnl: net,
          cumulativePnl: net,
        });
      } else {
        const step = Number((net / count).toFixed(2));
        let running = 0;
        for (let i = 1; i <= count; i++) {
          const delta = i === count ? Number((net - running).toFixed(2)) : step;
          running = Number((running + delta).toFixed(2));
          raw.push({
            label: `Trade #${i}`,
            time: `T+${i}`,
            tradePnl: delta,
            cumulativePnl: running,
          });
        }
      }
    } else {
      raw = [
        { label: "Day Open", time: "09:30", tradePnl: 0, cumulativePnl: 0 },
        { label: "Day Close", time: "16:00", tradePnl: 0, cumulativePnl: 0 },
      ];
    }

    const values = raw.map((r) => r.cumulativePnl);
    let minP = Math.min(0, ...values);
    let maxP = Math.max(0, ...values);

    if (minP === 0 && maxP === 0) {
      maxP = 100;
    }
    const span = maxP - minP || 100;
    const paddingHead = span * 0.12;
    const effMin = minP < 0 ? minP - paddingHead : 0;
    const effMax = maxP > 0 ? maxP + paddingHead : 100;
    const effSpan = effMax - effMin;

    const left = 45;
    const right = 308;
    const top = 14;
    const bottom = 86;
    const w = right - left;
    const h = bottom - top;

    const calculatedPoints: IntradayEquityPoint[] = raw.map((r, i) => {
      const x = raw.length > 1 ? left + (i / (raw.length - 1)) * w : left + w / 2;
      const y = bottom - ((r.cumulativePnl - effMin) / effSpan) * h;
      return {
        index: i,
        label: r.label,
        time: r.time,
        tradePnl: r.tradePnl,
        cumulativePnl: r.cumulativePnl,
        x: Number(x.toFixed(1)),
        y: Number(y.toFixed(1)),
      };
    });

    const calculatedYZero = Number((bottom - ((0 - effMin) / effSpan) * h).toFixed(1));

    return {
      points: calculatedPoints,
      yZero: calculatedYZero,
      isProfit: isPos,
      topTick: fmtCurrency(maxP > 0 ? maxP : 100, false),
      midTick: fmtCurrency((maxP + minP) / 2, false),
      botTick: fmtCurrency(minP < 0 ? minP : 0, false),
      gradId: gId,
    };
  }, [metrics, instruments]);

  const linePath = useMemo(() => {
    if (points.length === 0) return "";
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return "";
    return `${linePath} L ${points[points.length - 1].x} ${yZero} L ${points[0].x} ${yZero} Z`;
  }, [linePath, points, yZero]);

  const strokeColor = isProfit ? "#3ddc84" : "#ff6b7d";

  return (
    <div className="relative h-24 sm:h-28 w-full select-none">
      <svg viewBox="0 0 320 100" className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.32" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal Ticks & Grid Lines */}
        <line x1="38" y1="14" x2="310" y2="14" stroke="rgba(255,255,255,0.06)" strokeDasharray="2 2" />
        <line x1="38" y1="50" x2="310" y2="50" stroke="rgba(255,255,255,0.06)" strokeDasharray="2 2" />
        <line x1="38" y1={yZero} x2="310" y2={yZero} stroke="rgba(255,255,255,0.12)" />

        <text x="35" y="17" fill="#6f6f6d" fontSize="9" textAnchor="end" fontFamily="monospace">
          {topTick}
        </text>
        <text x="35" y="53" fill="#6f6f6d" fontSize="9" textAnchor="end" fontFamily="monospace">
          {midTick}
        </text>
        <text x="35" y={yZero + 3} fill="#6f6f6d" fontSize="9" textAnchor="end" fontFamily="monospace">
          {botTick}
        </text>

        {/* Filled Gradient Area */}
        {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}

        {/* Dynamic Stroke Line */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Interactive Trade Execution Circles */}
        {points.map((pt) => {
          const isHovered = hoveredPoint?.index === pt.index;
          return (
            <circle
              key={pt.index}
              cx={pt.x}
              cy={pt.y}
              r={isHovered ? 5.5 : pt.index === points.length - 1 ? 4 : 3}
              fill={isHovered || pt.index === points.length - 1 ? strokeColor : "#121215"}
              stroke={strokeColor}
              strokeWidth={isHovered ? 2.5 : 1.8}
              className="cursor-pointer transition-all"
              onMouseEnter={() => setHoveredPoint(pt)}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          );
        })}

        {/* Tooltip on Hover */}
        {hoveredPoint && (
          <g
            transform={`translate(${Math.min(210, Math.max(45, hoveredPoint.x - 48))}, ${Math.max(
              12,
              hoveredPoint.y - 28
            )})`}
          >
            <rect
              width="96"
              height="24"
              rx="4"
              fill="#0d0d10"
              stroke="rgba(255,255,255,0.2)"
              filter="drop-shadow(0 2px 8px rgba(0,0,0,0.8))"
            />
            <text x="48" y="10" textAnchor="middle" fill="#a2a2a0" fontSize="8" fontFamily="sans-serif">
              {hoveredPoint.time} • {hoveredPoint.label}
            </text>
            <text
              x="48"
              y="19"
              textAnchor="middle"
              fill={hoveredPoint.cumulativePnl >= 0 ? "#3ddc84" : "#ff6b7d"}
              fontSize="9"
              fontWeight="600"
              fontFamily="monospace"
            >
              Total: {fmtCurrency(hoveredPoint.cumulativePnl)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

const NOTEBOOK_STORAGE_KEY_V2 = "first-payout-notebook-notes-v2";
const NOTEBOOK_FOLDERS_KEY = "first-payout-notebook-folders-v1";
const NOTEBOOK_STORAGE_KEY_V1 = "first-payout-notebook-notes-v1";
const NOTEBOOK_DISMISSED_DATES_KEY = "first-payout-notebook-dismissed-dates-v1";

function NotebookPage() {
  const deskTrades = useDeskStore((s) => s.trades);
  const deskInstruments = useDeskStore((s) => s.instruments);
  const deskModels = useDeskStore((s) => s.models);
  const deskDailyPlans = useDeskStore((s) => s.dailyPlans);
  const deskHasBootstrapped = useDeskStore((s) => s.hasBootstrapped);
  const accountName = useDeskStore((s) => s.accountName);
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });

  const dailyPlanNotesMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [dateIso, plan] of Object.entries(deskDailyPlans)) {
      if (plan?.notes?.trim()) {
        map[dateIso] = plan.notes;
      }
    }
    return map;
  }, [deskDailyPlans]);

  const requestedDate = useMemo(() => {
    const raw = searchStr || (typeof window !== "undefined" ? window.location.search : "");
    const param = new URLSearchParams(raw).get("date");
    return param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : null;
  }, [searchStr]);

  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? null;
  const userScope = userId ? `user_${userId}` : "guest";

  const getScopedKey = (base: string) => `${base}:${userScope}`;

  const getDismissedDates = (): Set<string> => {
    try {
      const raw = window.localStorage.getItem(getScopedKey(NOTEBOOK_DISMISSED_DATES_KEY));
      const parsed = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  };

  const recordDismissedDates = (datesToAdd: string[]) => {
    if (datesToAdd.length === 0) return;
    try {
      const current = getDismissedDates();
      datesToAdd.forEach((d) => current.add(d));
      window.localStorage.setItem(
        getScopedKey(NOTEBOOK_DISMISSED_DATES_KEY),
        JSON.stringify(Array.from(current)),
      );
    } catch {}
  };

  // Folders state
  const [folders, setFolders] = useState<string[]>([...DEFAULT_FOLDERS]);

  const [activeFolder, setActiveFolder] = useState<string>("Daily Journal");
  const [notes, setNotes] = useState<NotebookEntry[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string>("");
  const [notebookLoaded, setNotebookLoaded] = useState(false);
  const [syncingJournal, setSyncingJournal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => typeof window !== "undefined" && window.innerWidth < 1024);
  const [mobileView, setMobileView] = useState<"list" | "detail" | "folders">("list");
  const [perfCollapsed, setPerfCollapsed] = useState(false);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "pnl" | "title">("newest");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"saved" | "saving" | "local" | "error">("saved");
  const [currentFontSize, setCurrentFontSize] = useState<number>(15);
  const [currentFontFamily, setCurrentFontFamily] = useState<string>("font-sans");
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [activeAccountLabel, setActiveAccountLabel] = useState<string>(accountName || "Demo account");
  const [newTagInput, setNewTagInput] = useState("");

  const richEditorRef = useRef<RichNoteEditorHandle | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const foldersRef = useRef(folders);
  foldersRef.current = folders;
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const handledDeepLinkRef = useRef<string | null>(null);

  // Sync active account label once DeskProvider loads from Neon Postgres
  useEffect(() => {
    if (accountName) {
      setActiveAccountLabel(accountName);
    }
  }, [accountName]);

  // Flush any pending debounced note save cleanly when leaving/unmounting the page
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        if (userIdRef.current) {
          void saveNotebookState({
            data: { folders: foldersRef.current, notes: notesRef.current },
          }).catch(() => undefined);
        }
      }
    };
  }, []);

  // Load and sync folders & notes: full backend database/storage when authenticated, local cache fallback
  useEffect(() => {
    let cancelled = false;

    // While auth status is loading, wait for resolution before loading notes
    if (isPending) return;
    setNotebookLoaded(false);

    const readLocalCache = () => {
      try {
        const storedFolders =
          window.localStorage.getItem(getScopedKey(NOTEBOOK_FOLDERS_KEY)) ??
          (userScope === "guest" ? window.localStorage.getItem(NOTEBOOK_FOLDERS_KEY) : null);
        if (storedFolders) {
          const parsed = JSON.parse(storedFolders);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setFolders(parsed);
          }
        }

        const storedV2 =
          window.localStorage.getItem(getScopedKey(NOTEBOOK_STORAGE_KEY_V2)) ??
          (userScope === "guest" ? window.localStorage.getItem(NOTEBOOK_STORAGE_KEY_V2) : null);
        if (storedV2) {
          const parsed = JSON.parse(storedV2);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setNotes(parsed);
            setSelectedNoteId((curr) => (curr && parsed.some((p: NotebookEntry) => p.id === curr) ? curr : parsed[0].id));
            setNotebookLoaded(true);
            return;
          }
        }

        // Check migration from v1
        const storedV1 =
          window.localStorage.getItem(getScopedKey(NOTEBOOK_STORAGE_KEY_V1)) ??
          (userScope === "guest" ? window.localStorage.getItem(NOTEBOOK_STORAGE_KEY_V1) : null);
        if (storedV1) {
          const parsedV1 = JSON.parse(storedV1);
          if (Array.isArray(parsedV1) && parsedV1.length > 0) {
            const migrated: NotebookEntry[] = parsedV1.map((item: any) => ({
              id: item.id || `migrated-${Date.now()}-${Math.random()}`,
              folder: item.category === "Execution Log" ? "Daily Journal" : "Trade Notes",
              title: item.title || "Untitled Note",
              subDate: item.date || "07/01/2025",
              date: item.date || new Date().toISOString().split("T")[0],
              createdAt: item.updatedAt ? `${item.date || ""} ${item.updatedAt}` : "Earlier",
              updatedAt: item.updatedAt || "Earlier",
              pinned: !!item.pinned,
              tags: Array.isArray(item.tags) ? item.tags : ["Imported"],
              content: item.content || "",
            }));
            const combined = [...migrated, ...SEED_NOTES.filter((s) => !migrated.some((m) => m.id === s.id))];
            setNotes(combined);
            setSelectedNoteId(combined[0].id);
            window.localStorage.setItem(getScopedKey(NOTEBOOK_STORAGE_KEY_V2), JSON.stringify(combined));
            setNotebookLoaded(true);
            return;
          }
        }
      } catch (e) {
        console.error("[notebook] failed to read local cache:", e);
      }
      setNotes(SEED_NOTES);
      setSelectedNoteId(SEED_NOTES[0].id);
      setNotebookLoaded(true);
    };

    if (userId) {
      setAutoSaveStatus("saving");
      void (async () => {
        try {
          const remote = await loadNotebookState();
          if (cancelled) return;
          if (remote && Array.isArray(remote.notes)) {
            const cleanFolders =
              Array.isArray(remote.folders) && remote.folders.length > 0 ? remote.folders : [...DEFAULT_FOLDERS];
            setFolders(cleanFolders);
            setNotes(remote.notes);
            setSelectedNoteId((curr) =>
              curr && remote.notes.some((n) => n.id === curr) ? curr : (remote.notes[0]?.id ?? "")
            );
            try {
              window.localStorage.setItem(getScopedKey(NOTEBOOK_FOLDERS_KEY), JSON.stringify(cleanFolders));
              window.localStorage.setItem(getScopedKey(NOTEBOOK_STORAGE_KEY_V2), JSON.stringify(remote.notes));
            } catch {}
            setAutoSaveStatus("saved");
            setNotebookLoaded(true);
            return;
          }
        } catch (err) {
          if (cancelled) return;
          console.error("[notebook] backend load error, falling back to local cache:", err);
          setAutoSaveStatus("error");
          toast.error("Could not fetch latest notes from cloud. Using local copy.");
        }
        if (!cancelled) {
          readLocalCache();
        }
      })();
    } else {
      readLocalCache();
      setAutoSaveStatus("local");
    }

    return () => {
      cancelled = true;
    };
  }, [userId, userScope, isPending]);

  // Save notes: instant local cache + immediate or debounced backend persistence
  const persistNotes = async (updated: NotebookEntry[], immediate = false) => {
    setNotes(updated);
    notesRef.current = updated;

    // 1. Instant local storage write
    try {
      window.localStorage.setItem(getScopedKey(NOTEBOOK_STORAGE_KEY_V2), JSON.stringify(updated));
    } catch (e) {
      console.error("[notebook] failed to persist notes to localStorage:", e);
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    if (!userId) {
      setAutoSaveStatus("local");
      return;
    }

    setAutoSaveStatus("saving");

    if (immediate) {
      try {
        await saveNotebookState({ data: { folders: foldersRef.current, notes: updated } });
        setAutoSaveStatus("saved");
      } catch (err) {
        console.error("[notebook] failed to persist notes to backend:", err);
        setAutoSaveStatus("error");
        toast.error("Cloud save failed. Check your connection.");
        throw err;
      }
    } else {
      saveTimerRef.current = setTimeout(async () => {
        saveTimerRef.current = null;
        try {
          await saveNotebookState({ data: { folders: foldersRef.current, notes: notesRef.current } });
          setAutoSaveStatus("saved");
        } catch (err) {
          console.error("[notebook] failed to persist notes to backend:", err);
          setAutoSaveStatus("error");
          toast.error("Cloud save failed. Check your connection.");
        }
      }, 400);
    }
  };

  // Auto-sync Journal trade dates into Daily Journal & honor ?date=YYYY-MM-DD deep links
  useEffect(() => {
    if (!notebookLoaded) return;
    if (userId && !deskHasBootstrapped) return;

    const currentNotes = notesRef.current;
    const { nextNotes, addedDates } = mergeJournalDatesIntoNotes(
      currentNotes,
      deskTrades,
      deskInstruments,
      deskModels,
      getDismissedDates(),
      dailyPlanNotesMap,
    );

    if (addedDates.length > 0) {
      void persistNotes(nextNotes, true);
      if (!selectedNoteId || SEED_NOTES.some((s) => s.id === selectedNoteId)) {
        const newestSynced = nextNotes.find((n) => n.date === addedDates[0] && n.folder === "Daily Journal");
        if (newestSynced) {
          setSelectedNoteId(newestSynced.id);
        }
      }
    }

    if (requestedDate && handledDeepLinkRef.current !== requestedDate) {
      handledDeepLinkRef.current = requestedDate;
      const workingNotes = addedDates.length > 0 ? nextNotes : currentNotes;
      const existing =
        workingNotes.find((n) => n.date === requestedDate && n.folder === "Daily Journal") ??
        workingNotes.find((n) => n.date === requestedDate);

      if (existing) {
        setActiveFolder(existing.folder);
        setSelectedNoteId(existing.id);
        setMobileView("detail");
      } else {
        const dayTrades = deskTrades.filter((t) => t.date === requestedDate);
        const created = buildDailyJournalEntryFromTrades(
          requestedDate,
          dayTrades,
          deskInstruments,
          deskModels,
          dailyPlanNotesMap[requestedDate],
        );
        const withCreated = [created, ...workingNotes];
        setActiveFolder("Daily Journal");
        setSelectedNoteId(created.id);
        setMobileView("detail");
        void persistNotes(withCreated, true);
      }
    }
  }, [notebookLoaded, deskHasBootstrapped, deskTrades, dailyPlanNotesMap, requestedDate, userId]);

  const handleManualJournalSync = async () => {
    setSyncingJournal(true);
    try {
      try {
        window.localStorage.removeItem(getScopedKey(NOTEBOOK_DISMISSED_DATES_KEY));
      } catch {}
      const { nextNotes, addedDates } = mergeJournalDatesIntoNotes(
        notesRef.current,
        deskTrades,
        deskInstruments,
        deskModels,
        undefined,
        dailyPlanNotesMap,
      );
      if (addedDates.length > 0) {
        await persistNotes(nextNotes, true);
        const target = nextNotes.find((n) => n.date === addedDates[0] && n.folder === "Daily Journal");
        if (target) {
          setActiveFolder("Daily Journal");
          setSelectedNoteId(target.id);
        }
        toast.success(`Synced ${addedDates.length} trading day${addedDates.length === 1 ? "" : "s"} from Journal DB`);
      } else {
        if (userId) {
          await persistNotes(notesRef.current, true);
        }
        toast.success("Notebook is up to date with Journal database");
      }
    } catch (err) {
      console.error("[notebook] manual journal sync failed:", err);
      toast.error("Failed to sync with Journal database");
    } finally {
      setSyncingJournal(false);
    }
  };

  const persistFolders = async (updatedFolders: string[]) => {
    setFolders(updatedFolders);
    foldersRef.current = updatedFolders;
    try {
      window.localStorage.setItem(getScopedKey(NOTEBOOK_FOLDERS_KEY), JSON.stringify(updatedFolders));
    } catch (e) {
      console.error("[notebook] failed to persist folders:", e);
    }

    if (userId) {
      setAutoSaveStatus("saving");
      try {
        await saveNotebookState({ data: { folders: updatedFolders, notes: notesRef.current } });
        setAutoSaveStatus("saved");
      } catch (err) {
        console.error("[notebook] failed to persist folders to backend:", err);
        setAutoSaveStatus("error");
        toast.error("Failed to sync folders with cloud.");
        throw err;
      }
    }
  };

  // Currently selected note
  const selectedNote = useMemo(() => {
    return notes.find((n) => n.id === selectedNoteId) || notes[0];
  }, [notes, selectedNoteId]);

  // Desk trades metrics for the active note date (identical math to Journal KPIs)
  const liveDayMetrics = useMemo(() => {
    if (!selectedNote) return null;
    return computeNotebookDayMetrics(
      selectedNote.date,
      deskTrades,
      deskInstruments,
      selectedNote.manualMetrics,
    );
  }, [selectedNote, deskTrades, deskInstruments]);

  // Helper to compute metrics for any note (combining live desk trades matching date and manual metrics)
  const getNoteMetrics = (n: NotebookEntry) => {
    const metrics = computeNotebookDayMetrics(n.date, deskTrades, deskInstruments, n.manualMetrics);
    if (!metrics) return null;
    return {
      netPnl: metrics.netPnl,
      totalTrades: metrics.totalTrades,
    };
  };

  // Filtered & sorted notes
  const filteredNotes = useMemo(() => {
    return notes
      .filter((n) => {
        if (activeFolder !== "All notes" && n.folder !== activeFolder) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().replace(/^#/, "");
          const matchTitle = n.title.toLowerCase().includes(q);
          const matchContent = notebookContentToPlainText(n.content).toLowerCase().includes(q);
          const matchTag = n.tags.some((t) => t.toLowerCase().replace(/^#/, "").includes(q));
          if (!matchTitle && !matchContent && !matchTag) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;

        if (sortOrder === "newest") {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
        if (sortOrder === "oldest") {
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        }
        if (sortOrder === "title") {
          return a.title.localeCompare(b.title);
        }
        if (sortOrder === "pnl") {
          const pnlA = getNoteMetrics(a)?.netPnl ?? 0;
          const pnlB = getNoteMetrics(b)?.netPnl ?? 0;
          return pnlB - pnlA;
        }
        return 0;
      });
  }, [notes, activeFolder, searchQuery, sortOrder, deskTrades, deskInstruments]);

  // All distinct tags with count
  const allTagsWithCount = useMemo(() => {
    const map = new Map<string, number>();
    notes.forEach((n) => {
      n.tags.forEach((t) => {
        map.set(t, (map.get(t) || 0) + 1);
      });
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [notes]);

  // Actions
  const handleUpdateNote = (fields: Partial<NotebookEntry>) => {
    if (!selectedNote) return;
    const nowTime = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const updated = notes.map((n) => {
      if (n.id === selectedNote.id) {
        return {
          ...n,
          ...fields,
          updatedAt: nowTime,
        };
      }
      return n;
    });
    void persistNotes(updated, false);
  };

  const handleCreateEntry = async (folderParam?: string) => {
    const targetFolder = folderParam ?? (activeFolder === "All notes" ? "Daily Journal" : activeFolder);
    const today = new Date();
    const isDaily = targetFolder === "Daily Journal";
    const dateStr = today.toISOString().split("T")[0];
    const todaysLiveTrades = isDaily ? deskTrades.filter((t) => t.date === dateStr) : [];

    const newNote: NotebookEntry =
      isDaily && todaysLiveTrades.length > 0
        ? {
            ...buildDailyJournalEntryFromTrades(
              dateStr,
              todaysLiveTrades,
              deskInstruments,
              deskModels,
            ),
            id: `note-${Date.now()}`,
          }
        : (() => {
            const title = isDaily
              ? today.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "Untitled Trading Note";
            const timeStr = today.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            });
            return {
              id: `note-${Date.now()}`,
              folder: targetFolder,
              title,
              subDate: today.toLocaleDateString("en-US"),
              date: dateStr,
              createdAt: `${dateStr} ${timeStr}`,
              updatedAt: timeStr,
              pinned: false,
              tags: isDaily ? ["DailyLog"] : ["Desk"],
              content: isDaily
                ? `## 🎯 ${title} - Daily Journal\n\n### 📋 Pre-Market Bias & Session Plan\n- HTF Bias:\n- Dealing Range:\n- Kill Zone Target:\n\n### ⏱️ Session Tape Log\n- 09:30:\n- 10:00:\n`
                : `## Note Title\n\n- Key observations:\n- Rules followed:\n`,
            };
          })();

    const updated = [newNote, ...notes];
    try {
      await persistNotes(updated, true);
      setSelectedNoteId(newNote.id);
      setMobileView("detail");
      toast.success(isDaily ? "New daily journal log created" : "New note created");
    } catch (err) {
      console.error("[notebook] failed to create note on cloud:", err);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (notes.length <= 1) {
      toast.error("Cannot delete the only remaining note.");
      return;
    }
    const target = notes.find((n) => n.id === id);
    if (target && target.folder === "Daily Journal" && target.date) {
      recordDismissedDates([target.date]);
    }
    const updated = notes.filter((n) => n.id !== id);
    try {
      await persistNotes(updated, true);
      if (selectedNoteId === id) {
        const remainingInFolder = updated.filter((n) => activeFolder === "All notes" || n.folder === activeFolder);
        setSelectedNoteId(remainingInFolder[0]?.id ?? updated[0]?.id ?? "");
      }
      toast.success("Note removed");
    } catch (err) {
      console.error("[notebook] failed to delete note from cloud:", err);
    }
  };

  const handleDeleteFolder = async (folderName: string) => {
    if (DEFAULT_FOLDERS.includes(folderName)) return;
    if (window.confirm(`Delete folder "${folderName}"? Notes in this folder will be moved to "Trade Notes".`)) {
      const nextFolders = folders.filter((f) => f !== folderName);
      const updatedNotes = notes.map((n) => (n.folder === folderName ? { ...n, folder: "Trade Notes" } : n));
      setFolders(nextFolders);
      foldersRef.current = nextFolders;
      setNotes(updatedNotes);
      notesRef.current = updatedNotes;
      if (activeFolder === folderName) {
        setActiveFolder("Trade Notes");
      }
      try {
        if (userId) {
          setAutoSaveStatus("saving");
          await saveNotebookState({ data: { folders: nextFolders, notes: updatedNotes } });
          setAutoSaveStatus("saved");
        }
        toast.success(`Folder "${folderName}" removed`);
      } catch (err) {
        console.error("[notebook] failed to delete folder on cloud:", err);
        setAutoSaveStatus("error");
        toast.error("Failed to delete folder on cloud.");
      }
    }
  };

  const handleTogglePin = async (id: string) => {
    const updated = notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n));
    try {
      await persistNotes(updated, true);
      const n = notes.find((item) => item.id === id);
      toast.success(n?.pinned ? "Note unpinned" : "Note pinned to top");
    } catch (err) {
      console.error("[notebook] failed to sync pin status:", err);
    }
  };

  const handleDuplicateNote = async (id: string) => {
    const orig = notes.find((n) => n.id === id);
    if (!orig) return;
    const copy: NotebookEntry = {
      ...orig,
      id: `note-${Date.now()}`,
      title: `${orig.title} (Copy)`,
      pinned: false,
    };
    const updated = [copy, ...notes];
    try {
      await persistNotes(updated, true);
      setSelectedNoteId(copy.id);
      toast.success("Note duplicated");
    } catch (err) {
      console.error("[notebook] failed to sync duplicate note:", err);
    }
  };

  const handleAddFolder = async () => {
    const name = window.prompt("Enter new folder name:");
    if (name && name.trim()) {
      const cleanName = name.trim();
      if (!folders.includes(cleanName)) {
        const next = [...folders, cleanName];
        try {
          await persistFolders(next);
          setActiveFolder(cleanName);
          toast.success(`Folder "${cleanName}" created`);
        } catch (err) {
          console.error("[notebook] failed to create folder on cloud:", err);
        }
      }
    }
  };

  const handleAddTag = async () => {
    if (!newTagInput.trim() || !selectedNote) return;
    const clean = newTagInput.trim().replace(/^#/, "");
    if (!selectedNote.tags.includes(clean)) {
      const nowTime = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      const updated = notes.map((n) =>
        n.id === selectedNote.id ? { ...n, tags: [...selectedNote.tags, clean], updatedAt: nowTime } : n,
      );
      try {
        await persistNotes(updated, true);
        toast.success(`Tag #${clean} added`);
      } catch (err) {
        console.error("[notebook] failed to sync tag addition:", err);
      }
    }
    setNewTagInput("");
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!selectedNote) return;
    const nowTime = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const updated = notes.map((n) =>
      n.id === selectedNote.id
        ? { ...n, tags: selectedNote.tags.filter((t) => t !== tagToRemove), updatedAt: nowTime }
        : n,
    );
    try {
      await persistNotes(updated, true);
    } catch (err) {
      console.error("[notebook] failed to sync tag removal:", err);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredNotes.map((n) => n.id));
      setSelectedNoteIds(allIds);
    } else {
      setSelectedNoteIds(new Set());
    }
  };

  const handleToggleSelectCard = (id: string, checked: boolean) => {
    const next = new Set(selectedNoteIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedNoteIds(next);
  };

  const handleDeleteSelected = async () => {
    if (selectedNoteIds.size === 0) return;
    if (selectedNoteIds.size >= notes.length) {
      toast.error("Cannot delete all notes. Keep at least one.");
      return;
    }
    const deletedDailyDates = notes
      .filter((n) => selectedNoteIds.has(n.id) && n.folder === "Daily Journal" && n.date)
      .map((n) => n.date);
    recordDismissedDates(deletedDailyDates);
    const updated = notes.filter((n) => !selectedNoteIds.has(n.id));
    try {
      await persistNotes(updated, true);
      setSelectedNoteIds(new Set());
      if (selectedNoteIds.has(selectedNoteId)) {
        setSelectedNoteId(updated[0].id);
      }
      toast.success("Selected notes deleted");
    } catch (err) {
      console.error("[notebook] failed to delete selected notes:", err);
    }
  };

  // Template snippets inserted via RichNoteEditor
  const insertTemplateSnippet = (type: "prep" | "tape" | "confluence" | "psych") => {
    let snippet = "";
    if (type === "prep") {
      snippet = `### 📋 Pre-Market Dealing Range Blueprint\n- **Midnight Open (00:00 EST)**: \n- **HTF Bias**: Bullish / Bearish continuation\n- **Target Liquidity**: BSL / SSL\n- **Red Folder News**: Flat before 10:00 AM`;
    } else if (type === "tape") {
      snippet = `### ⏱️ Session Tape Reading\n- **09:30**: Opening drive & Asian high/low liquidity check\n- **09:45**: 5m MSS with Displacement candle\n- **10:00**: Consequent Encroachment retracement to FVG\n- **10:30**: Delivery to external liquidity pool`;
    } else if (type === "confluence") {
      snippet = `> **🛡️ ICT Confluence Checklist**\n- [x] HTF Dealing range alignment\n- [x] Liquidity raid confirmed before entry\n- [x] Displacement created clean FVG / Breaker\n- [x] Executed within session Kill Zone`;
    } else {
      snippet = `> **⚡ Trader Psychology & Discipline Audit**\n> - State of mind: Calm / Focused\n> - Did I wait for candle close? Yes / No\n> - Rule compliance: 100%`;
    }
    if (richEditorRef.current) {
      richEditorRef.current.insertMarkdownBlock(snippet);
    } else if (selectedNote) {
      handleUpdateNote({ content: `${selectedNote.content}\n\n${snippet}` });
    }
    toast.success("Template snippet inserted");
  };

  const handleExportMarkdown = () => {
    if (!selectedNote) return;
    const md = richHtmlToMarkdown(selectedNote.content);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${selectedNote.title.replace(/[^a-zA-Z0-9_-]/g, "_")}.md`;
    a.click();
    toast.success("Markdown exported");
  };

  const handleExportAllJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(notes, null, 2));
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = `first-payout-notebook-all-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    toast.success("All notebook entries exported");
  };

  return (
    <AppShell fullWidth>
      <div className="flex flex-col flex-1 h-[calc(100dvh-7.6rem)] lg:h-[calc(100dvh-4.6rem)] w-full min-w-0 overflow-hidden bg-black text-[#f5f5f4] rounded-xl border border-white/[0.08] shadow-2xl">
        
        {/* Top Header Bar matching TradeZella Notebook UI */}
        <header className="border-b border-white/[0.08] bg-[#070709] px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between shrink-0 gap-2 sm:gap-3 min-w-0 overflow-x-auto z-30">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
            <div className="flex items-center gap-2 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[#e50914] shadow-[0_0_8px_#e50914]" />
              <h1 className="font-display font-bold text-base sm:text-lg tracking-tight text-white whitespace-nowrap">Notebook</h1>
            </div>
            <span className="text-xs text-[#a1a1aa] hidden 2xl:inline shrink-0">|</span>
            <span className="text-xs text-[#a2a2a0] hidden 2xl:inline truncate">
              Daily Trade Journaling, Session Pre-Market &amp; Tape Logs
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Account Switcher Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountDropdownOpen((v) => !v)}
                className="flex items-center gap-1.5 sm:gap-2 bg-[#121215] hover:bg-[#1a1a1f] border border-white/[0.1] rounded-lg px-2 sm:px-3 py-1.5 text-xs font-medium text-white transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-[#3ddc84] shrink-0" />
                <span className="truncate max-w-[95px] sm:max-w-none">{activeAccountLabel}</span>
                <ChevronDown className="size-3.5 text-[#a2a2a0] shrink-0" />
              </button>

              {accountDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-44 bg-[#121215] border border-white/[0.12] rounded-lg shadow-2xl py-1 z-50 text-xs">
                  {Array.from(
                    new Set([accountName, "Demo account", "Apex 50K #1", "Topstep 150K"].filter(Boolean)),
                  ).map((acc) => (
                    <button
                      key={acc}
                      type="button"
                      onClick={() => {
                        setActiveAccountLabel(acc!);
                        setAccountDropdownOpen(false);
                        toast.success(`Active account set to ${acc}`);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#e50914]/20 hover:text-white flex items-center justify-between"
                    >
                      <span>{acc}</span>
                      {activeAccountLabel === acc && (
                        <span className="text-[10px] text-[#3ddc84] font-mono">Active</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleManualJournalSync}
              disabled={syncingJournal}
              title="Sync trading days and execution notes from Journal DB"
              className="h-8 gap-1.5 border-white/[0.1] bg-white/[0.03] text-xs text-[#d6d6d4] hover:bg-white/[0.08] shrink-0"
            >
              <RefreshCw className={cn("size-3.5 text-[#3ddc84]", syncingJournal && "animate-spin")} />
              <span className="hidden md:inline">Sync Journal</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportAllJSON}
              className="hidden sm:flex h-8 gap-1.5 border-white/[0.1] bg-white/[0.03] text-xs text-[#d6d6d4] hover:bg-white/[0.08] shrink-0"
            >
              <Download className="size-3.5 text-[#a2a2a0]" />
              <span>Export</span>
            </Button>

            <Button
              size="sm"
              onClick={() => handleCreateEntry()}
              className="h-8 gap-1.5 bg-accent px-3 sm:px-3.5 text-xs font-semibold text-accent-foreground shadow-sm hover:brightness-110 active:scale-95 shrink-0"
            >
              <Plus className="size-3.5" />
              <span>{activeFolder === "Daily Journal" ? "Log day" : "New note"}</span>
            </Button>
          </div>
        </header>

        {/* 3-Column Split Workspace */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          
          {/* COLUMN 1: Folders & Tags Sidebar */}
          <aside
            className={cn(
              "border-r border-white/[0.08] bg-[#09090b] flex-col shrink-0 min-h-0 transition-all duration-200",
              mobileView === "folders" ? "flex w-full" : "hidden md:flex",
              sidebarCollapsed ? "md:w-11 sm:md:w-12 md:items-center" : "md:w-44 lg:w-48 xl:w-52"
            )}
          >
            {/* Mobile return to Notes List bar */}
            <div className="md:hidden p-2.5 border-b border-white/[0.08] bg-[#0c0c0e] flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => setMobileView("list")}
                className="flex items-center gap-1.5 text-xs text-[#d6d6d4] hover:text-white"
              >
                <ChevronLeft className="size-4 text-[#e50914]" />
                <span className="font-medium">Back to notes list</span>
              </button>
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#a1a1aa]">Folders &amp; Tags</span>
            </div>

            {/* Search Input & Add Folder */}
            <div className="p-2.5 border-b border-white/[0.06] space-y-1.5 w-full">
              {!sidebarCollapsed ? (
                <>
                  <div className="relative flex items-center">
                    <Search className="size-3.5 text-[#a1a1aa] absolute left-2.5" />
                    <input
                      type="text"
                      placeholder="Search notes..."
                      aria-label="Search notes"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#121215] border border-white/[0.08] rounded-lg pl-7 pr-7 py-1 text-xs text-white placeholder-[#6f6f6d] focus:outline-none focus:border-[#e50914]/60"
                    />
                    <SlidersHorizontal className="size-3.5 text-[#a1a1aa] absolute right-2.5" />
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleAddFolder}
                      className="flex items-center gap-1.5 text-xs font-medium text-[#d6d6d4] hover:text-white px-1.5 py-1 rounded hover:bg-white/[0.04] transition-colors"
                    >
                      <FolderPlus className="size-3.5 text-[#e50914]" />
                      <span>Add folder</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSidebarCollapsed(true)}
                      className="text-[#a1a1aa] hover:text-white p-1 rounded hidden md:block"
                      title="Collapse sidebar"
                      aria-label="Collapse sidebar"
                    >
                      <ChevronLeft className="size-3.5" />
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(false)}
                  className="text-[#a2a2a0] hover:text-white p-1 rounded bg-white/[0.04]"
                  title="Expand sidebar"
                  aria-label="Expand sidebar"
                >
                  <ChevronRight className="size-4" />
                </button>
              )}
            </div>

            {/* Folders List */}
            <div className="flex-1 overflow-y-auto p-1.5 sm:p-2 space-y-3 w-full">
              <div>
                {!sidebarCollapsed && (
                  <div className="flex items-center justify-between px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
                    <span>Folders</span>
                    <ChevronDown className="size-3 text-[#a1a1aa]" />
                  </div>
                )}

                <div className="mt-0.5 space-y-0.5">
                  {folders.map((f) => {
                    const isActive = activeFolder === f;
                    const isDefault = DEFAULT_FOLDERS.includes(f);
                    const count = f === "All notes" ? notes.length : notes.filter((n) => n.folder === f).length;
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => {
                          setActiveFolder(f);
                          if (typeof window !== "undefined" && window.innerWidth < 768) {
                            setMobileView("list");
                          }
                        }}
                        className={cn(
                          "w-full text-left px-2 py-1 rounded-md text-xs font-medium flex items-center justify-between group transition-colors",
                          isActive
                            ? "bg-white/[0.08] text-white font-semibold"
                            : "text-[#a2a2a0] hover:bg-white/[0.04] hover:text-white",
                          sidebarCollapsed && "justify-center px-1"
                        )}
                        title={f}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={cn(
                              "w-1 h-3.5 rounded-full transition-colors shrink-0",
                              isActive ? "bg-[#e50914]" : "bg-transparent group-hover:bg-white/20"
                            )}
                          />
                          {!sidebarCollapsed && <span className="truncate">{f}</span>}
                        </div>
                        {!sidebarCollapsed && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-mono text-[10px] text-[#a1a1aa] group-hover:text-white">
                              {count}
                            </span>
                            {!isDefault && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteFolder(f);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-[#a1a1aa] hover:text-[#ff6b7d] rounded transition-opacity"
                                title={`Delete folder "${f}"`}
                                aria-label={`Delete folder "${f}"`}
                              >
                                <Trash2 className="size-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tags Section */}
              {!sidebarCollapsed && (
                <div>
                  <div className="flex items-center justify-between px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
                    <span>Tags</span>
                    <ChevronDown className="size-3 text-[#a1a1aa]" />
                  </div>
                  <div className="mt-0.5 space-y-0.5">
                    {allTagsWithCount.map(([tag, count]) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setActiveFolder("All notes");
                          setSearchQuery(tag);
                          if (typeof window !== "undefined" && window.innerWidth < 768) {
                            setMobileView("list");
                          }
                        }}
                        className="w-full flex items-center justify-between px-2 py-1.5 min-h-[28px] text-xs text-[#a2a2a0] hover:text-white hover:bg-white/[0.03] rounded-md transition-colors"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-[#e50914] text-[10px]">#</span>
                          <span className="truncate">{tag}</span>
                        </div>
                        <span className="font-mono text-[10px] text-[#a1a1aa] shrink-0">{count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Footer */}
            {!sidebarCollapsed && (
              <div className="p-2.5 border-t border-white/[0.06] bg-[#0c0c0e] flex items-center justify-between text-[10px] text-[#a2a2a0] w-full">
                <span>
                  Total logs: <strong className="text-white font-mono">{notes.length}</strong>
                </span>
                <span className="flex items-center gap-1 text-[#3ddc84] font-mono text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3ddc84]" /> {userId ? "Cloud Synced" : "Synced"}
                </span>
              </div>
            )}
          </aside>

          {/* COLUMN 2: Middle Log Day List / Notes Feed */}
          <section
            className={cn(
              "border-r border-white/[0.08] bg-[#0c0c0e] flex-col shrink-0 min-h-0",
              mobileView === "list" ? "flex w-full" : "hidden md:flex md:w-56 lg:w-64 xl:w-72"
            )}
          >
            {/* Actions Bar */}
            <div className="p-2 sm:p-2.5 border-b border-white/[0.06] flex items-center justify-between gap-1.5">
              <button
                type="button"
                onClick={() => setMobileView("folders")}
                className="md:hidden p-1.5 rounded-lg border border-white/[0.08] bg-[#17171b] text-[#a2a2a0] hover:text-white"
                title="View folders and tags"
                aria-label="View folders and tags"
              >
                <Folder className="size-3.5 text-[#e50914]" />
              </button>

              <button
                type="button"
                onClick={() => handleCreateEntry()}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#17171b] hover:bg-[#202026] border border-white/[0.08] hover:border-white/[0.16] rounded-lg py-1 px-2.5 text-xs font-medium text-white transition-all shadow-xs"
              >
                <Calendar className="size-3.5 text-[#e50914]" />
                <span>{activeFolder === "Daily Journal" ? "Log day" : "New note"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const orders: Array<"newest" | "oldest" | "pnl" | "title"> = [
                    "newest",
                    "oldest",
                    "pnl",
                    "title",
                  ];
                  const next = orders[(orders.indexOf(sortOrder) + 1) % orders.length];
                  setSortOrder(next);
                  toast.success(`Sorted by: ${next}`);
                }}
                className="p-1.5 rounded-lg border border-white/[0.08] bg-[#17171b] hover:bg-[#202026] text-[#a2a2a0] hover:text-white"
                title={`Sort: ${sortOrder}`}
                aria-label={`Sort notes: currently ${sortOrder}`}
              >
                <SlidersHorizontal className="size-3.5" />
              </button>
            </div>

            {/* Select All & Bulk Actions */}
            <div className="px-2.5 py-1.5 border-b border-white/[0.04] bg-[#09090b] flex items-center justify-between text-xs text-[#a2a2a0]">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  aria-label="Select all notes"
                  checked={
                    filteredNotes.length > 0 &&
                    filteredNotes.every((n) => selectedNoteIds.has(n.id))
                  }
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="size-3.5 rounded bg-[#17171b] border-white/[0.2] text-[#e50914] focus:ring-0 cursor-pointer"
                />
                <span className="text-[11px]">Select all</span>
              </label>

              {selectedNoteIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="text-[11px] text-[#ff6b7d] hover:underline flex items-center gap-1"
                >
                  <Trash2 className="size-3" />
                  <span>Delete ({selectedNoteIds.size})</span>
                </button>
              )}
            </div>

            {/* Note Cards List */}
            <div className="flex-1 overflow-y-auto p-1.5 sm:p-2 space-y-1.5">
              {filteredNotes.length === 0 ? (
                <div className="py-12 text-center text-[#a1a1aa] text-xs">
                  <p>No notes found in {activeFolder}</p>
                </div>
              ) : (
                filteredNotes.map((n) => {
                  const isSelected = selectedNote?.id === n.id;
                  const isChecked = selectedNoteIds.has(n.id);
                  const noteMetrics = getNoteMetrics(n);
                  const pnl = noteMetrics?.netPnl;
                  const tradesCount = noteMetrics?.totalTrades;

                  return (
                    <div
                      key={n.id}
                      onClick={() => {
                        setSelectedNoteId(n.id);
                        if (typeof window !== "undefined" && window.innerWidth < 768) {
                          setMobileView("detail");
                        }
                      }}
                      className={cn(
                        "p-2.5 rounded-lg border cursor-pointer transition-all relative group",
                        isSelected
                          ? "bg-[#151518] border-[#e50914]/50 shadow-[0_4px_16px_rgba(229,9,20,0.18)]"
                          : "bg-[#101012] border-white/[0.06] hover:bg-[#141416] hover:border-white/[0.12]"
                      )}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <input
                            type="checkbox"
                            aria-label={`Select note ${n.title}`}
                            checked={isChecked}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleToggleSelectCard(n.id, e.target.checked);
                            }}
                            className="size-3.5 rounded bg-[#17171b] border-white/[0.2] text-[#e50914] focus:ring-0 cursor-pointer shrink-0"
                          />
                          <h3 className="font-medium text-xs text-white leading-tight truncate">
                            {n.title}
                          </h3>
                        </div>

                        {pnl != null && (
                          <span
                            className={cn(
                              "font-mono text-[11px] font-semibold shrink-0",
                              pnl > 0 ? "text-[#3ddc84]" : pnl < 0 ? "text-[#ff6b7d]" : "text-[#a2a2a0]"
                            )}
                          >
                            {fmtCurrency(pnl)}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex items-center justify-between text-[10px] text-[#a1a1aa]">
                        <span className="font-mono">{n.subDate || n.date}</span>
                        {tradesCount ? (
                          <span className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[10px] text-[#a2a2a0]">
                            {tradesCount} {tradesCount === 1 ? "trade" : "trades"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* COLUMN 3: Right Note Editor & Detail View */}
          <section
            className={cn(
              "flex-1 min-w-0 bg-black flex-col overflow-y-auto min-h-0",
              mobileView === "detail" ? "flex w-full" : "hidden md:flex"
            )}
          >
            {selectedNote ? (
              <div className="flex flex-col flex-1">
                {/* Header & Title Area */}
                <div className="p-3.5 sm:p-5 border-b border-white/[0.08] bg-[#070709] space-y-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== "undefined" && window.innerWidth < 768) {
                            setMobileView("list");
                          } else {
                            setSidebarCollapsed((v) => !v);
                          }
                        }}
                        className="p-1.5 rounded-md hover:bg-white/[0.06] text-[#a1a1aa] hover:text-white shrink-0 transition-colors"
                        title={sidebarCollapsed ? "Expand sidebar" : "Back to list / collapse"}
                        aria-label={sidebarCollapsed ? "Expand sidebar" : "Back to list / collapse"}
                      >
                        <ChevronLeft className={cn("size-4 transition-transform", sidebarCollapsed && "md:rotate-180")} />
                      </button>
                      <div className="p-1.5 rounded-md bg-[#17171b] border border-white/[0.08] text-[#a2a2a0] shrink-0">
                        <Calendar className="size-4 text-[#e50914]" />
                      </div>
                      <input
                        type="text"
                        value={selectedNote.title}
                        onChange={(e) => handleUpdateNote({ title: e.target.value })}
                        onBlur={() => {
                          if (saveTimerRef.current) {
                            void persistNotes(notesRef.current, true);
                          }
                        }}
                        className="flex-1 min-w-[140px] bg-transparent font-display font-bold text-base sm:text-xl lg:text-2xl text-white focus:outline-none placeholder-[#6f6f6d]"
                        placeholder="Note Title..."
                        aria-label="Note title"
                      />
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[11px] text-[#3ddc84] flex items-center gap-1">
                        {autoSaveStatus === "saving" ? (
                          <span className="text-amber-400 animate-pulse">Saving...</span>
                        ) : autoSaveStatus === "local" ? (
                          <span className="text-[#a2a2a0]">● Local</span>
                        ) : autoSaveStatus === "error" ? (
                          <span className="text-red-400">● Sync failed</span>
                        ) : (
                          <span>✓ Synced</span>
                        )}
                      </span>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setMoreMenuOpen((v) => !v)}
                          aria-label="More note options"
                          className="p-1.5 rounded-lg border border-white/[0.08] bg-[#121215] text-[#a2a2a0] hover:text-white"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>

                        {moreMenuOpen && (
                          <div className="absolute right-0 mt-1.5 w-44 bg-[#121215] border border-white/[0.12] rounded-lg shadow-2xl py-1 z-40 text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                handleDuplicateNote(selectedNote.id);
                                setMoreMenuOpen(false);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-white/[0.06] text-[#d6d6d4]"
                            >
                              Duplicate Note
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleTogglePin(selectedNote.id);
                                setMoreMenuOpen(false);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-white/[0.06] text-[#d6d6d4]"
                            >
                              {selectedNote.pinned ? "Unpin Note" : "Pin Note"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleExportMarkdown();
                                setMoreMenuOpen(false);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-white/[0.06] text-[#d6d6d4]"
                            >
                              Export Markdown
                            </button>
                            <hr className="my-1 border-white/[0.08]" />
                            <button
                              type="button"
                              onClick={() => {
                                handleDeleteNote(selectedNote.id);
                                setMoreMenuOpen(false);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-[#ff6b7d]/20 text-[#ff6b7d]"
                            >
                              Delete Note
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Collapsible Performance Card */}
                  {(liveDayMetrics || activeFolder === "Daily Journal") && (
                    <div className="rounded-xl border border-white/[0.09] bg-[#0c0c0e] p-3 sm:p-4 transition-all">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-medium text-[#a2a2a0]">Net P&amp;L</span>
                            <span
                              className={cn(
                                "font-display font-extrabold text-xl sm:text-2xl tracking-tight",
                                (liveDayMetrics?.netPnl ?? 0) >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]"
                              )}
                            >
                              {fmtCurrency(liveDayMetrics?.netPnl ?? 0)}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#a1a1aa]">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[#888886]">Session Date:</span>
                              <input
                                type="date"
                                aria-label="Session Date"
                                value={selectedNote.date}
                                onChange={(e) => {
                                  const newDate = e.target.value;
                                  if (!newDate) return;
                                  const d = new Date(newDate + "T00:00:00");
                                  const formattedTitle =
                                    selectedNote.folder === "Daily Journal"
                                      ? d.toLocaleDateString("en-US", {
                                          weekday: "short",
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                        })
                                      : selectedNote.title;
                                  handleUpdateNote({
                                    date: newDate,
                                    subDate: d.toLocaleDateString("en-US"),
                                    title: formattedTitle,
                                  });
                                }}
                                className="bg-[#121215] border border-white/[0.1] rounded px-1.5 py-0.5 text-[11px] font-mono text-white focus:outline-none focus:border-[#e50914]"
                              />
                            </div>
                            <span>•</span>
                            <span>
                              Created:{" "}
                              <strong className="text-[#a2a2a0] font-normal">
                                {selectedNote.createdAt}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>
                              Last updated:{" "}
                              <strong className="text-[#a2a2a0] font-normal">
                                {selectedNote.updatedAt}
                              </strong>
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setPerfCollapsed((v) => !v)}
                          className="p-1.5 rounded-lg border border-white/[0.08] bg-[#17171b] text-[#a2a2a0] hover:text-white transition-transform shrink-0"
                          title="Toggle stats collapse"
                          aria-label="Toggle stats collapse"
                        >
                          <ChevronDown
                            className={cn(
                              "size-4 transform transition-transform",
                              perfCollapsed && "-rotate-90"
                            )}
                          />
                        </button>
                      </div>

                      {/* Collapsible Body with P&L Chart & Stats */}
                      {!perfCollapsed && (
                        <div className="mt-3 pt-3 border-t border-white/[0.06] grid grid-cols-1 2xl:grid-cols-12 gap-3.5 items-stretch">
                          {/* Intraday Cumulative P&L Area Chart */}
                          <div className="2xl:col-span-5 bg-[#070709] border border-white/[0.06] rounded-lg p-2.5 min-w-0">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] uppercase font-semibold tracking-wider text-[#a1a1aa]">
                                Intraday Equity Curve
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] font-mono",
                                  (liveDayMetrics?.netPnl ?? 0) >= 0 ? "text-[#3ddc84]" : "text-[#ff6b7d]"
                                )}
                              >
                                {liveDayMetrics?.winrate ?? 0}% Winrate
                              </span>
                            </div>
                            <IntradayEquityCurve metrics={liveDayMetrics} />
                          </div>

                          {/* 8 Stats Metrics - 4 Columns matching TradeZella reference */}
                          <div className="2xl:col-span-7 grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.08] bg-[#070709] border border-white/[0.06] rounded-lg p-2.5 min-w-0">
                            {/* Column 1: Total trades & Winrate */}
                            <div className="flex flex-col justify-between py-1 px-2.5 sm:px-3 min-w-0 space-y-2.5">
                              <div className="min-w-0" title="Total trades">
                                <span className="text-[10px] text-[#888886] block font-semibold uppercase tracking-wider leading-tight">
                                  Total trades
                                </span>
                                <span className="font-mono font-bold text-xs sm:text-sm text-white mt-0.5 block whitespace-nowrap">
                                  {liveDayMetrics?.totalTrades ?? 0}
                                </span>
                              </div>
                              <div className="min-w-0" title="Winrate">
                                <span className="text-[10px] text-[#888886] block font-semibold uppercase tracking-wider leading-tight">
                                  Winrate
                                </span>
                                <span className="font-mono font-bold text-xs sm:text-sm text-[#3ddc84] mt-0.5 block whitespace-nowrap">
                                  {liveDayMetrics?.winrate ?? 0}%
                                </span>
                              </div>
                            </div>

                            {/* Column 2: Winners & Losers */}
                            <div className="flex flex-col justify-between py-1 px-2.5 sm:px-3 min-w-0 space-y-2.5">
                              <div className="min-w-0" title="Winners">
                                <span className="text-[10px] text-[#888886] block font-semibold uppercase tracking-wider leading-tight">
                                  Winners
                                </span>
                                <span className="font-mono font-bold text-xs sm:text-sm text-[#3ddc84] mt-0.5 block whitespace-nowrap">
                                  {liveDayMetrics?.winners ?? 0}
                                </span>
                              </div>
                              <div className="min-w-0" title="Losers">
                                <span className="text-[10px] text-[#888886] block font-semibold uppercase tracking-wider leading-tight">
                                  Losers
                                </span>
                                <span className="font-mono font-bold text-xs sm:text-sm text-[#ff6b7d] mt-0.5 block whitespace-nowrap">
                                  {liveDayMetrics?.losers ?? 0}
                                </span>
                              </div>
                            </div>

                            {/* Column 3: Gross P&L & Volume */}
                            <div className="flex flex-col justify-between py-1 px-2.5 sm:px-3 min-w-0 space-y-2.5">
                              <div className="min-w-0" title="Gross P&L">
                                <span className="text-[10px] text-[#888886] block font-semibold uppercase tracking-wider leading-tight">
                                  Gross P&amp;L
                                </span>
                                <span
                                  className={cn(
                                    "font-mono font-bold text-xs sm:text-sm mt-0.5 block whitespace-nowrap",
                                    (liveDayMetrics?.grossPnl ?? 0) >= 0 ? "text-white" : "text-[#ff6b7d]"
                                  )}
                                >
                                  {fmtCurrency(liveDayMetrics?.grossPnl ?? 0)}
                                </span>
                              </div>
                              <div className="min-w-0" title="Volume">
                                <span className="text-[10px] text-[#888886] block font-semibold uppercase tracking-wider leading-tight">
                                  Volume
                                </span>
                                <span className="font-mono font-bold text-xs sm:text-sm text-white mt-0.5 block whitespace-nowrap">
                                  {liveDayMetrics?.volume ?? 0}
                                </span>
                              </div>
                            </div>

                            {/* Column 4: Commissions & Profit factor */}
                            <div className="flex flex-col justify-between py-1 px-2.5 sm:px-3 min-w-0 space-y-2.5">
                              <div className="min-w-0" title="Commissions">
                                <span className="text-[10px] text-[#888886] block font-semibold uppercase tracking-wider leading-tight">
                                  Commissions
                                </span>
                                <span className="font-mono font-bold text-xs sm:text-sm text-[#ff6b7d] mt-0.5 block whitespace-nowrap">
                                  ${((liveDayMetrics?.commissions ?? 0)).toFixed(2)}
                                </span>
                              </div>
                              <div className="min-w-0" title="Profit factor">
                                <span className="text-[10px] text-[#888886] block font-semibold uppercase tracking-wider leading-tight">
                                  Profit factor
                                </span>
                                <span
                                  className={cn(
                                    "font-mono font-bold text-xs sm:text-sm mt-0.5 block whitespace-nowrap",
                                    (liveDayMetrics?.profitFactor ?? 0) >= 1 ? "text-[#3ddc84]" : "text-[#ff6b7d]"
                                  )}
                                >
                                  {Number(liveDayMetrics?.profitFactor ?? 0).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Linked Journal Executions Strip */}
                          {liveDayMetrics?.hasLiveTrades && liveDayMetrics.trades.length > 0 && (
                            <div className="2xl:col-span-12 rounded-lg border border-white/[0.06] bg-[#070709] p-2.5">
                              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="size-1.5 rounded-full bg-[#3ddc84]" />
                                  <span className="text-[10px] font-semibold tracking-wider text-[#a1a1aa] uppercase">
                                    Linked Journal Executions ({liveDayMetrics.trades.length}) · DB Live
                                  </span>
                                </div>
                                <Link
                                  to="/journal"
                                  search={{ date: selectedNote.date } as any}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#3ddc84] hover:underline"
                                >
                                  <span>Open in Journal</span>
                                  <ArrowUpRight className="size-3" />
                                </Link>
                              </div>
                              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                                {liveDayMetrics.trades.map((t) => {
                                  const inst = resolveTradeInstrument(deskInstruments, t.market);
                                  const pnl = tradeDollarPnl(t, inst);
                                  const net = pnl.net ?? 0;
                                  return (
                                    <div
                                      key={t.id}
                                      className="flex items-center justify-between gap-2 rounded-md border border-white/[0.07] bg-[#101014] px-2.5 py-1.5 text-[11px]"
                                    >
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 font-mono">
                                          <span className="font-semibold text-white">{t.market}</span>
                                          <span
                                            className={cn(
                                              "text-[9px] uppercase font-bold",
                                              t.side === "long" ? "text-[#3ddc84]" : "text-[#ff6b7d]"
                                            )}
                                          >
                                            {t.side}
                                          </span>
                                          <span className="text-[#888886]">· {t.lots ?? "—"} lots</span>
                                        </div>
                                        <div className="truncate text-[10px] text-[#a2a2a0]">
                                          {t.modelName || t.notes || t.time}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span
                                          className={cn(
                                            "font-mono font-semibold",
                                            net > 0 ? "text-[#3ddc84]" : net < 0 ? "text-[#ff6b7d]" : "text-[#a2a2a0]"
                                          )}
                                        >
                                          {fmtCurrency(net)}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const block = formatTradeMarkdownBlock(t, deskInstruments, deskModels);
                                            if (richEditorRef.current) {
                                              richEditorRef.current.insertMarkdownBlock(block);
                                            } else {
                                              handleUpdateNote({
                                                content: `${selectedNote.content.trimEnd()}\n\n${block}`,
                                              });
                                            }
                                            toast.success(`Inserted ${t.market} execution note`);
                                          }}
                                          title="Insert trade breakdown & notes into this entry"
                                          className="rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-[#d6d6d4] hover:border-[#3ddc84]/50 hover:text-white"
                                        >
                                          + Note
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recently Used Templates & Tags */}
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-[#a1a1aa] font-medium text-[11px]">Recently used templates:</span>
                      <button
                        type="button"
                        onClick={() => insertTemplateSnippet("prep")}
                        className="px-2.5 py-1 rounded-md bg-[#121215] hover:bg-[#1a1a1f] border border-white/[0.07] text-[#d6d6d4] hover:text-white transition-colors"
                      >
                        Pre-Market Prep
                      </button>
                      <button
                        type="button"
                        onClick={() => insertTemplateSnippet("tape")}
                        className="px-2.5 py-1 rounded-md bg-[#121215] hover:bg-[#1a1a1f] border border-white/[0.07] text-[#d6d6d4] hover:text-white transition-colors"
                      >
                        Session Tape
                      </button>
                      <button
                        type="button"
                        onClick={() => insertTemplateSnippet("confluence")}
                        className="px-2.5 py-1 rounded-md bg-[#121215] hover:bg-[#1a1a1f] border border-white/[0.07] text-[#d6d6d4] hover:text-white transition-colors"
                      >
                        Confluence Checklist
                      </button>
                      <button
                        type="button"
                        onClick={() => insertTemplateSnippet("psych")}
                        className="px-2.5 py-1 rounded-md bg-[#121215] hover:bg-[#1a1a1f] border border-white/[0.07] text-[#d6d6d4] hover:text-white transition-colors"
                      >
                        Psychology Check
                      </button>
                    </div>

                    {/* Note Tags */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      {selectedNote.tags.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 bg-[#151518] border border-white/[0.08] text-[#d6d6d4] text-[11px] px-2 py-0.5 rounded-md"
                        >
                          <span>#{t}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(t)}
                            className="text-[#a1a1aa] hover:text-[#ff6b7d]"
                            aria-label={`Remove tag #${t}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}

                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="+ Add tag..."
                          aria-label="Add new tag"
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddTag();
                            }
                          }}
                          className="bg-[#121215] border border-white/[0.08] rounded-md px-2 py-0.5 text-[11px] text-white placeholder-[#6f6f6d] focus:outline-none focus:border-[#e50914]/60 w-24"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* True WYSIWYG Rich Note Editor & Formatting Toolbar */}
                <RichNoteEditor
                  ref={richEditorRef}
                  noteId={selectedNote.id}
                  value={selectedNote.content}
                  fontSize={currentFontSize}
                  fontFamily={currentFontFamily}
                  onFontSizeChange={setCurrentFontSize}
                  onFontFamilyChange={setCurrentFontFamily}
                  onChange={(nextContent) => handleUpdateNote({ content: nextContent })}
                  onBlurFlush={() => {
                    if (saveTimerRef.current) {
                      void persistNotes(notesRef.current, true);
                    }
                  }}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-24 text-center text-[#a2a2a0]">
                <Calendar className="size-10 text-[#a1a1aa]" />
                <h3 className="mt-3 text-lg font-semibold text-white">No note selected</h3>
                <p className="mt-1 text-xs text-[#a2a2a0]">
                  Select an entry from the list or create a new trading log.
                </p>
                <Button
                  size="sm"
                  onClick={() => handleCreateEntry()}
                  className="mt-4 gap-1.5 bg-[#e50914] text-xs font-semibold text-white"
                >
                  <Plus className="size-3.5" /> Create Note
                </Button>
              </div>
            )}
          </section>

        </div>
      </div>
    </AppShell>
  );
}