import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  DRAWS,
  ERRORS,
  EXIT_REASONS,
  EMOTIONS,
  KILL_ZONES,
  LIQUIDITY_TYPES,
  MANAGEMENT,
  PD_ARRAYS,
  SESSIONS,
  TIME_MODELS,
  TIMEFRAMES,
  TRIGGERS,
  type Bias,
  type Emotion,
  type Grade,
  type PremiumDiscount,
  type Trade,
  type TradeResult,
} from "@/lib/ict-types";
import { defaultPlanFrom, emptyTrade } from "@/lib/ict-defaults";
import {
  computeTradeR,
  confluenceScore,
  fmtLots,
  fmtPx,
  instrumentOf,
  locationOfPrice,
  positionLots,
  resultFromR,
  riskPctForLots,
  stopDistance,
} from "@/lib/ict-calc";
import { currentBalance, lockInfo, planFor } from "@/lib/ict-stats";
import { nowHHMM } from "@/lib/ict-time";
import { formatR, todayISO } from "@/lib/utils";
import { useDeskStore } from "@/lib/ict-store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BoolRow, Chips, Field, NumField, TriRow } from "./fields";
import { RangeBar } from "./range-bar";
import { cn } from "@/lib/utils";

const STEPS = ["Narrative", "Trigger", "Execute", "Manage", "Review"] as const;
const BALANCE_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function Optional({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="rounded-md bg-surface-2/80 p-3">
      <summary className="cursor-pointer text-sm font-medium text-muted-foreground">{title}</summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

function one<T>(v: T | T[]): T {
  return (Array.isArray(v) ? v[0] : v) as T;
}
function many<T>(v: T | T[]): T[] {
  return (Array.isArray(v) ? v : [v]) as T[];
}

export function TradeWizard({
  open,
  onOpenChange,
  trade,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: Trade | null;
}) {
  const data = useDeskStore();
  const upsertTrade = useDeskStore((s) => s.upsertTrade);
  const models = data.models.filter((m) => m.active);
  const today = todayISO();
  const dailyPlan = useDeskStore((s) => s.dailyPlans[today]);
  const rules = useDeskStore((s) => s.rules);
  const plan = useMemo(
    () => dailyPlan ?? defaultPlanFrom(rules, today),
    [dailyPlan, rules, today],
  );
  const lock = lockInfo(data, today);
  const first = models[0];
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Trade>(emptyTrade(today, nowHHMM(), plan.riskPerTrade, first));
  const inst = instrumentOf(data, form.market);
  const equity = currentBalance(data);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    if (trade) setForm(trade);
    else {
      const next = emptyTrade(today, nowHHMM(), plan.riskPerTrade, first);
      if (lock.locked) next.ruleFollowed = false;
      if (plan.expectedDraw) next.drawOnLiquidity = plan.expectedDraw;
      next.location = plan.location;
      next.dealingRange = { ...plan.dealingRange };
      setForm(next);
    }
  }, [
    open,
    trade,
    today,
    plan.riskPerTrade,
    first,
    lock.locked,
    plan.expectedDraw,
    plan.location,
    plan.dealingRange,
  ]);

  const patch = useCallback(
    <K extends keyof Trade,>(key: K, value: Trade[K]) => {
      setForm((f) => {
        const next = { ...f, [key]: value };
        if (key === "entry" || key === "sl" || key === "exitPrice" || key === "side" || key === "result") {
          if (next.result !== "open") {
            const r = computeTradeR(next);
            next.rMultiple = r;
            if (next.exitPrice != null) next.result = resultFromR(r, next.result);
          } else {
            next.rMultiple = null;
          }
        }
        if (key === "entry" || key === "dealingRange") {
          next.location = locationOfPrice(next.entry, next.dealingRange);
        }
        if (key === "entry" || key === "sl" || key === "market") next.lots = null;
        return next;
      });
    },
    [],
  );

  const calculatedLots = positionLots(equity, form.riskPct, form.entry, form.sl, inst);
  const lots = form.lots ?? calculatedLots;
  const stop = stopDistance(form);
  const rLive = form.result === "open" ? null : computeTradeR(form);
  const score = confluenceScore(form);

  const model = models.find((m) => m.id === form.modelId);
  const lockData = trade
    ? { ...data, trades: data.trades.filter((item) => item.id !== trade.id) }
    : data;
  const tradeLock = lockInfo(lockData, form.date);
  const saveTrade = () => {
    const r = form.result === "open" ? null : (computeTradeR(form) ?? form.rMultiple);
    const planSnapshot = trade?.planSnapshot ?? {
      capturedAt: new Date().toISOString(),
      plan: planFor(data, form.date),
      warnings: [...tradeLock.reasons, ...tradeLock.warnings],
    };
    upsertTrade({
      ...form,
      ruleFollowed: tradeLock.locked ? false : form.ruleFollowed,
      planSnapshot,
      rMultiple: r,
      result: form.result === "open" ? "open" : resultFromR(r, form.result),
      lots: lots,
      modelName: model?.name ?? form.modelName,
    });
    toast.success(trade ? "Trade updated" : "Trade logged");
    onOpenChange(false);
  };
  const attachScreenshot = useCallback(
    (key: "screenshotHtf" | "screenshotExec", file?: File) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast.error("Choose an image file.");
        return;
      }
      if (file.size > 300_000) {
        toast.error("Screenshot must be 300 KB or smaller to keep cloud sync reliable.");
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => toast.error("Could not read that image.");
      reader.onload = () => {
        if (typeof reader.result === "string") patch(key, reader.result);
      };
      reader.readAsDataURL(file);
    },
    [patch],
  );

  const body = useMemo(() => {
    if (step === 0) {
      return (
        <div className="space-y-4">
          <Field label="Model">
            <Chips
              options={models.map((m) => ({ value: m.id, label: `${m.code} · ${m.name}` }))}
              value={form.modelId}
              onChange={(v) => {
                const id = one(v);
                const m = models.find((x) => x.id === id);
                setForm((f) => ({ ...f, modelId: id, modelName: m?.name ?? "" }));
              }}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Weekly bias">
              <Chips
                options={["bullish", "bearish", "neutral"] as const}
                value={form.weeklyBias}
                onChange={(v) => patch("weeklyBias", one(v) as Bias)}
              />
            </Field>
            <Field label="Daily bias">
              <Chips
                options={["bullish", "bearish", "neutral"] as const}
                value={form.dailyBias}
                onChange={(v) => patch("dailyBias", one(v) as Bias)}
              />
            </Field>
          </div>
          <Field label="Draw on liquidity">
            <Chips options={DRAWS} value={form.drawOnLiquidity} onChange={(v) => patch("drawOnLiquidity", one(v))} />
          </Field>
          <Field label="Dealing range" hint="Entry is tagged premium / discount against this range.">
            <div className="grid grid-cols-2 gap-3">
              <NumField
                label="High"
                value={form.dealingRange.high}
                onChange={(n) => patch("dealingRange", { ...form.dealingRange, high: n })}
              />
              <NumField
                label="Low"
                value={form.dealingRange.low}
                onChange={(n) => patch("dealingRange", { ...form.dealingRange, low: n })}
              />
            </div>
            <div className="mt-3">
              <RangeBar range={form.dealingRange} mark={form.entry} markLabel="Entry" />
            </div>
          </Field>
          <Field label="Location">
            <Chips
              options={["premium", "discount", "equilibrium"] as const}
              value={form.location}
              onChange={(v) => patch("location", one(v) as PremiumDiscount)}
            />
          </Field>
          <Field label="Liquidity taken">
            <Chips multiple options={LIQUIDITY_TYPES} value={form.taken} onChange={(v) => patch("taken", many(v))} />
          </Field>
          <Field label="Target">
            <Chips
              multiple
              options={LIQUIDITY_TYPES}
              value={form.targetLiq}
              onChange={(v) => patch("targetLiq", many(v))}
            />
          </Field>
          <Field label="PD array">
            <Chips options={PD_ARRAYS} value={form.pdArray} onChange={(v) => patch("pdArray", one(v))} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Array timeframe">
              <Chips
                options={TIMEFRAMES}
                value={form.pdTimeframe}
                onChange={(v) => patch("pdTimeframe", one(v))}
              />
            </Field>
            <Field label="Array condition">
              <Chips
                options={["fresh", "partial", "mitigated", "invalidated"] as const}
                value={form.pdCondition}
                onChange={(v) => patch("pdCondition", one(v))}
              />
            </Field>
          </div>
          {model ? (
            <p className="text-xs text-muted-foreground">
              Invalid when: {model.invalidWhen.join(" · ")}
            </p>
          ) : null}
        </div>
      );
    }
    if (step === 1) {
      return (
        <div className="space-y-4">
          <Field label="Trigger">
            <Chips
              multiple
              options={TRIGGERS}
              value={form.triggers}
              onChange={(v) => patch("triggers", many(v))}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Session">
              <Chips options={SESSIONS} value={form.session} onChange={(v) => patch("session", one(v))} />
            </Field>
            <Field label="Kill zone">
              <Chips options={KILL_ZONES} value={form.killZone} onChange={(v) => patch("killZone", one(v))} />
            </Field>
          </div>
          <Field label="Time model">
            <Chips options={TIME_MODELS} value={form.timeModel} onChange={(v) => patch("timeModel", one(v))} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Structure before">
              <Chips
                options={["bullish", "bearish", "range", "compression", "expansion"] as const}
                value={form.structureBefore}
                onChange={(v) => patch("structureBefore", one(v))}
              />
            </Field>
            <Field label="Displacement">
              <Chips
                options={["weak", "normal", "strong"] as const}
                value={form.displacementQuality}
                onChange={(v) => patch("displacementQuality", one(v))}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <BoolRow label="FVG created on displacement" value={form.fvgCreated} onChange={(v) => patch("fvgCreated", v)} />
            <Field label="FVG timeframe">
              <Chips
                options={TIMEFRAMES}
                value={form.fvgTimeframe}
                onChange={(v) => patch("fvgTimeframe", one(v))}
              />
            </Field>
          </div>
          <Optional title="Judas / AMD (optional)">
            <Field label="Judas present">
              <Chips
                options={["yes", "no", "unclear"] as const}
                value={form.judas.present}
                onChange={(v) => patch("judas", { ...form.judas, present: one(v) })}
              />
            </Field>
            <Field label="Direction">
              <Chips
                options={["higher", "lower"] as const}
                value={form.judas.direction}
                onChange={(v) => patch("judas", { ...form.judas, direction: one(v) })}
              />
            </Field>
            <BoolRow
              label="Aligned with narrative"
              value={form.judas.aligned}
              onChange={(v) => patch("judas", { ...form.judas, aligned: v })}
            />
            <Field label="After Judas">
              <Chips
                options={["reversal", "continuation", "failed"] as const}
                value={form.judas.after}
                onChange={(v) => patch("judas", { ...form.judas, after: one(v) })}
              />
            </Field>
          </Optional>
          <Optional title="OTE (optional)">
            <Field label="OTE">
              <Chips
                options={["used", "not-used", "invalid"] as const}
                value={form.ote.used}
                onChange={(v) => patch("ote", { ...form.ote, used: one(v) })}
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <NumField
                label="Swing high"
                value={form.ote.swingHigh}
                onChange={(n) => patch("ote", { ...form.ote, swingHigh: n })}
              />
              <NumField
                label="Swing low"
                value={form.ote.swingLow}
                onChange={(n) => patch("ote", { ...form.ote, swingLow: n })}
              />
              <NumField
                label="Retrace %"
                value={form.ote.retracement}
                onChange={(n) => patch("ote", { ...form.ote, retracement: n })}
              />
            </div>
            <BoolRow
              label="Entry inside OTE"
              value={form.ote.inside}
              onChange={(v) => patch("ote", { ...form.ote, inside: v })}
            />
            <BoolRow
              label="PD array + OTE confluence"
              value={form.ote.confluence}
              onChange={(v) => patch("ote", { ...form.ote, confluence: v })}
            />
          </Optional>
          <Optional title="SMT (optional)">
            <Field label="SMT">
              <Chips
                options={["no", "bullish", "bearish"] as const}
                value={form.smt.present}
                onChange={(v) => patch("smt", { ...form.smt, present: one(v) })}
              />
            </Field>
            <Field label="Markets">
              <Chips
                options={["XAUUSD ↔ DXY", "ES ↔ NQ", "EURUSD ↔ GBPUSD", "Other"] as const}
                value={form.smt.pair}
                onChange={(v) => patch("smt", { ...form.smt, pair: one(v) })}
              />
            </Field>
            <Field label="Swept market">
              <Input
                value={form.smt.sweptMarket}
                onChange={(e) => patch("smt", { ...form.smt, sweptMarket: e.target.value })}
              />
            </Field>
            <BoolRow
              label="SMT before trigger"
              value={form.smt.beforeTrigger}
              onChange={(v) => patch("smt", { ...form.smt, beforeTrigger: v })}
            />
          </Optional>
          <Optional title="CRT (optional)">
            <BoolRow label="CRT used" value={form.crt.used} onChange={(v) => patch("crt", { ...form.crt, used: v })} />
            <Field label="Reference candle">
              <Chips
                options={TIMEFRAMES}
                value={form.crt.reference}
                onChange={(v) => patch("crt", { ...form.crt, reference: one(v) })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <NumField
                label="Range high"
                value={form.crt.high}
                onChange={(n) => patch("crt", { ...form.crt, high: n })}
              />
              <NumField
                label="Range low"
                value={form.crt.low}
                onChange={(n) => patch("crt", { ...form.crt, low: n })}
              />
            </div>
            <Field label="Raid">
              <Chips
                options={["high", "low", "neither"] as const}
                value={form.crt.raidSide}
                onChange={(v) => patch("crt", { ...form.crt, raidSide: one(v) })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <BoolRow label="Purge" value={form.crt.purge} onChange={(v) => patch("crt", { ...form.crt, purge: v })} />
              <BoolRow
                label="Reclaim"
                value={form.crt.reclaim}
                onChange={(v) => patch("crt", { ...form.crt, reclaim: v })}
              />
            </div>
          </Optional>
        </div>
      );
    }
    if (step === 2) {
      return (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <NumField label="TP2" value={form.tp2} onChange={(n) => patch("tp2", n)} />
            <NumField label="TP3" value={form.tp3} onChange={(n) => patch("tp3", n)} />
            <NumField label="Risk %" value={form.riskPct} onChange={(n) => setForm((f) => ({
              ...f,
              riskPct: n ?? plan.riskPerTrade,
              lots: null,
            }))} />
            <NumField
              label="Lots"
              value={lots}
              onChange={(n) => {
                if (n == null) {
                  patch("lots", null);
                  return;
                }
                if (n < 0) return;
                const riskPct = riskPctForLots(equity, n, form.entry, form.sl, inst);
                setForm((f) => ({
                  ...f,
                  lots: n,
                  ...(riskPct == null ? {} : { riskPct }),
                }));
              }}
            />
          </div>
          <div className="rounded-md bg-surface-2 p-3 text-sm">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <Stat k="Current balance" v={BALANCE_FORMATTER.format(equity)} />
              <Stat k="Stop distance" v={fmtPx(stop || null)} />
              <Stat k="Risk $" v={`$${(equity * (form.riskPct / 100)).toFixed(0)}`} />
              <Stat k="Size (lots)" v={fmtLots(lots)} />
              <Stat k="Confluence" v={`${score}/10`} />
            </div>
            <p className="mt-2 text-xs text-subtle">
              Set risk % to calculate lots, or enter lots to calculate risk % from the stop and{" "}
              {inst?.symbol ?? "instrument"} tick value. Confluence classifies the trade for research — it does not tell you to take it.
            </p>
          </div>
        </div>
      );
    }
    if (step === 3) {
      return (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Exit time (NY)">
              <Input type="time" value={form.exitTime} onChange={(e) => patch("exitTime", e.target.value)} />
            </Field>
            <Field label="Computed R">
              <p className="flex h-11 items-center font-mono text-lg tabular-nums">
                {rLive == null && form.rMultiple == null ? "—" : formatR(rLive ?? form.rMultiple ?? 0)}
              </p>
            </Field>
          </div>
          <Field label="Exit reason">
            <Chips options={EXIT_REASONS} value={form.exitReason} onChange={(v) => patch("exitReason", one(v))} />
          </Field>
          <Field label="Management">
            <Chips
              options={MANAGEMENT}
              value={form.management}
              onChange={(v) => patch("management", one(v))}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <BoolRow label="Moved to BE" value={form.be} onChange={(v) => patch("be", v)} />
            <NumField label="Partial at R" value={form.partialAtR} onChange={(n) => patch("partialAtR", n)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumField
              label="MAE (R)"
              value={form.maeR}
              onChange={(n) => patch("maeR", n)}
            />
            <NumField label="MFE (R)" value={form.mfeR} onChange={(n) => patch("mfeR", n)} />
          </div>
          <p className="text-xs text-muted-foreground">
            MAE / MFE answer whether stops are too tight and whether you give winners back.
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <TriRow
            label="Narrative"
            value={form.narrativeCorrect}
            onChange={(v) => patch("narrativeCorrect", v)}
          />
          <TriRow
            label="Liquidity read"
            value={form.liquidityCorrect}
            onChange={(v) => patch("liquidityCorrect", v)}
          />
          <TriRow label="Location" value={form.locationCorrect} onChange={(v) => patch("locationCorrect", v)} />
          <TriRow label="Trigger" value={form.triggerCorrect} onChange={(v) => patch("triggerCorrect", v)} />
        </div>
        <Field label="Entry quality">
          <Chips
            options={["early", "optimal", "late", "chasing"] as const}
            value={form.executionQuality}
            onChange={(v) => patch("executionQuality", one(v))}
          />
        </Field>
        <Field label="Delivery status">
          <Chips
            options={["pre", "early", "mid", "late", "delivered"] as const}
            value={form.deliveryStatus}
            onChange={(v) => patch("deliveryStatus", one(v))}
          />
        </Field>
        <Field label="What failed">
          <Chips multiple options={ERRORS} value={form.errors} onChange={(v) => patch("errors", many(v))} />
        </Field>
        <Field label="Primary error">
          <Chips
            options={ERRORS}
            value={form.primaryError}
            onChange={(v) => patch("primaryError", one(v))}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Grade">
            <Chips
              options={["A+", "A", "A-", "B", "C", "D", "F"] as const}
              value={form.grade}
              onChange={(v) => patch("grade", one(v) as Grade)}
            />
          </Field>
          <Field label="Emotion">
            <Chips
              options={EMOTIONS.map((e) => ({ value: e.value, label: e.label }))}
              value={form.emotion}
              onChange={(v) => patch("emotion", one(v) as Emotion)}
            />
          </Field>
        </div>
        <BoolRow
        label="Rules followed"
        value={form.ruleFollowed}
        onChange={(v) => patch("ruleFollowed", v)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="HTF screenshot or note">
            <Input
              value={form.screenshotHtf}
              onChange={(e) => patch("screenshotHtf", e.target.value)}
              placeholder="PWH/PWL, weekly range, FVG…"
            />
            <Input
              type="file"
              accept="image/*"
              aria-label="Attach HTF screenshot"
              className="mt-2"
              onChange={(e) => attachScreenshot("screenshotHtf", e.target.files?.[0])}
            />
            {form.screenshotHtf.startsWith("data:image/") ? (
              <img src={form.screenshotHtf} alt="HTF chart attachment preview" className="mt-2 max-h-32 rounded-lg border border-white/10 object-contain" />
            ) : null}
          </Field>
          <Field label="Execution screenshot or note">
            <Input
              value={form.screenshotExec}
              onChange={(e) => patch("screenshotExec", e.target.value)}
              placeholder="Sweep, MSS, FVG, entry, SL, TP…"
            />
            <Input
              type="file"
              accept="image/*"
              aria-label="Attach execution screenshot"
              className="mt-2"
              onChange={(e) => attachScreenshot("screenshotExec", e.target.files?.[0])}
            />
            {form.screenshotExec.startsWith("data:image/") ? (
              <img src={form.screenshotExec} alt="Execution chart attachment preview" className="mt-2 max-h-32 rounded-lg border border-white/10 object-contain" />
            ) : null}
          </Field>
        </div>
      </div>
    );
  }, [step, form, models, model, equity, lots, stop, score, inst, rLive, plan.riskPerTrade, patch, attachScreenshot]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{trade ? "Edit trade" : "Quick Trade"}</DialogTitle>
          <DialogDescription>
            Add the essentials now. Journal extra setup details only when you need them.
          </DialogDescription>
        </DialogHeader>
        {tradeLock.reasons.length || tradeLock.warnings.length ? (
          <div className="mb-3 max-h-24 shrink-0 space-y-1 overflow-y-auto rounded-md bg-down/10 px-3 py-2 text-sm text-down" role="alert">
            {tradeLock.reasons.map((reason) => <p key={reason}>{reason}</p>)}
            {tradeLock.warnings.map((warning) => <p key={warning}>{warning}</p>)}
            <p className="text-xs">Review these conditions before saving; you can still journal the trade.</p>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <section className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Market">
                <Input value={form.market} onChange={(e) => patch("market", e.target.value.toUpperCase())} />
              </Field>
              <Field label="Date">
                <Input type="date" value={form.date} onChange={(e) => patch("date", e.target.value)} />
              </Field>
              <Field label="Time (NY)">
                <Input type="time" value={form.time} onChange={(e) => patch("time", e.target.value)} />
              </Field>
            </div>
            <Field label="Side">
              <Chips
                options={["long", "short"] as const}
                value={form.side}
                onChange={(v) => patch("side", one(v))}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <NumField label="Entry" value={form.entry} onChange={(n) => patch("entry", n)} />
              <NumField label="Stop" value={form.sl} onChange={(n) => patch("sl", n)} />
              <NumField label="Target" value={form.tp1} onChange={(n) => patch("tp1", n)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Result">
                <Chips
                  options={["open", "win", "loss", "be"] as const}
                  value={form.result}
                  onChange={(v) => {
                    const result = one(v) as TradeResult;
                    setForm((f) => ({
                      ...f,
                      result,
                      rMultiple: result === "open" ? null : computeTradeR({ ...f, result }),
                    }));
                  }}
                />
              </Field>
              <NumField label="Exit price" value={form.exitPrice} onChange={(n) => patch("exitPrice", n)} />
            </div>
            <Field label="Notes">
              <Textarea
                value={form.notes}
                onChange={(e) => patch("notes", e.target.value)}
                rows={2}
                placeholder="What happened?"
              />
            </Field>
          </section>
          <details className="rounded-md border border-border bg-surface-2/50 p-3">
            <summary className="cursor-pointer text-sm font-medium">
              More details <span className="ml-1 text-xs font-normal text-muted-foreground">· optional journal fields</span>
            </summary>
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                {STEPS.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStep(i)}
                    className={cn(
                      "h-9 shrink-0 rounded-full border px-3.5 text-xs font-medium transition-all",
                      i === step
                        ? "border-accent bg-accent font-semibold text-accent-foreground shadow-sm"
                        : "border-border bg-surface-2 text-foreground/85 hover:border-foreground/30 hover:bg-surface-2/80 hover:text-foreground",
                    )}
                  >
                    <span className="mr-1 opacity-70">{i + 1}</span> {s}
                  </button>
                ))}
              </div>
              {body}
            </div>
          </details>
        </div>
        <DialogFooter className="shrink-0 pt-2">
          <Button type="button" onClick={saveTrade}>
            {trade ? "Save changes" : "Save trade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{k}</p>
      <p className="font-mono tabular-nums">{v}</p>
    </div>
  );
}
