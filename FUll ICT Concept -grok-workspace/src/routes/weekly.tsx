import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { useDeskStore } from "@/lib/ict-store";
import { emptyWeekly } from "@/lib/ict-defaults";
import { todayISO, weekStartISO } from "@/lib/ict-time";
import { DRAWS, LIQUIDITY_TYPES, type LiquidityMark, type WeeklyNarrative, type WeeklyProfile, type Structure } from "@/lib/ict-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Chips, Field, NumField, Panel } from "@/components/desk/fields";
import { RangeBar } from "@/components/desk/range-bar";
import { dealingMeta, fmtPx } from "@/lib/ict-calc";

export const Route = createFileRoute("/weekly")({ component: WeeklyPage });

function one<T>(v: T | T[]): T {
  return (Array.isArray(v) ? v[0] : v) as T;
}

function WeeklyPage() {
  const weeklies = useDeskStore((s) => s.weeklies);
  const upsert = useDeskStore((s) => s.upsertWeekly);
  const today = todayISO();
  const start = weekStartISO(today);
  const current = weeklies.find((w) => w.weekStart === start) ?? weeklies[0];
  const others = weeklies.filter((w) => w.id !== current?.id);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Weekly map"
        title="Where is the draw?"
        description="Daily bias sits inside the weekly profile. Mark the dealing range, name the liquidity, then write what price must do first."
        aside={<span className="font-mono text-[11px] text-muted-foreground">Week of {start}</span>}
      />
      {current ? <Editor week={current} onSave={upsert} /> : (
        <Button onClick={() => upsert(emptyWeekly(start))}>Create this week</Button>
      )}
      {others.length ? (
        <div className="mt-6 space-y-3">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Prior weeks</p>
          {others.map((w) => (
            <Panel key={w.id} title={`${w.weekStart} · ${w.structure}`}>
              <p className="text-sm text-muted-foreground">
                {w.primaryDraw} draw. {w.beforeDraw}
              </p>
            </Panel>
          ))}
        </div>
      ) : null}
    </AppShell>
  );
}

function Editor({ week, onSave }: { week: WeeklyNarrative; onSave: (w: WeeklyNarrative) => void }) {
  const meta = dealingMeta(week.dealingRange);
  function patch(partial: Partial<WeeklyNarrative>) {
    onSave({ ...week, ...partial });
  }
  function patchLiq(type: LiquidityMark["type"], next: Partial<LiquidityMark>) {
    const list = week.liquidity.some((l) => l.type === type)
      ? week.liquidity.map((l) => (l.type === type ? { ...l, ...next } : l))
      : [...week.liquidity, { type, price: null, status: "untouched" as const, ...next }];
    patch({ liquidity: list });
  }

  return (
    <div className="space-y-4">
      <Panel kicker={week.market} title="Weekly dealing range">
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumField
            label="Week open"
            value={week.dealingRange.open ?? null}
            onChange={(n) => patch({ dealingRange: { ...week.dealingRange, open: n } })}
          />
          <NumField
            label="PWH / high"
            value={week.dealingRange.high}
            onChange={(n) => patch({ dealingRange: { ...week.dealingRange, high: n } })}
          />
          <NumField
            label="PWL / low"
            value={week.dealingRange.low}
            onChange={(n) => patch({ dealingRange: { ...week.dealingRange, low: n } })}
          />
          <NumField
            label="Close"
            value={week.dealingRange.close ?? null}
            onChange={(n) => patch({ dealingRange: { ...week.dealingRange, close: n } })}
          />
          <NumField
            label="Current"
            value={week.dealingRange.current ?? null}
            onChange={(n) => patch({ dealingRange: { ...week.dealingRange, current: n } })}
          />
          <Field label="Midpoint">
            <p className="flex h-11 items-center font-mono">{fmtPx(meta.eq)}</p>
          </Field>
        </div>
        <RangeBar range={week.dealingRange} />
      </Panel>

      <Panel title="Structure">
        <Field label="HTF structure">
          <Chips
            options={["bullish", "bearish", "consolidation", "expansion", "reversal"] as const}
            value={week.structure}
            onChange={(v) => patch({ structure: one(v) as Structure })}
          />
        </Field>
        <div className="mt-3">
          <Field label="Weekly profile">
            <Chips
              options={["normal", "expansion", "reversal", "consolidation", "double-distribution"] as const}
              value={week.profile}
              onChange={(v) => patch({ profile: one(v) as WeeklyProfile })}
            />
          </Field>
        </div>
      </Panel>

      <Panel title="Weekly liquidity">
        <div className="space-y-3">
          {(["PWH", "PWL", "EQH", "EQL", "BSL", "SSL"] as const).map((type) => {
            const row = week.liquidity.find((l) => l.type === type);
            return (
              <div key={type} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2">
                <span className="text-xs font-medium">{type}</span>
                <Input
                  inputMode="decimal"
                  value={row?.price ?? ""}
                  onChange={(e) =>
                    patchLiq(type, { price: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
                <button
                  type="button"
                  className="h-9 rounded-full px-3 text-xs shadow-border"
                  onClick={() =>
                    patchLiq(type, { status: row?.status === "taken" ? "untouched" : "taken" })
                  }
                >
                  <Badge variant={row?.status === "taken" ? "down" : "up"}>
                    {row?.status === "taken" ? "taken" : "untouched"}
                  </Badge>
                </button>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Draw on liquidity">
        <Field label="Primary draw">
          <Chips options={DRAWS} value={week.primaryDraw} onChange={(v) => patch({ primaryDraw: one(v) })} />
        </Field>
        <div className="mt-3">
          <Field label="Secondary draw">
            <Chips
              options={DRAWS}
              value={week.secondaryDraw}
              onChange={(v) => patch({ secondaryDraw: one(v) })}
            />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="What must price do first?">
            <Textarea
              value={week.beforeDraw}
              onChange={(e) => patch({ beforeDraw: e.target.value })}
              placeholder="PWL is the external draw. Before it, raid Asia/PDL and rebalance a 1H bearish FVG."
            />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Weekly review" hint="Record your strongest execution, rule breaks, and one adjustment for next week.">
            <Textarea
              value={week.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              placeholder="What was repeatable? Where did I break rules? What is next week's focus?"
              rows={4}
            />
          </Field>
        </div>
      </Panel>
      <p className="text-xs text-subtle">Autosaved. Extra types: {LIQUIDITY_TYPES.length} liquidity objects in the journal.</p>
    </div>
  );
}
