import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Calendar, ChevronDown, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { deskSnapshot, useDeskStore } from "@/lib/ict-store";
import { syncDeskToServer } from "@/lib/desk-sync";
import { calcTradeMetrics, fmtCurrency, instrumentOf } from "@/lib/ict-calc";
import { emptyTrade } from "@/lib/ict-defaults";
import { nowHHMM, todayISO } from "@/lib/ict-time";
import { cn, formatR } from "@/lib/utils";
import type { Grade, Side, Trade, TradeResult } from "@/lib/ict-types";

interface TradeFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: Trade | null;
  onSaved?: (trade: Trade) => void;
}

const GRADES: Grade[] = ["A+", "A", "A-", "B", "C", "D", "F"];

export function TradeFormModal({ open, onOpenChange, trade, onSaved }: TradeFormModalProps) {
  const models = useDeskStore((s) => s.models);
  const instruments = useDeskStore((s) => s.instruments);
  const rules = useDeskStore((s) => s.rules);
  const data = useDeskStore();
  const upsertTrade = useDeskStore((s) => s.upsertTrade);

  const [activeTab, setActiveTab] = useState<"execution" | "ict">("execution");
  const [saving, setSaving] = useState(false);

  // Form states
  const [symbol, setSymbol] = useState("XAUUSD");
  const [side, setSide] = useState<Side>("long");
  const [position, setPosition] = useState<"open" | "closed">("closed");
  const [entryDate, setEntryDate] = useState(() => todayISO());
  const [entryTime, setEntryTime] = useState(() => nowHHMM());
  const [exitDate, setExitDate] = useState(() => todayISO());
  const [exitTime, setExitTime] = useState("");
  const [lots, setLots] = useState("0.25");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [fees, setFees] = useState("1.75");
  const [stopLoss, setStopLoss] = useState("");
  const [target, setTarget] = useState("");
  const [maeR, setMaeR] = useState("");
  const [mfeR, setMfeR] = useState("");
  const [modelId, setModelId] = useState("");
  const [notes, setNotes] = useState("");
  const [grade, setGrade] = useState<Grade | "">("");
  const [reviewed, setReviewed] = useState(false);
  const [setupTags, setSetupTags] = useState<string[]>([]);
  const [mistakeTags, setMistakeTags] = useState<string[]>([]);
  const [newSetupTag, setNewSetupTag] = useState("");
  const [newMistakeTag, setNewMistakeTag] = useState("");
  const [addingSetup, setAddingSetup] = useState(false);
  const [addingMistake, setAddingMistake] = useState(false);
  const [rulesAssessment, setRulesAssessment] = useState<Record<string, "followed" | "not" | "na">>({});

  // Reset form when modal opens or trade changes
  useEffect(() => {
    if (!open) return;
    setActiveTab("execution");
    if (trade) {
      setSymbol(trade.market || "XAUUSD");
      setSide(trade.side || "long");
      setPosition(trade.result === "open" ? "open" : "closed");
      setEntryDate(trade.date || todayISO());
      setEntryTime(trade.time || nowHHMM());
      setExitDate(trade.exitDate || trade.date || todayISO());
      setExitTime(trade.exitTime || "");
      setLots(trade.lots != null ? String(trade.lots) : "0.25");
      setEntryPrice(trade.entry != null ? String(trade.entry) : "");
      setExitPrice(trade.exitPrice != null ? String(trade.exitPrice) : "");
      setFees(trade.fees != null ? String(trade.fees) : "1.75");
      setStopLoss(trade.sl != null ? String(trade.sl) : "");
      setTarget(trade.tp1 != null ? String(trade.tp1) : "");
      setMaeR(trade.maeR != null ? String(trade.maeR) : "");
      setMfeR(trade.mfeR != null ? String(trade.mfeR) : "");
      setModelId(trade.modelId || (models[0]?.id ?? ""));
      setNotes(trade.notes || "");
      setGrade(trade.grade || "");
      setReviewed(Boolean(trade.reviewed));
      setSetupTags(trade.setupTags ? [...trade.setupTags] : trade.tags ? [...trade.tags] : []);
      setMistakeTags(trade.mistakeTags ? [...trade.mistakeTags] : []);
      setRulesAssessment(trade.rulesAssessment ? { ...trade.rulesAssessment } : {});
    } else {
      const activeModel = models.find((m) => m.active) ?? models[0];
      setSymbol("XAUUSD");
      setSide("long");
      setPosition("closed");
      setEntryDate(todayISO());
      setEntryTime(nowHHMM());
      setExitDate(todayISO());
      setExitTime("");
      setLots("0.25");
      setEntryPrice("");
      setExitPrice("");
      setFees("1.75");
      setStopLoss("");
      setTarget("");
      setMaeR("");
      setMfeR("");
      setModelId(activeModel?.id ?? "");
      setNotes("");
      setGrade("");
      setReviewed(false);
      setSetupTags(["NY AM"]);
      setMistakeTags([]);
      setRulesAssessment({});
    }
  }, [open, trade, models]);

  const activeInstrument = instrumentOf(data, symbol) ?? instruments[0];

  const parsedEntry = entryPrice.trim() !== "" ? Number(entryPrice) : null;
  const parsedExit = exitPrice.trim() !== "" ? Number(exitPrice) : null;
  const parsedSl = stopLoss.trim() !== "" ? Number(stopLoss) : null;
  const parsedTarget = target.trim() !== "" ? Number(target) : null;
  const parsedLots = lots.trim() !== "" ? Number(lots) : null;
  const parsedFees = fees.trim() !== "" ? Number(fees) : 0;

  // Live calculations
  const metrics = useMemo(() => {
    return calcTradeMetrics(
      {
        side,
        entry: parsedEntry,
        sl: parsedSl,
        exitPrice: position === "open" ? null : parsedExit,
        tp1: parsedTarget,
        lots: parsedLots,
        fees: parsedFees,
      },
      activeInstrument,
    );
  }, [side, parsedEntry, parsedSl, parsedExit, parsedTarget, parsedLots, parsedFees, position, activeInstrument]);

  const selectedModel = models.find((m) => m.id === modelId) ?? models[0];

  const handleSave = async () => {
    const numericLots = parsedLots && !Number.isNaN(parsedLots) ? parsedLots : 0.25;
    const numericEntry = parsedEntry && !Number.isNaN(parsedEntry) ? parsedEntry : null;
    const numericExit = position === "closed" && parsedExit && !Number.isNaN(parsedExit) ? parsedExit : null;
    const numericSl = parsedSl && !Number.isNaN(parsedSl) ? parsedSl : null;
    const numericTarget = parsedTarget && !Number.isNaN(parsedTarget) ? parsedTarget : null;
    const numericMae = maeR.trim() !== "" && !Number.isNaN(Number(maeR)) ? Number(maeR) : null;
    const numericMfe = mfeR.trim() !== "" && !Number.isNaN(Number(mfeR)) ? Number(mfeR) : null;

    let tradeResult: TradeResult = "open";
    if (position === "closed") {
      if (metrics.realizedR != null) {
        if (metrics.realizedR > 0.15) tradeResult = "win";
        else if (metrics.realizedR < -0.15) tradeResult = "loss";
        else tradeResult = "be";
      } else {
        tradeResult = "win";
      }
    }

    const calculatedR = position === "closed" ? metrics.realizedR : null;

    const base = trade ?? emptyTrade(entryDate, entryTime, rules.normalRiskPct, selectedModel);

    const updatedTrade: Trade = {
      ...base,
      id: trade?.id ?? `tr-${Date.now()}`,
      date: entryDate,
      time: entryTime,
      exitDate: position === "closed" ? exitDate : undefined,
      exitTime: position === "closed" ? exitTime : "",
      market: symbol,
      side,
      modelId: selectedModel?.id ?? "",
      modelName: selectedModel?.name ?? "",
      lots: numericLots,
      entry: numericEntry,
      exitPrice: numericExit,
      fees: parsedFees,
      sl: numericSl,
      tp1: numericTarget,
      targetPrice: numericTarget,
      maeR: numericMae,
      mfeR: numericMfe,
      result: tradeResult,
      rMultiple: calculatedR,
      grossPnL: position === "closed" ? metrics.grossPnL : null,
      netPnL: position === "closed" ? metrics.netPnL : null,
      notes: notes.trim(),
      grade: (grade as Grade) || "",
      reviewed,
      tags: [...setupTags, ...mistakeTags],
      setupTags: [...setupTags],
      mistakeTags: [...mistakeTags],
      rulesAssessment: { ...rulesAssessment },
      ruleFollowed: Object.values(rulesAssessment).filter((v) => v === "not").length === 0,
    };

    setSaving(true);
    const prevTrades = useDeskStore.getState().trades;
    try {
      upsertTrade(updatedTrade);
      const snapshot = deskSnapshot();
      await syncDeskToServer(snapshot);
      toast.success(trade ? "Trade updated successfully" : "Trade logged successfully");
      onSaved?.(updatedTrade);
      onOpenChange(false);
    } catch (error) {
      console.error("[trade-form] error saving trade:", error);
      useDeskStore.setState({ trades: prevTrades });
      toast.error("Failed to save trade to cloud. Check your connection.");
    } finally {
      setSaving(false);
    }
  };

  const addSetupTagItem = () => {
    const val = newSetupTag.trim();
    if (val && !setupTags.includes(val)) {
      setSetupTags([...setupTags, val]);
    }
    setNewSetupTag("");
    setAddingSetup(false);
  };

  const addMistakeTagItem = () => {
    const val = newMistakeTag.trim();
    if (val && !mistakeTags.includes(val)) {
      setMistakeTags([...mistakeTags, val]);
    }
    setNewMistakeTag("");
    setAddingMistake(false);
  };

  const toggleRule = (key: string, value: "followed" | "not" | "na") => {
    setRulesAssessment((prev) => ({
      ...prev,
      [key]: prev[key] === value ? "na" : value,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby="trade-form-description"
        className="max-h-[90vh] w-[95vw] max-w-[740px] overflow-hidden rounded-xl border border-white/[0.1] bg-[#0e0e0e] p-0 text-[#f5f5f4] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.95)] sm:max-w-[720px]"
      >
        <DialogTitle className="sr-only">{trade ? "Edit trade" : "Log trade"}</DialogTitle>
        <DialogDescription id="trade-form-description" className="sr-only">
          Fill in execution and ICT review details for this trade.
        </DialogDescription>

        {/* Modal Header - DialogContent provides top-4 right-4 close button, pr-14 ensures clean spacing */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.07] pl-6 pr-14">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="font-display text-[22px] sm:text-[24px] font-bold leading-none text-white truncate">
              {trade ? "Edit trade" : "Log trade"}
            </h2>
            <span className="font-mono text-[12px] text-[#a2a2a0] shrink-0">
              {entryDate ? new Date(entryDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Today"},{" "}
              {entryTime || "09:48"} ET
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex h-10 shrink-0 items-end gap-6 border-b border-white/[0.07] px-6 text-[11px] font-semibold tracking-[0.14em] uppercase">
          <button
            type="button"
            onClick={() => setActiveTab("execution")}
            className={cn(
              "pb-2.5 transition-colors",
              activeTab === "execution"
                ? "border-b-2 border-[#e50914] text-white"
                : "text-[#a2a2a0] hover:text-white",
            )}
          >
            Execution
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ict")}
            className={cn(
              "pb-2.5 transition-colors",
              activeTab === "ict"
                ? "border-b-2 border-[#e50914] text-white"
                : "text-[#a2a2a0] hover:text-white",
            )}
          >
            ICT &amp; review
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="max-h-[calc(90vh-140px)] min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {activeTab === "execution" ? (
            <div className="space-y-4">
              {/* Row 1: Symbol, Side, Position */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                    Symbol
                  </label>
                  <div className="relative">
                    <select
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value)}
                      aria-label="Symbol"
                      className="flex h-10 w-full appearance-none items-center justify-between rounded-md border border-white/[0.09] bg-[#151515]/90 px-3 pr-8 text-[13px] font-semibold text-white outline-none focus-visible:border-[#e50914]"
                    >
                      {instruments.map((inst) => (
                        <option key={inst.id} value={inst.symbol} className="bg-[#151515] text-white">
                          {inst.symbol}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute top-3 right-3 size-4 text-[#a2a2a0]" />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                    Side
                  </label>
                  <div className="grid h-10 grid-cols-2 overflow-hidden rounded-md border border-white/[0.1] text-[13px] font-medium">
                    <button
                      type="button"
                      onClick={() => setSide("long")}
                      className={cn(
                        "flex items-center justify-center transition-colors",
                        side === "long"
                          ? "bg-[#3ddc84]/15 font-semibold text-[#3ddc84]"
                          : "text-[#a2a2a0] hover:text-white",
                      )}
                    >
                      Long
                    </button>
                    <button
                      type="button"
                      onClick={() => setSide("short")}
                      className={cn(
                        "flex items-center justify-center border-l border-white/[0.1] transition-colors",
                        side === "short"
                          ? "bg-[#ff6b7d]/15 font-semibold text-[#ff6b7d]"
                          : "text-[#a2a2a0] hover:text-white",
                      )}
                    >
                      Short
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                    Position
                  </label>
                  <div className="grid h-10 grid-cols-2 overflow-hidden rounded-md border border-white/[0.1] text-[13px] font-medium">
                    <button
                      type="button"
                      onClick={() => setPosition("open")}
                      className={cn(
                        "flex items-center justify-center transition-colors",
                        position === "open"
                          ? "bg-[#f5b942]/15 font-semibold text-[#f5b942]"
                          : "text-[#a2a2a0] hover:text-white",
                      )}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosition("closed")}
                      className={cn(
                        "flex items-center justify-center border-l border-white/[0.1] transition-colors",
                        position === "closed"
                          ? "bg-white/[0.08] font-semibold text-white"
                          : "text-[#a2a2a0] hover:text-white",
                      )}
                    >
                      Closed
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Entry date/time & Exit date/time */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                    Entry date &amp; time (ET)
                  </label>
                  <div className="grid grid-cols-[1fr_96px] gap-2">
                    <div className="relative">
                      <Input
                        type="date"
                        value={entryDate}
                        onChange={(e) => setEntryDate(e.target.value)}
                        className="font-mono h-10 border-white/[0.09] bg-[#151515]/80 text-[13px] text-white"
                      />
                    </div>
                    <Input
                      type="text"
                      placeholder="09:48"
                      value={entryTime}
                      onChange={(e) => setEntryTime(e.target.value)}
                      className="font-mono h-10 border-white/[0.09] bg-[#151515]/80 text-[13px] text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                    Exit date &amp; time (ET)
                  </label>
                  <div className="grid grid-cols-[1fr_96px] gap-2">
                    <Input
                      type="date"
                      value={exitDate}
                      disabled={position === "open"}
                      onChange={(e) => setExitDate(e.target.value)}
                      className="font-mono h-10 border-white/[0.09] bg-[#151515]/80 text-[13px] text-white disabled:opacity-40"
                    />
                    <Input
                      type="text"
                      placeholder="10:36"
                      value={exitTime}
                      disabled={position === "open"}
                      onChange={(e) => setExitTime(e.target.value)}
                      className="font-mono h-10 border-white/[0.09] bg-[#151515]/80 text-[13px] text-white disabled:opacity-40"
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Trade parameters */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                    Lots
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.25"
                    value={lots}
                    onChange={(e) => setLots(e.target.value)}
                    className="font-mono h-10 border-white/[0.09] bg-[#151515]/80 text-[13px] text-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                    Entry price
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="3512.40"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    className="font-mono h-10 border-white/[0.09] bg-[#151515]/80 text-[13px] text-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                    Exit price
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="3500.20"
                    disabled={position === "open"}
                    value={exitPrice}
                    onChange={(e) => setExitPrice(e.target.value)}
                    className="font-mono h-10 border-white/[0.09] bg-[#151515]/80 text-[13px] text-white disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                    Fees ($)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="1.75"
                    value={fees}
                    onChange={(e) => setFees(e.target.value)}
                    className="font-mono h-10 border-white/[0.09] bg-[#151515]/80 text-[13px] text-white"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                    Stop loss
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="3517.40"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    className="font-mono h-10 border-white/[0.09] bg-[#151515]/80 text-[13px] text-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                    Target
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="3498.00"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="font-mono h-10 border-white/[0.09] bg-[#151515]/80 text-[13px] text-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                    MAE (R)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="-0.34"
                    value={maeR}
                    onChange={(e) => setMaeR(e.target.value)}
                    className="font-mono h-10 border-white/[0.09] bg-[#151515]/80 text-[13px] text-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                    MFE (R)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="2.62"
                    value={mfeR}
                    onChange={(e) => setMfeR(e.target.value)}
                    className="font-mono h-10 border-white/[0.09] bg-[#151515]/80 text-[13px] text-white"
                  />
                </div>
              </div>

              {/* Summary Statistics Bar */}
              <div className="grid grid-cols-3 gap-3 rounded-md border border-white/[0.08] bg-white/[0.025] p-3 sm:grid-cols-6">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-[#a2a2a0] uppercase">Risk</p>
                  <p className="font-mono mt-1 text-[15px] text-[#d6d6d4]">
                    {metrics.risk != null ? `$${metrics.risk.toFixed(2)}` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-[#a2a2a0] uppercase">Gross P&amp;L</p>
                  <p
                    className={cn(
                      "font-mono mt-1 text-[15px]",
                      metrics.grossPnL == null
                        ? "text-[#6f6f6d]"
                        : metrics.grossPnL >= 0
                          ? "text-[#3ddc84]"
                          : "text-[#ff6b7d]",
                    )}
                  >
                    {fmtCurrency(metrics.grossPnL)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-[#a2a2a0] uppercase">Fees</p>
                  <p className="font-mono mt-1 text-[15px] text-[#d6d6d4]">
                    {metrics.fees > 0 ? `−$${metrics.fees.toFixed(2)}` : "$0.00"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-[#a2a2a0] uppercase">Net P&amp;L</p>
                  <p
                    className={cn(
                      "font-mono mt-1 text-[15px] font-semibold",
                      metrics.netPnL == null
                        ? "text-[#6f6f6d]"
                        : metrics.netPnL >= 0
                          ? "text-[#3ddc84]"
                          : "text-[#ff6b7d]",
                    )}
                  >
                    {fmtCurrency(metrics.netPnL)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-[#a2a2a0] uppercase">Planned R</p>
                  <p className="font-mono mt-1 text-[15px] text-[#d6d6d4]">
                    {metrics.plannedR != null ? `${metrics.plannedR}R` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-[#a2a2a0] uppercase">Realized R</p>
                  <p
                    className={cn(
                      "font-mono mt-1 text-[15px]",
                      metrics.realizedR == null
                        ? "text-[#6f6f6d]"
                        : metrics.realizedR >= 0
                          ? "text-[#3ddc84]"
                          : "text-[#ff6b7d]",
                    )}
                  >
                    {metrics.realizedR != null ? formatR(metrics.realizedR) : "—"}
                  </p>
                </div>
              </div>

              <p className="font-mono text-[11px] text-[#6f6f6d]">
                {activeInstrument.symbol} · tick {activeInstrument.tickSize} · $
                {activeInstrument.tickValuePerLot.toFixed(2)} per tick per lot
              </p>

              {/* Playbook selector */}
              <div>
                <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                  Playbook
                </label>
                <div className="relative">
                  <select
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                    aria-label="Playbook"
                    className="flex h-10 w-full appearance-none items-center justify-between rounded-md border border-white/[0.09] bg-[#151515]/80 px-3 pr-8 text-[13px] text-white outline-none focus-visible:border-[#e50914]"
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id} className="bg-[#151515] text-white">
                        [{m.code}] {m.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-3 right-3 size-4 text-[#a2a2a0]" />
                </div>
              </div>

              {/* Trade Note */}
              <div>
                <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                  Trade note
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Asia high and PDH swept at 09:31. 5m MSS at 09:44, filled the FVG at 3,512.40..."
                  className="min-h-24 resize-y border-white/[0.09] bg-[#151515]/80 p-3 text-[13px] leading-relaxed text-[#e8e8e6]"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Grade / Confluence Tier */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                    Setup Confluence Tier
                  </label>
                  {selectedModel && (
                    <span className="font-mono text-[11px] text-amber-400">
                      [{selectedModel.code}] {selectedModel.name}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {GRADES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGrade(g)}
                      className={cn(
                        "font-mono flex h-8 min-w-9 items-center justify-center rounded-md border px-2.5 text-[12px] font-semibold transition-colors",
                        grade === g
                          ? "border-[#e50914] bg-[#e50914] text-white shadow-sm"
                          : "border-white/[0.1] bg-white/[0.03] text-[#a2a2a0] hover:border-white/[0.2] hover:text-white",
                      )}
                    >
                      Tier {g}
                    </button>
                  ))}
                  {grade && (
                    <button
                      type="button"
                      onClick={() => setGrade("")}
                      className="ml-2 text-[12px] text-[#6f6f6d] hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Setup Tags */}
              <div>
                <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                  Setup Tags
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {setupTags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 rounded-md border border-white/[0.12] bg-white/[0.04] px-2.5 py-1 text-[12px] text-white"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => setSetupTags(setupTags.filter((t) => t !== tag))}
                        className="text-[#a2a2a0] hover:text-white"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                  {addingSetup ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="text"
                        placeholder="Tag name"
                        value={newSetupTag}
                        onChange={(e) => setNewSetupTag(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSetupTagItem())}
                        className="h-8 w-28 text-[12px]"
                        autoFocus
                      />
                      <Button size="sm" type="button" onClick={addSetupTagItem} className="h-8 px-2 text-xs">
                        Add
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingSetup(true)}
                      className="rounded-md border border-dashed border-white/[0.14] px-2.5 py-1 text-[12px] text-[#a2a2a0] transition-colors hover:border-white/[0.3] hover:text-white"
                    >
                      + Add tag
                    </button>
                  )}
                </div>
              </div>

              {/* Mistake Tags */}
              <div>
                <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                  Mistake Tags
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {mistakeTags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 rounded-md border border-[#f5b942]/30 bg-[#f5b942]/10 px-2.5 py-1 text-[12px] text-[#f5b942]"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => setMistakeTags(mistakeTags.filter((t) => t !== tag))}
                        className="text-[#f5b942]/80 hover:text-white"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                  {addingMistake ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="text"
                        placeholder="Mistake"
                        value={newMistakeTag}
                        onChange={(e) => setNewMistakeTag(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMistakeTagItem())}
                        className="h-8 w-28 text-[12px]"
                        autoFocus
                      />
                      <Button size="sm" type="button" onClick={addMistakeTagItem} className="h-8 px-2 text-xs">
                        Add
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingMistake(true)}
                      className="rounded-md border border-dashed border-white/[0.14] px-2.5 py-1 text-[12px] text-[#a2a2a0] transition-colors hover:border-white/[0.3] hover:text-white"
                    >
                      + Add mistake
                    </button>
                  )}
                </div>
              </div>

              {/* Rules Checklist */}
              <div className="space-y-4 rounded-xl border border-white/[0.08] bg-[#121212] p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold text-white">Execution Rules Checklist</h3>
                  <span className="font-mono text-[11px] text-[#a2a2a0]">
                    {Object.values(rulesAssessment).filter((v) => v === "followed").length} of{" "}
                    {Object.keys(rulesAssessment).length || 10} followed
                  </span>
                </div>

                {/* Selected Playbook Specific Criteria */}
                {selectedModel?.validWhen?.length ? (
                  <div className="space-y-2 rounded-lg border border-[#e50914]/20 bg-[#e50914]/5 p-3">
                    <p className="text-[10px] font-semibold tracking-[0.14em] text-[#e50914] uppercase">
                      [{selectedModel.code}] {selectedModel.name} Playbook Confluence
                    </p>
                    {selectedModel.validWhen.map((r, i) => {
                      const ruleKey = `model_rule_${i}`;
                      const st = rulesAssessment[ruleKey] ?? "followed";
                      return (
                        <div
                          key={ruleKey}
                          className="flex min-h-10 items-center justify-between gap-3 border-b border-white/[0.05] py-1.5 text-[13px] last:border-b-0"
                        >
                          <span className="text-white font-medium">{r}</span>
                          <div className="flex shrink-0 overflow-hidden rounded-md border border-white/[0.1] text-[11px] font-medium">
                            <button
                              type="button"
                              onClick={() => toggleRule(ruleKey, "followed")}
                              className={cn(
                                "px-2.5 py-1 transition-colors",
                                st === "followed" ? "bg-[#3ddc84]/20 text-[#3ddc84]" : "text-[#a2a2a0]",
                              )}
                            >
                              Followed
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleRule(ruleKey, "not")}
                              className={cn(
                                "border-l border-white/[0.1] px-2.5 py-1 transition-colors",
                                st === "not" ? "bg-[#ff6b7d]/20 text-[#ff6b7d]" : "text-[#a2a2a0]",
                              )}
                            >
                              Not
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleRule(ruleKey, "na")}
                              className={cn(
                                "border-l border-white/[0.1] px-2.5 py-1 transition-colors",
                                st === "na" ? "bg-white/[0.1] text-white" : "text-[#a2a2a0]",
                              )}
                            >
                              N/A
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {/* Market conditions */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold tracking-[0.14em] text-[#a2a2a0] uppercase">
                    Market conditions
                  </p>
                  {[
                    { key: "htf_bias", label: "HTF bias aligned on 4H and 1H" },
                    { key: "premium_discount", label: "Price trading in premium/discount of dealing range" },
                    { key: "no_news", label: "No high-impact news within 30 min" },
                  ].map((r) => {
                    const st = rulesAssessment[r.key] ?? "followed";
                    return (
                      <div
                        key={r.key}
                        className="flex min-h-10 items-center justify-between gap-3 border-b border-white/[0.05] py-1.5 text-[13px]"
                      >
                        <span className="text-[#e8e8e6]">{r.label}</span>
                        <div className="flex shrink-0 overflow-hidden rounded-md border border-white/[0.1] text-[11px] font-medium">
                          <button
                            type="button"
                            onClick={() => toggleRule(r.key, "followed")}
                            className={cn(
                              "px-2.5 py-1 transition-colors",
                              st === "followed" ? "bg-[#3ddc84]/15 text-[#3ddc84]" : "text-[#a2a2a0]",
                            )}
                          >
                            Followed
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleRule(r.key, "not")}
                            className={cn(
                              "border-l border-white/[0.1] px-2.5 py-1 transition-colors",
                              st === "not" ? "bg-[#ff6b7d]/15 text-[#ff6b7d]" : "text-[#a2a2a0]",
                            )}
                          >
                            Not
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleRule(r.key, "na")}
                            className={cn(
                              "border-l border-white/[0.1] px-2.5 py-1 transition-colors",
                              st === "na" ? "bg-white/[0.1] text-white" : "text-[#a2a2a0]",
                            )}
                          >
                            N/A
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Entry criteria */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold tracking-[0.14em] text-[#a2a2a0] uppercase">
                    Entry criteria
                  </p>
                  {[
                    { key: "sweep", label: "Liquidity swept before entry" },
                    { key: "mss", label: "5m MSS with displacement" },
                    { key: "fvg_entry", label: "Entry at 5m FVG inside Kill Zone" },
                  ].map((r) => {
                    const st = rulesAssessment[r.key] ?? "followed";
                    return (
                      <div
                        key={r.key}
                        className="flex min-h-10 items-center justify-between gap-3 border-b border-white/[0.05] py-1.5 text-[13px]"
                      >
                        <span className="text-[#e8e8e6]">{r.label}</span>
                        <div className="flex shrink-0 overflow-hidden rounded-md border border-white/[0.1] text-[11px] font-medium">
                          <button
                            type="button"
                            onClick={() => toggleRule(r.key, "followed")}
                            className={cn(
                              "px-2.5 py-1 transition-colors",
                              st === "followed" ? "bg-[#3ddc84]/15 text-[#3ddc84]" : "text-[#a2a2a0]",
                            )}
                          >
                            Followed
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleRule(r.key, "not")}
                            className={cn(
                              "border-l border-white/[0.1] px-2.5 py-1 transition-colors",
                              st === "not" ? "bg-[#ff6b7d]/15 text-[#ff6b7d]" : "text-[#a2a2a0]",
                            )}
                          >
                            Not
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleRule(r.key, "na")}
                            className={cn(
                              "border-l border-white/[0.1] px-2.5 py-1 transition-colors",
                              st === "na" ? "bg-white/[0.1] text-white" : "text-[#a2a2a0]",
                            )}
                          >
                            N/A
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Exit criteria & Risk */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold tracking-[0.14em] text-[#a2a2a0] uppercase">
                    Exit &amp; Risk
                  </p>
                  {[
                    { key: "target_opposing", label: "Target opposing liquidity pool" },
                    { key: "partial_at_2r", label: "Take partial at 2R or logical level" },
                    { key: "risk_limit", label: "Risk ≤ 0.25% of balance" },
                    { key: "stop_placement", label: "Stop beyond swept structural extreme" },
                  ].map((r) => {
                    const st = rulesAssessment[r.key] ?? "followed";
                    return (
                      <div
                        key={r.key}
                        className="flex min-h-10 items-center justify-between gap-3 border-b border-white/[0.05] py-1.5 text-[13px] last:border-b-0"
                      >
                        <span className="text-[#e8e8e6]">{r.label}</span>
                        <div className="flex shrink-0 overflow-hidden rounded-md border border-white/[0.1] text-[11px] font-medium">
                          <button
                            type="button"
                            onClick={() => toggleRule(r.key, "followed")}
                            className={cn(
                              "px-2.5 py-1 transition-colors",
                              st === "followed" ? "bg-[#3ddc84]/15 text-[#3ddc84]" : "text-[#a2a2a0]",
                            )}
                          >
                            Followed
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleRule(r.key, "not")}
                            className={cn(
                              "border-l border-white/[0.1] px-2.5 py-1 transition-colors",
                              st === "not" ? "bg-[#ff6b7d]/15 text-[#ff6b7d]" : "text-[#a2a2a0]",
                            )}
                          >
                            Not
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleRule(r.key, "na")}
                            className={cn(
                              "border-l border-white/[0.1] px-2.5 py-1 transition-colors",
                              st === "na" ? "bg-white/[0.1] text-white" : "text-[#a2a2a0]",
                            )}
                          >
                            N/A
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reviewed checkmark */}
              <div className="flex items-center gap-2.5 pt-2">
                <input
                  type="checkbox"
                  id="trade-modal-reviewed"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                  className="size-4 rounded border-white/[0.2] bg-white/[0.04] text-[#e50914] focus:ring-[#e50914]"
                />
                <label htmlFor="trade-modal-reviewed" className="cursor-pointer text-[13px] text-[#d6d6d4]">
                  Mark trade as reviewed
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex h-16 shrink-0 items-center justify-end gap-2 border-t border-white/[0.07] px-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-10 border-white/[0.1] bg-white/[0.03] px-4 text-[13px] text-white hover:bg-white/[0.08]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-10 bg-[#e50914] px-4 text-[13px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(229,9,20,0.9)] hover:brightness-110"
          >
            {saving ? "Saving…" : trade ? "Save changes" : "Log trade"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
