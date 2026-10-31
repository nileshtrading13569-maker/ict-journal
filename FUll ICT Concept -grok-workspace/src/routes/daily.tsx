import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { useDeskStore } from "@/lib/ict-store";
import { defaultPlanFrom } from "@/lib/ict-defaults";
import { planFor, weeklyFor } from "@/lib/ict-stats";
import { biasConfidence } from "@/lib/ict-calc";
import { todayISO } from "@/lib/utils";
import {
  AMD_PHASES,
  DELIVERIES,
  DRAWS,
  type Alignments,
  type DailyPlan,
  type ExpectedDelivery,
  type PremiumDiscount,
  type Structure,
} from "@/lib/ict-types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BoolRow, Chips, Field, NumField, Panel } from "@/components/desk/fields";
import { RangeBar } from "@/components/desk/range-bar";

export const Route = createFileRoute("/daily")({ component: DailyPage });

function one<T>(v: T | T[]): T {
  return (Array.isArray(v) ? v[0] : v) as T;
}

function DailyPage() {
  const data = useDeskStore();
  const setPlan = useDeskStore((s) => s.setPlan);
  const today = todayISO();
  const plan = planFor(data, today);
  const week = weeklyFor(data, today);
  const conf = biasConfidence(plan.alignments);

  function patch(partial: Partial<DailyPlan>) {
    const next = { ...plan, ...partial, date: today };
    setPlan(today, next);
  }

  function setAlign(key: keyof Alignments, v: boolean) {
    patch({ alignments: { ...plan.alignments, [key]: v } });
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Daily map"
        title="Build the bias."
        description={`Not “bullish because I feel good.” Alignment of HTF, liquidity, location, time, and narrative.${week ? ` Weekly draw is ${week.primaryDraw || "unset"}.` : ""}`}
        aside={<span className="font-mono text-[11px] text-muted-foreground">{today} NY</span>}
      />

      <Panel
        className="mb-4"
        kicker="Confidence"
        title={`${conf}% objective alignment`}
        action={
          <Badge variant={conf >= 80 ? "up" : conf >= 60 ? "warn" : "default"}>{conf} / 100</Badge>
        }
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <BoolRow label="HTF alignment" value={plan.alignments.htf} onChange={(v) => setAlign("htf", v)} />
          <BoolRow
            label="Liquidity alignment"
            value={plan.alignments.liquidity}
            onChange={(v) => setAlign("liquidity", v)}
          />
          <BoolRow
            label="Location alignment"
            value={plan.alignments.location}
            onChange={(v) => setAlign("location", v)}
          />
          <BoolRow label="Time alignment" value={plan.alignments.time} onChange={(v) => setAlign("time", v)} />
          <BoolRow
            label="Narrative alignment"
            value={plan.alignments.narrative}
            onChange={(v) => setAlign("narrative", v)}
          />
        </div>
      </Panel>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Panel title="HTF structure">
          <Chips
            options={["bullish", "bearish", "consolidation", "expansion", "reversal"] as const}
            value={plan.htfStructure}
            onChange={(v) => patch({ htfStructure: one(v) as Structure })}
          />
          <div className="mt-4">
            <Field label="Location in range">
              <Chips
                options={["premium", "discount", "equilibrium"] as const}
                value={plan.location}
                onChange={(v) => patch({ location: one(v) as PremiumDiscount })}
              />
            </Field>
          </div>
        </Panel>
        <Panel title="Daily dealing range">
          <div className="mb-3 grid grid-cols-2 gap-3">
            <NumField
              label="Range high"
              value={plan.dealingRange.high}
              onChange={(n) => patch({ dealingRange: { ...plan.dealingRange, high: n } })}
            />
            <NumField
              label="Range low"
              value={plan.dealingRange.low}
              onChange={(n) => patch({ dealingRange: { ...plan.dealingRange, low: n } })}
            />
          </div>
          <RangeBar range={plan.dealingRange} />
        </Panel>
      </div>

      <Panel className="mb-4" title="Previous day">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <NumField
            label="PDH"
            value={plan.previousDay.pdh}
            onChange={(n) => patch({ previousDay: { ...plan.previousDay, pdh: n } })}
          />
          <NumField
            label="PDL"
            value={plan.previousDay.pdl}
            onChange={(n) => patch({ previousDay: { ...plan.previousDay, pdl: n } })}
          />
          <NumField
            label="PDC"
            value={plan.previousDay.pdc}
            onChange={(n) => patch({ previousDay: { ...plan.previousDay, pdc: n } })}
          />
          <NumField
            label="Daily open"
            value={plan.previousDay.dailyOpen}
            onChange={(n) => patch({ previousDay: { ...plan.previousDay, dailyOpen: n } })}
          />
          <NumField
            label="Midnight open"
            value={plan.previousDay.midnightOpen}
            onChange={(n) => patch({ previousDay: { ...plan.previousDay, midnightOpen: n } })}
          />
        </div>
      </Panel>

      <Panel className="mb-4" title="Liquidity & delivery">
        <Field label="Liquidity condition">
          <Chips
            options={["BSL available", "SSL available", "Both", "One side raided"] as const}
            value={plan.liquidityCondition}
            onChange={(v) => patch({ liquidityCondition: one(v) })}
          />
        </Field>
        <div className="mt-3">
          <Field label="Expected draw">
            <Chips options={DRAWS} value={plan.expectedDraw} onChange={(v) => patch({ expectedDraw: one(v) })} />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Expected delivery">
            <Chips
              options={DELIVERIES}
              value={plan.expectedDelivery}
              onChange={(v) => patch({ expectedDelivery: one(v) as ExpectedDelivery })}
            />
          </Field>
        </div>
      </Panel>

      <Panel className="mb-4" title="AMD / Power of Three">
        <Field label="Expected phase">
          <Chips
            options={AMD_PHASES}
            value={plan.amdPhase}
            onChange={(v) => patch({ amdPhase: one(v) })}
          />
        </Field>
        <div className="mt-3">
          <Field label="Expected manipulation">
            <Input
              value={plan.expectedManipulation}
              onChange={(e) => patch({ expectedManipulation: e.target.value })}
              placeholder="Asia high / PDH raid"
            />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Expected distribution">
            <Chips
              options={["bullish", "bearish", "neutral"] as const}
              value={plan.expectedDistribution}
              onChange={(v) => patch({ expectedDistribution: one(v) })}
            />
          </Field>
        </div>
      </Panel>

      <Panel className="mb-4" title="Scenarios">
        <Textarea
          value={plan.scenarios}
          onChange={(e) => patch({ scenarios: e.target.value })}
          rows={5}
          placeholder={"A: Raid PDH then reverse into PDL.\nB: If PDL taken first without displacement — no trade."}
        />
      </Panel>

      <Panel title="Risk for today">
        <div className="grid grid-cols-3 gap-3">
          <NumField label="Risk %" value={plan.riskPerTrade} onChange={(n) => patch({ riskPerTrade: n ?? 0.25 })} />
          <NumField label="Max trades" value={plan.maxTrades} onChange={(n) => patch({ maxTrades: n ?? 2 })} />
          <NumField
            label="Daily loss %"
            value={plan.maxDailyLossPct}
            onChange={(n) => patch({ maxDailyLossPct: n ?? 1 })}
          />
        </div>
        <div className="mt-3">
          <Field label="Daily plan & review" hint="Capture the plan before trading, then add an end-of-day lesson.">
            <Textarea
              value={plan.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              placeholder="Plan: ...&#10;Review: What followed the plan? What will I improve next session?"
              rows={4}
            />
          </Field>
        </div>
        <button
          type="button"
          className="mt-3 text-xs text-muted-foreground underline"
          onClick={() => setPlan(today, defaultPlanFrom(data, today))}
        >
          Reset today to defaults
        </button>
      </Panel>
    </AppShell>
  );
}
