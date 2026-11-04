import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Pencil,
  Plus,
  PlusCircle,
  Repeat,
  Search,
  Shield,
  SlidersHorizontal,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import {
  calculateWeeklyProfileStats,
  computeWeekInfo,
  exportWeeklyProfilesToCSV,
  registerProfileSyncHandler,
  useWeeklyProfileStore,
  type WeekDay,
  type WeeklyProfileRecord,
} from "@/lib/weekly-profile-store";
import { useDeskStore } from "@/lib/ict-store";
import { todayISO, weekStartISO } from "@/lib/ict-time";

export const Route = createFileRoute("/weekly-profile")({ component: WeeklyProfilePage });

const MONDAY_BEHAVIOURS = [
  "Ranging / Asian Accumulation",
  "Expansion",
  "Weak / Low Volume",
  "Consolidation",
  "Reversal",
] as const;

const TUESDAY_BEHAVIOURS = [
  "Made HOW (Judas Swing)",
  "Made LOW",
  "Equilibrium Tap",
  "Continuation",
  "Consolidation",
] as const;

const DAYS_OF_WEEK: WeekDay[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

type SortColumn = "week" | "how" | "low" | "monType" | "tueType" | "amd";
type SortDirection = "asc" | "desc";

const PAGE_SIZE = 6;

function WeeklyProfilePage() {
  const records = useWeeklyProfileStore((s) => s.records);
  const selectedWeekId = useWeeklyProfileStore((s) => s.selectedWeekId);
  const setSelectedWeekId = useWeeklyProfileStore((s) => s.setSelectedWeekId);
  const addRecord = useWeeklyProfileStore((s) => s.addRecord);
  const updateRecord = useWeeklyProfileStore((s) => s.updateRecord);
  const deleteRecord = useWeeklyProfileStore((s) => s.deleteRecord);

  // Wire desk store cloud sync so weekly records persist directly to Neon Postgres
  useEffect(() => {
    registerProfileSyncHandler((record, action) => {
      try {
        const deskStore = useDeskStore.getState();
        if (action === "delete") {
          deskStore.removeWeekly(record.id);
        } else {
          deskStore.upsertWeekly({
            id: record.id,
            weekStart: record.startDate,
            market: "XAUUSD",
            dealingRange: {
              high: null,
              low: null,
              open: null,
              close: null,
              current: null,
            },
            structure: record.tueType.includes("HOW") ? "bearish" : "bullish",
            profile: record.amd ? "expansion" : "normal",
            liquidity: [],
            primaryDraw: "",
            secondaryDraw: "",
            beforeDraw: `HOW: ${record.howDay} | LOW: ${record.lowDay} | Mon: ${record.monType} | Tue: ${record.tueType}`,
            notes: record.notes,
          });
        }
      } catch (err) {
        console.warn("[weekly] desk store sync notice:", err);
      }
    });

    return () => {
      registerProfileSyncHandler(null);
    };
  }, []);

  // Rehydrate store on client mount
  useEffect(() => {
    useWeeklyProfileStore.persist?.rehydrate?.();
  }, []);

  // Form State
  const formRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const defaultMonday = weekStartISO(todayISO());
  const [formDate, setFormDate] = useState<string>(defaultMonday);
  const [formHowDay, setFormHowDay] = useState<WeekDay>("Tuesday");
  const [formLowDay, setFormLowDay] = useState<WeekDay>("Thursday");
  const [formMonType, setFormMonType] = useState<string>(MONDAY_BEHAVIOURS[0]);
  const [formTueType, setFormTueType] = useState<string>(TUESDAY_BEHAVIOURS[0]);
  const [formAmd, setFormAmd] = useState<boolean>(true);
  const [formNotes, setFormNotes] = useState<string>("");

  // Table filtering, search, and sorting state
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterAmd, setFilterAmd] = useState<"all" | "yes" | "no">("all");
  const [filterDay, setFilterDay] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("week");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);

  // Computed stats
  const stats = useMemo(() => calculateWeeklyProfileStats(records), [records]);

  // Computed week information for current form date
  const weekInfo = useMemo(() => computeWeekInfo(formDate), [formDate]);

  // Selected week record
  const activeRecord = useMemo(
    () => records.find((r) => r.id === selectedWeekId) ?? records[0],
    [records, selectedWeekId],
  );

  // Filtered and sorted table rows
  const filteredRecords = useMemo(() => {
    const list = records.filter((r) => {
      if (filterAmd === "yes" && !r.amd) return false;
      if (filterAmd === "no" && r.amd) return false;
      if (filterDay !== "all" && r.howDay !== filterDay && r.lowDay !== filterDay)
        return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        r.weekNumber.toLowerCase().includes(q) ||
        r.dateLabel.toLowerCase().includes(q) ||
        r.startDate.toLowerCase().includes(q) ||
        r.howDay.toLowerCase().includes(q) ||
        r.lowDay.toLowerCase().includes(q) ||
        r.monType.toLowerCase().includes(q) ||
        r.tueType.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q)
      );
    });

    list.sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case "week":
          comparison = a.startDate.localeCompare(b.startDate);
          break;
        case "how":
          comparison = a.howDay.localeCompare(b.howDay);
          break;
        case "low":
          comparison = a.lowDay.localeCompare(b.lowDay);
          break;
        case "monType":
          comparison = a.monType.localeCompare(b.monType);
          break;
        case "tueType":
          comparison = a.tueType.localeCompare(b.tueType);
          break;
        case "amd":
          comparison = (a.amd === b.amd ? 0 : a.amd ? 1 : -1);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return list;
  }, [records, filterAmd, filterDay, searchQuery, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const validPage = Math.min(currentPage, totalPages);
  const paginatedRecords = useMemo(() => {
    const start = (validPage - 1) * PAGE_SIZE;
    return filteredRecords.slice(start, start + PAGE_SIZE);
  }, [filteredRecords, validPage]);

  // Handle column sort toggle
  const handleSortToggle = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection(col === "week" ? "desc" : "asc");
    }
    setCurrentPage(1);
  };

  // Reset form to Add mode
  const resetFormToAdd = (dateStr = defaultMonday) => {
    setEditingId(null);
    setFormDate(dateStr);
    setFormHowDay("Tuesday");
    setFormLowDay("Thursday");
    setFormMonType(MONDAY_BEHAVIOURS[0]);
    setFormTueType(TUESDAY_BEHAVIOURS[0]);
    setFormAmd(true);
    setFormNotes("");
  };

  // Scroll and focus into form for "Add New Week"
  const handleAddNewWeekClick = () => {
    resetFormToAdd();
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Select cycle from top dropdown and jump table to that page
  const handleSelectCycle = (cycleId: string) => {
    setSelectedWeekId(cycleId);
    const idx = filteredRecords.findIndex((r) => r.id === cycleId);
    if (idx >= 0) {
      const targetPage = Math.floor(idx / PAGE_SIZE) + 1;
      setCurrentPage(targetPage);
    }
  };

  // Populate form for editing
  const handleEditClick = (record: WeeklyProfileRecord) => {
    setEditingId(record.id);
    setFormDate(record.startDate);
    setFormHowDay(record.howDay);
    setFormLowDay(record.lowDay);
    setFormMonType(
      MONDAY_BEHAVIOURS.find((b) => b === record.monType || b.startsWith(record.monType)) ??
        record.monType,
    );
    setFormTueType(
      TUESDAY_BEHAVIOURS.find((b) => b === record.tueType || b.startsWith(record.tueType)) ??
        record.tueType,
    );
    setFormAmd(record.amd);
    setFormNotes(record.notes);

    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    toast.info(`Editing week profile ${record.weekNumber} (${record.dateLabel})`);
  };

  // Delete row
  const handleDeleteClick = (record: WeeklyProfileRecord) => {
    deleteRecord(record.id);
    if (editingId === record.id) {
      resetFormToAdd();
    }
    toast.success(`Removed record ${record.weekNumber} from weekly tracker`);
  };

  // Form submit
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const info = computeWeekInfo(formDate);

    // Normalize types for crisp badge display matching HTML mockup
    const cleanMonType = formMonType.includes("Ranging")
      ? "Ranging"
      : formMonType.includes("Weak")
        ? "Weak"
        : formMonType;
    const cleanTueType = formTueType.includes("Made HOW")
      ? "Made HOW"
      : formTueType.includes("Made LOW")
        ? "Made LOW"
        : formTueType;

    if (editingId) {
      updateRecord(editingId, {
        startDate: info.mondayISO,
        endDate: info.fridayISO,
        weekNumber: info.weekNumber,
        dateLabel: info.dateLabel,
        cycleLabel: info.cycleLabel,
        howDay: formHowDay,
        lowDay: formLowDay,
        monType: cleanMonType,
        tueType: cleanTueType,
        amd: formAmd,
        notes: formNotes.trim(),
      });
      toast.success(`Updated weekly profile for ${info.weekNumber}`);
      resetFormToAdd();
    } else {
      const created = addRecord({
        startDate: info.mondayISO,
        endDate: info.fridayISO,
        weekNumber: info.weekNumber,
        dateLabel: info.dateLabel,
        cycleLabel: info.cycleLabel,
        howDay: formHowDay,
        lowDay: formLowDay,
        monType: cleanMonType,
        tueType: cleanTueType,
        amd: formAmd,
        notes: formNotes.trim(),
      });
      setSelectedWeekId(created.id);
      setCurrentPage(1);
      toast.success(`Submitted weekly profile for ${info.weekNumber} (${info.dateLabel})`);
      resetFormToAdd();
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      toast.error("No weekly records to export");
      return;
    }
    exportWeeklyProfilesToCSV(filteredRecords);
    toast.success(`Exported ${filteredRecords.length} weekly records to CSV`);
  };

  return (
    <AppShell fullWidth contentClassName="min-h-0 flex-1 p-0 flex flex-col">
      <div className="terminal-grid flex min-h-full w-full flex-col bg-[#07090c] text-[#f5f5f4] selection:bg-[#e50914]/30 selection:text-white fs">
        <div className="mx-auto w-full max-w-[1720px] flex-1 px-4 py-6 sm:px-6 md:px-8">
          {/* ================= 1. PAGE TITLE & CYCLE CONTROLS ================= */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
            <div className="flex items-center gap-3.5">
              <div className="flex size-10 items-center justify-center rounded-lg border border-[#2979ff]/40 bg-[#2979ff]/10 text-[#2979ff] shadow-[0_0_16px_rgba(41,121,255,0.2)]">
                <Activity className="size-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="fd text-[28px] leading-none tracking-tight text-white">
                    ICT Weekly Profile Tracker
                  </h2>
                  <span className="fm rounded border border-[#00c853]/40 bg-[#00c853]/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-[#00c853] uppercase">
                    XAUUSD Institutional Model
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-[#a2a2a0]">
                  Weekly Judas swing manipulation, AMD accumulation profile &amp; liquidity raid
                  distribution matrix.
                </p>
              </div>
            </div>

            {/* Right Side: Week Selector + Add New Week Button (Green) */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Week Selector Dropdown */}
              <div className="relative">
                <label htmlFor="cycle-select" className="sr-only">
                  Select Cycle
                </label>
                <div className="relative flex h-9 items-center gap-2 rounded-md border border-white/[0.1] bg-[#12161c] px-3 text-[12px] text-[#f5f5f4] transition-colors hover:border-white/[0.2]">
                  <Calendar className="size-3.5 text-[#2979ff]" />
                  <select
                    id="cycle-select"
                    value={activeRecord?.id ?? ""}
                    onChange={(e) => handleSelectCycle(e.target.value)}
                    className="fm cursor-pointer appearance-none bg-transparent pr-5 font-medium text-white outline-none"
                  >
                    {records.map((r) => (
                      <option key={r.id} value={r.id} className="bg-[#12161c] text-white">
                        {r.cycleLabel || `${r.weekNumber} (${r.dateLabel})`}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 size-3 text-[#a2a2a0]" />
                </div>
              </div>

              {/* Add New Week Button in Green */}
              <button
                type="button"
                onClick={handleAddNewWeekClick}
                className="flex h-9 items-center gap-2 rounded-md bg-[#00c853] px-3.5 text-[13px] font-semibold text-black shadow-[0_8px_20px_-8px_rgba(0,200,83,0.7)] transition-all hover:bg-[#00e676] cursor-pointer active:scale-95"
              >
                <Plus className="size-3.5 stroke-[2.5]" />
                <span>Add New Week</span>
              </button>
            </div>
          </div>

          {/* ================= 2. FOUR STATISTICS CARDS ROW ================= */}
          <section className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* CARD 1: Tuesday HOW Rate */}
            <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#12161c]/90 p-4.5 shadow-[0_10px_25px_-10px_rgba(0,0,0,0.6)] backdrop-blur-sm">
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#00c853] to-transparent" />
              <div className="flex items-start justify-between">
                <span className="text-[11px] font-semibold tracking-wider text-[#a2a2a0] uppercase">
                  HOW Formation
                </span>
                <div className="flex size-7 items-center justify-center rounded-md border border-[#00c853]/30 bg-[#00c853]/10 text-[#00c853]">
                  <TrendingUp className="size-3.5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="fm text-[32px] font-semibold leading-none text-[#00c853]">
                  {stats.howFormationPct}%
                </span>
                <span className="fm text-[11px] font-medium text-[#00c853]">+4.2% vs 30w</span>
              </div>
              <p className="mt-2 text-[12px] text-[#d6d6d4]">Tuesday made High of the Week (HOW)</p>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-[#00c853] transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, stats.howFormationPct))}%` }}
                  />
                </div>
                <span className="fm text-[10px] text-[#a2a2a0]">
                  {stats.howFormationCount} of {stats.totalWeeks} wks
                </span>
              </div>
            </div>

            {/* CARD 2: Monday Accumulation / Ranging Rate */}
            <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#12161c]/90 p-4.5 shadow-[0_10px_25px_-10px_rgba(0,0,0,0.6)] backdrop-blur-sm">
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#f5b942] to-transparent" />
              <div className="flex items-start justify-between">
                <span className="text-[11px] font-semibold tracking-wider text-[#a2a2a0] uppercase">
                  Mon Accumulation
                </span>
                <div className="flex size-7 items-center justify-center rounded-md border border-[#f5b942]/30 bg-[#f5b942]/10 text-[#f5b942]">
                  <Repeat className="size-3.5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="fm text-[32px] font-semibold leading-none text-[#f5b942]">
                  {stats.monAccumulationPct}%
                </span>
                <span className="fm text-[11px] text-[#a2a2a0]">Avg 14.8 pts</span>
              </div>
              <p className="mt-2 text-[12px] text-[#d6d6d4]">Monday ranging / tight dealing range</p>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-[#f5b942] transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, stats.monAccumulationPct))}%`,
                    }}
                  />
                </div>
                <span className="fm text-[10px] text-[#a2a2a0]">
                  {stats.monAccumulationCount} of {stats.totalWeeks} wks
                </span>
              </div>
            </div>

            {/* CARD 3: Dominant HOW Day */}
            <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#12161c]/90 p-4.5 shadow-[0_10px_25px_-10px_rgba(0,0,0,0.6)] backdrop-blur-sm">
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#00c853] to-transparent" />
              <div className="flex items-start justify-between">
                <span className="text-[11px] font-semibold tracking-wider text-[#a2a2a0] uppercase">
                  Dominant HOW Day
                </span>
                <div className="flex size-7 items-center justify-center rounded-md border border-[#00c853]/30 bg-[#00c853]/10 text-[#00c853]">
                  <CalendarCheck className="size-3.5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="fd text-[32px] font-medium leading-none text-[#00c853]">
                  {stats.dominantHowDay}
                </span>
                <span className="fm text-[11px] text-[#a2a2a0]">London / NY AM</span>
              </div>
              <p className="mt-2 text-[12px] text-[#d6d6d4]">
                Highest probability weekly peak on XAUUSD
              </p>
              <div className="mt-3 flex items-center justify-between text-[11px]">
                <span className="text-[#a2a2a0]">Judas swing into premium</span>
                <span className="fm font-semibold text-[#00c853]">
                  {stats.dominantHowProbPct}% prob
                </span>
              </div>
            </div>

            {/* CARD 4: Dominant LOW Day (Red Accent) */}
            <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#12161c]/90 p-4.5 shadow-[0_10px_25px_-10px_rgba(0,0,0,0.6)] backdrop-blur-sm">
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#ff1744] to-transparent" />
              <div className="flex items-start justify-between">
                <span className="text-[11px] font-semibold tracking-wider text-[#a2a2a0] uppercase">
                  Dominant LOW Day
                </span>
                <div className="flex size-7 items-center justify-center rounded-md border border-[#ff1744]/30 bg-[#ff1744]/10 text-[#ff1744]">
                  <TrendingDown className="size-3.5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="fd text-[32px] font-medium leading-none text-[#ff1744]">
                  {stats.dominantLowDay}
                </span>
                <span className="fm text-[11px] text-[#ff1744]">Midweek Target</span>
              </div>
              <p className="mt-2 text-[12px] text-[#d6d6d4]">
                Midweek reversal or expansion discount tap
              </p>
              <div className="mt-3 flex items-center justify-between text-[11px]">
                <span className="text-[#a2a2a0]">Reversal / expansion cluster</span>
                <span className="fm font-semibold text-[#ff1744]">
                  {stats.dominantLowCount} of {stats.totalWeeks} ({stats.dominantLowPct}%)
                </span>
              </div>
            </div>
          </section>

          {/* ================= 3. MAIN CONTENT: TWO COLUMNS ================= */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* ================= LEFT COLUMN: DATA ENTRY FORM ================= */}
            <section
              ref={formRef}
              className="flex flex-col rounded-xl border border-white/[0.08] bg-[#0e1217]/95 p-5 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.8)] backdrop-blur-md lg:col-span-4"
            >
              <div className="flex items-center justify-between border-b border-white/[0.07] pb-3.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`size-2 rounded-full ${
                      editingId ? "bg-[#f5b942] shadow-[0_0_8px_#f5b942]" : "bg-[#00c853] shadow-[0_0_8px_#00c853]"
                    }`}
                  />
                  <h3 className="fd text-[20px] leading-none tracking-wide text-white">
                    {editingId ? `Edit Week Data (${weekInfo.weekNumber})` : "Add New Week Data"}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {editingId ? (
                    <button
                      type="button"
                      onClick={() => resetFormToAdd()}
                      className="fm flex items-center gap-1 rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-white cursor-pointer"
                      title="Cancel edit"
                    >
                      <X className="size-2.5" /> Cancel
                    </button>
                  ) : null}
                  <span className="fm rounded border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 text-[10px] text-[#a2a2a0]">
                    Institutional Log
                  </span>
                </div>
              </div>

              <form onSubmit={handleFormSubmit} className="mt-4 flex flex-col gap-4">
                {/* 1. Week Starting Date (Date picker) */}
                <div>
                  <label
                    htmlFor="week-start-date"
                    className="block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase"
                  >
                    Week Starting Date (Monday)
                  </label>
                  <div className="relative mt-1.5 flex h-10 items-center justify-between rounded-md border border-white/[0.09] bg-[#14181f]/80 px-3 text-[13px] text-white transition-colors focus-within:border-[#00c853]/60">
                    <input
                      id="week-start-date"
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="fm w-full bg-transparent text-white outline-none cursor-pointer [color-scheme:dark]"
                    />
                    <Calendar className="pointer-events-none absolute right-3 size-3.5 shrink-0 text-[#2979ff]" />
                  </div>
                  <p className="fm mt-1 text-[10px] text-[#a2a2a0]">
                    Cycle: {weekInfo.cycleLabel}
                  </p>
                </div>

                {/* 2. High of Week Day & Low of Week Day (2-col grid) */}
                <div className="grid grid-cols-2 gap-3">
                  {/* HOW Day */}
                  <div>
                    <label
                      htmlFor="how-day-select"
                      className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-[#00c853] uppercase"
                    >
                      <span className="size-1.5 rounded-full bg-[#00c853]" /> HOW Day
                    </label>
                    <div className="relative mt-1.5 flex h-10 items-center justify-between rounded-md border border-[#00c853]/30 bg-[#14181f]/80 px-3 text-[13px] text-white">
                      <select
                        id="how-day-select"
                        value={formHowDay}
                        onChange={(e) => setFormHowDay(e.target.value as WeekDay)}
                        className="w-full cursor-pointer appearance-none bg-transparent pr-4 font-medium text-[#00c853] outline-none"
                      >
                        {DAYS_OF_WEEK.map((d) => (
                          <option key={d} value={d} className="bg-[#14181f] text-white">
                            {d}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 size-3 text-[#a2a2a0]" />
                    </div>
                  </div>

                  {/* LOW Day */}
                  <div>
                    <label
                      htmlFor="low-day-select"
                      className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-[#ff1744] uppercase"
                    >
                      <span className="size-1.5 rounded-full bg-[#ff1744]" /> LOW Day
                    </label>
                    <div className="relative mt-1.5 flex h-10 items-center justify-between rounded-md border border-[#ff1744]/30 bg-[#14181f]/80 px-3 text-[13px] text-white">
                      <select
                        id="low-day-select"
                        value={formLowDay}
                        onChange={(e) => setFormLowDay(e.target.value as WeekDay)}
                        className="w-full cursor-pointer appearance-none bg-transparent pr-4 font-medium text-[#ff1744] outline-none"
                      >
                        {DAYS_OF_WEEK.map((d) => (
                          <option key={d} value={d} className="bg-[#14181f] text-white">
                            {d}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 size-3 text-[#a2a2a0]" />
                    </div>
                  </div>
                </div>

                {/* 3. Monday Behaviour Dropdown */}
                <div>
                  <label
                    htmlFor="monday-behaviour"
                    className="block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase"
                  >
                    Monday Behaviour
                  </label>
                  <div className="relative mt-1.5 flex h-10 items-center gap-2 rounded-md border border-white/[0.09] bg-[#14181f]/80 px-3 text-[13px] text-white">
                    <span
                      className={`size-2 shrink-0 rounded-full ${
                        formMonType.includes("Ranging")
                          ? "bg-[#2979ff]"
                          : formMonType.includes("Expansion")
                            ? "bg-[#f5b942]"
                            : formMonType.includes("Weak")
                              ? "bg-[#a2a2a0]"
                              : "bg-[#2979ff]"
                      }`}
                    />
                    <select
                      id="monday-behaviour"
                      value={formMonType}
                      onChange={(e) => setFormMonType(e.target.value)}
                      className="w-full cursor-pointer appearance-none bg-transparent pr-4 font-medium text-white outline-none"
                    >
                      {MONDAY_BEHAVIOURS.map((b) => (
                        <option key={b} value={b} className="bg-[#14181f] text-white">
                          {b}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 size-3 text-[#a2a2a0]" />
                  </div>
                </div>

                {/* 4. Tuesday Behaviour Dropdown */}
                <div>
                  <label
                    htmlFor="tuesday-behaviour"
                    className="block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase"
                  >
                    Tuesday Behaviour
                  </label>
                  <div className="relative mt-1.5 flex h-10 items-center gap-2 rounded-md border border-white/[0.09] bg-[#14181f]/80 px-3 text-[13px] text-white">
                    <span
                      className={`size-2 shrink-0 rounded-full ${
                        formTueType.includes("HOW")
                          ? "bg-[#00c853]"
                          : formTueType.includes("LOW")
                            ? "bg-[#ff1744]"
                            : "bg-[#2979ff]"
                      }`}
                    />
                    <select
                      id="tuesday-behaviour"
                      value={formTueType}
                      onChange={(e) => setFormTueType(e.target.value)}
                      className={`w-full cursor-pointer appearance-none bg-transparent pr-4 font-medium outline-none ${
                        formTueType.includes("HOW")
                          ? "text-[#00c853]"
                          : formTueType.includes("LOW")
                            ? "text-[#ff1744]"
                            : "text-[#2979ff]"
                      }`}
                    >
                      {TUESDAY_BEHAVIOURS.map((b) => (
                        <option key={b} value={b} className="bg-[#14181f] text-white">
                          {b}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 size-3 text-[#a2a2a0]" />
                  </div>
                </div>

                {/* 5. AMD Formation (Yes/No toggle) */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                      AMD Formation (A → M → D)
                    </span>
                    <span className="text-[10px] text-[#2979ff]">
                      Accumulation • Manipulation • Distribution
                    </span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 overflow-hidden rounded-md border border-white/[0.1] bg-[#14181f]/80 text-[13px] font-medium">
                    <button
                      type="button"
                      onClick={() => setFormAmd(true)}
                      className={`flex h-9 items-center justify-center gap-1.5 border-r border-white/[0.1] transition-all cursor-pointer ${
                        formAmd
                          ? "bg-[#00c853]/15 font-semibold text-[#00c853]"
                          : "text-[#a2a2a0] hover:text-white"
                      }`}
                    >
                      {formAmd ? <Check className="size-3.5 stroke-[2.5]" /> : null}
                      <span>Yes (Confirmed)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormAmd(false)}
                      className={`flex h-9 items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        !formAmd
                          ? "bg-white/[0.08] font-semibold text-white"
                          : "text-[#a2a2a0] hover:text-white"
                      }`}
                    >
                      {!formAmd ? <Check className="size-3.5 stroke-[2.5]" /> : null}
                      <span>No (Distorted)</span>
                    </button>
                  </div>
                </div>

                {/* 6. Notes (Textarea) */}
                <div>
                  <label
                    htmlFor="algorithmic-notes"
                    className="block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase"
                  >
                    Algorithmic Notes &amp; Confluences (XAUUSD)
                  </label>
                  <textarea
                    id="algorithmic-notes"
                    rows={3}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="fm mt-1.5 w-full rounded-md border border-white/[0.09] bg-[#14181f]/80 p-3 text-[12px] leading-relaxed text-[#f5f5f4] placeholder-[#666] transition-colors focus:border-[#00c853]/60 focus:outline-none"
                    placeholder="e.g. Classic Tuesday Judas swing swept Asian 3,514.80 liquidity into London 4H FVG. Reversal targeted opposing Sell-Side Liquidity (SSL) into Thursday NY PM."
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#00c853] text-[13px] font-semibold text-black shadow-[0_10px_25px_-10px_rgba(0,200,83,0.8)] transition-all hover:bg-[#00e676] cursor-pointer active:scale-[0.98]"
                >
                  {editingId ? (
                    <>
                      <Check className="size-4 stroke-[2.5]" />
                      <span>Update Week Profile</span>
                    </>
                  ) : (
                    <>
                      <PlusCircle className="size-4 stroke-[2.5]" />
                      <span>Submit Week Profile</span>
                    </>
                  )}
                </button>
              </form>
            </section>

            {/* ================= RIGHT COLUMN: WEEKLY RECORDS TABLE ================= */}
            <section className="flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#0e1217]/95 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.8)] backdrop-blur-md lg:col-span-8">
              {/* Table Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-8 items-center gap-2 rounded-md border border-white/[0.08] bg-[#14181f] px-2.5 text-[12px] text-[#a2a2a0]">
                    <Search className="size-3.5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Filter week, day, notes..."
                      className="w-44 bg-transparent text-[12px] text-white placeholder-[#666] outline-none sm:w-56"
                    />
                    {searchQuery ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setCurrentPage(1);
                        }}
                        className="text-zinc-500 hover:text-white cursor-pointer"
                      >
                        <X className="size-3" />
                      </button>
                    ) : null}
                  </div>
                  <span className="fm rounded border border-[#2979ff]/30 bg-[#2979ff]/10 px-2 py-0.5 text-[11px] text-[#2979ff]">
                    {filteredRecords.length} Historical Cycles (XAUUSD)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFilters((prev) => !prev)}
                    className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] transition-colors cursor-pointer ${
                      showFilters || filterAmd !== "all" || filterDay !== "all"
                        ? "border-[#2979ff]/50 bg-[#2979ff]/15 text-white"
                        : "border-white/[0.09] bg-white/[0.03] text-[#d6d6d4] hover:bg-white/[0.06]"
                    }`}
                  >
                    <SlidersHorizontal className="size-3" />
                    <span>Filter</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="flex h-8 items-center gap-1.5 rounded-md border border-white/[0.09] bg-white/[0.03] px-2.5 text-[12px] text-[#d6d6d4] transition-colors hover:bg-white/[0.06] cursor-pointer"
                  >
                    <Download className="size-3" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Collapsible Filter Bar */}
              {showFilters ? (
                <div className="flex flex-wrap items-center gap-4 border-b border-white/[0.06] bg-[#12161c]/80 px-5 py-2.5 text-[12px]">
                  <div className="flex items-center gap-2">
                    <span className="text-[#a2a2a0]">AMD Formation:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterAmd("all");
                        setCurrentPage(1);
                      }}
                      className={`rounded px-2 py-0.5 text-[11px] cursor-pointer ${
                        filterAmd === "all" ? "bg-white/10 text-white font-medium" : "text-[#a2a2a0]"
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterAmd("yes");
                        setCurrentPage(1);
                      }}
                      className={`rounded px-2 py-0.5 text-[11px] cursor-pointer ${
                        filterAmd === "yes" ? "bg-[#00c853]/20 text-[#00c853] font-medium" : "text-[#a2a2a0]"
                      }`}
                    >
                      YES Only
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterAmd("no");
                        setCurrentPage(1);
                      }}
                      className={`rounded px-2 py-0.5 text-[11px] cursor-pointer ${
                        filterAmd === "no" ? "bg-white/10 text-zinc-300 font-medium" : "text-[#a2a2a0]"
                      }`}
                    >
                      NO Only
                    </button>
                  </div>

                  <div className="h-4 w-px bg-white/[0.08]" />

                  <div className="flex items-center gap-2">
                    <span className="text-[#a2a2a0]">HOW/LOW Day:</span>
                    <select
                      value={filterDay}
                      onChange={(e) => {
                        setFilterDay(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="rounded border border-white/[0.1] bg-[#14181f] px-2 py-0.5 text-[11px] text-white outline-none cursor-pointer"
                    >
                      <option value="all">Any Day</option>
                      {DAYS_OF_WEEK.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(filterAmd !== "all" || filterDay !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterAmd("all");
                        setFilterDay("all");
                        setCurrentPage(1);
                      }}
                      className="ml-auto text-[11px] text-[#ff6b7d] hover:underline cursor-pointer"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : null}

              {/* Clean Dark Table */}
              <div className="min-h-0 flex-1 overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="h-9 border-b border-white/[0.06] bg-[#12161c]/60 text-[10px] font-semibold tracking-wider text-[#a2a2a0] uppercase select-none">
                      <th
                        className="pr-3 pl-5 cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSortToggle("week")}
                      >
                        <div className="flex items-center gap-1">
                          <span>Week</span>
                          {sortColumn === "week" ? (
                            sortDirection === "asc" ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />
                          ) : (
                            <ArrowUpDown className="size-2.5 opacity-40" />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-3 cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSortToggle("how")}
                      >
                        <div className="flex items-center gap-1">
                          <span>HOW Day</span>
                          {sortColumn === "how" ? (
                            sortDirection === "asc" ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />
                          ) : (
                            <ArrowUpDown className="size-2.5 opacity-40" />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-3 cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSortToggle("low")}
                      >
                        <div className="flex items-center gap-1">
                          <span>LOW Day</span>
                          {sortColumn === "low" ? (
                            sortDirection === "asc" ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />
                          ) : (
                            <ArrowUpDown className="size-2.5 opacity-40" />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-3 cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSortToggle("monType")}
                      >
                        <div className="flex items-center gap-1">
                          <span>Monday Type</span>
                          {sortColumn === "monType" ? (
                            sortDirection === "asc" ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />
                          ) : (
                            <ArrowUpDown className="size-2.5 opacity-40" />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-3 cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSortToggle("tueType")}
                      >
                        <div className="flex items-center gap-1">
                          <span>Tuesday Type</span>
                          {sortColumn === "tueType" ? (
                            sortDirection === "asc" ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />
                          ) : (
                            <ArrowUpDown className="size-2.5 opacity-40" />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-3 text-center cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSortToggle("amd")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>AMD</span>
                          {sortColumn === "amd" ? (
                            sortDirection === "asc" ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />
                          ) : (
                            <ArrowUpDown className="size-2.5 opacity-40" />
                          )}
                        </div>
                      </th>
                      <th className="px-3">Confluence Notes (XAUUSD)</th>
                      <th className="pr-5 pl-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {paginatedRecords.length > 0 ? (
                      paginatedRecords.map((r, idx) => {
                        const isSelected = r.id === selectedWeekId;
                        const isMonRanging = r.monType.toLowerCase().includes("ranging");
                        const isMonExpansion = r.monType.toLowerCase().includes("expansion");

                        return (
                          <tr
                            key={r.id}
                            onClick={() => setSelectedWeekId(r.id)}
                            className={`group h-12 transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-[#e50914]/[0.08] border-l-2 border-[#e50914]"
                                : idx % 2 === 0
                                  ? "bg-white/[0.02] hover:bg-white/[0.05]"
                                  : "hover:bg-white/[0.04]"
                            }`}
                          >
                            <td className="pr-3 pl-5 font-semibold whitespace-nowrap text-white">
                              <span className="fm">{r.weekNumber}</span>
                              <span className="ml-1 text-[11px] text-[#a2a2a0]">{r.dateLabel}</span>
                            </td>
                            <td className="px-3 font-semibold whitespace-nowrap text-[#00c853]">
                              <span className="rounded border border-[#00c853]/30 bg-[#00c853]/15 px-2 py-0.5">
                                {r.howDay.slice(0, 3)} (HOW)
                              </span>
                            </td>
                            <td className="px-3 font-semibold whitespace-nowrap text-[#ff1744]">
                              <span className="rounded border border-[#ff1744]/30 bg-[#ff1744]/15 px-2 py-0.5">
                                {r.lowDay.slice(0, 3)} (LOW)
                              </span>
                            </td>
                            <td className="px-3 whitespace-nowrap text-[#d6d6d4]">
                              <span className="flex items-center gap-1.5">
                                <span
                                  className={`size-1.5 rounded-full ${
                                    isMonRanging
                                      ? "bg-[#2979ff]"
                                      : isMonExpansion
                                        ? "bg-[#f5b942]"
                                        : "bg-[#a2a2a0]"
                                  }`}
                                />
                                {r.monType}
                              </span>
                            </td>
                            <td
                              className={`px-3 font-medium whitespace-nowrap ${
                                r.tueType.includes("HOW")
                                  ? "text-[#00c853]"
                                  : r.tueType.includes("LOW")
                                    ? "text-[#ff1744]"
                                    : "text-[#2979ff]"
                              }`}
                            >
                              {r.tueType}
                            </td>
                            <td className="px-3 text-center">
                              {r.amd ? (
                                <span className="rounded bg-[#00c853]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#00c853]">
                                  YES
                                </span>
                              ) : (
                                <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold text-[#a2a2a0]">
                                  NO
                                </span>
                              )}
                            </td>
                            <td
                              className="max-w-[240px] truncate px-3 text-[#a2a2a0]"
                              title={r.notes}
                            >
                              {r.notes || "—"}
                            </td>
                            <td className="pr-5 pl-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5 opacity-70 transition-opacity group-hover:opacity-100">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditClick(r);
                                  }}
                                  className="p-1 text-[#a2a2a0] transition-colors hover:text-white cursor-pointer"
                                  title="Edit row"
                                  aria-label={`Edit ${r.weekNumber}`}
                                >
                                  <Pencil className="size-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClick(r);
                                  }}
                                  className="p-1 text-[#a2a2a0] transition-colors hover:text-[#ff1744] cursor-pointer"
                                  title="Delete row"
                                  aria-label={`Delete ${r.weekNumber}`}
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-[#a2a2a0]">
                          <p className="text-[13px]">No weekly profiles match your filter.</p>
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery("");
                              setFilterAmd("all");
                              setFilterDay("all");
                              setCurrentPage(1);
                            }}
                            className="mt-2 text-[11px] text-[#00c853] hover:underline cursor-pointer"
                          >
                            Reset filters
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer Pagination / Summary */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] bg-[#0c1015]/60 px-5 py-3 text-[12px] text-[#a2a2a0]">
                <span className="fm">
                  Showing {paginatedRecords.length} of {filteredRecords.length} tracked weekly profiles ·{" "}
                  <span className="text-[#00c853]">Tuesday HOW frequency: {stats.howFormationPct}%</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="fm text-[11px]">
                    Page {validPage} of {totalPages}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={validPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className={`flex size-7 items-center justify-center rounded border border-white/[0.08] transition-colors ${
                        validPage <= 1
                          ? "bg-white/[0.02] text-[#666] cursor-not-allowed opacity-50"
                          : "bg-white/[0.04] text-white hover:bg-white/[0.08] cursor-pointer"
                      }`}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="size-3" />
                    </button>
                    <button
                      type="button"
                      disabled={validPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className={`flex size-7 items-center justify-center rounded border border-white/[0.08] transition-colors ${
                        validPage >= totalPages
                          ? "bg-white/[0.02] text-[#666] cursor-not-allowed opacity-50"
                          : "bg-white/[0.04] text-white hover:bg-white/[0.08] cursor-pointer"
                      }`}
                      aria-label="Next page"
                    >
                      <ChevronRight className="size-3" />
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* ================= 4. BOTTOM SECTION: LEGEND & TERMINAL FOOTER ================= */}
          <footer className="mt-8 border-t border-white/[0.07] pt-5 pb-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Color Codes Legend */}
              <div className="flex flex-wrap items-center gap-6 text-[12px]">
                <span className="text-[10px] font-semibold tracking-wide text-white uppercase">
                  Technical Legend:
                </span>

                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-[#00c853] shadow-[0_0_8px_#00c853]" />
                  <span className="text-[#d6d6d4]">High of the Week (HOW)</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-[#ff1744] shadow-[0_0_8px_#ff1744]" />
                  <span className="text-[#d6d6d4]">Low of the Week (LOW)</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-[#2979ff] shadow-[0_0_8px_#2979ff]" />
                  <span className="text-[#d6d6d4]">Equilibrium / Accumulation</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-[#f5b942]" />
                  <span className="text-[#d6d6d4]">Expansion / Judas Run</span>
                </div>
              </div>

              {/* ICT Concepts Terminal Info */}
              <div className="fm flex items-center gap-2 text-[11px] text-[#a2a2a0]">
                <Shield className="size-3.5 text-[#e50914]" />
                <span>ICT Concepts • Weekly Manipulation Range Tracker v2.4</span>
                <span>•</span>
                <span className="text-[#00c853]">XAUUSD Institutional Engine</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </AppShell>
  );
}
