import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ProgressTracker } from "@/components/desk/progress-tracker";
import { ChecklistManager } from "@/components/desk/checklist-manager";
import { NewsManager } from "@/components/desk/news-manager";
import { useDeskStore } from "@/lib/ict-store";
import {
  currentBalance,
  lockInfo,
  payoutProgress,
  planFor,
  protocolDayNumber,
  remainingRToDanger,
  sumPnlPct,
  todayProtocol,
  tradesOn,
  weeklyFor,
} from "@/lib/ict-stats";
import { biasConfidence } from "@/lib/ict-calc";
import { formatMoney, formatPct, formatR, todayISO, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Panel } from "@/components/desk/fields";
import { RangeBar } from "@/components/desk/range-bar";
import { KpiCard } from "@/components/desk/kpi-card";
import { nowHHMM } from "@/lib/ict-time";
import { Flame, ShieldAlert, Target, Wallet, Quote, AlertTriangle, CalendarClock } from "lucide-react";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [showConditionalRequirements, setShowConditionalRequirements] = useState(true);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [newsOpen, setNewsOpen] = useState(false);
  const data = useDeskStore();
  const toggleCheck = useDeskStore((s) => s.toggleCheck);
  const closeToday = useDeskStore((s) => s.closeToday);
  const openToday = useDeskStore((s) => s.openToday);
  const today = todayISO();
  const [selectedChecklistDate, setSelectedChecklistDate] = useState(today);
  const checklistRef = useRef<HTMLDivElement>(null);
  const day = protocolDayNumber(data);
  const proto = todayProtocol(data);
  const plan = planFor(data, today);
  const week = weeklyFor(data, today);
  const lock = lockInfo(data, today);
  const pay = payoutProgress(data);
  const danger = remainingRToDanger(data, today);
  const todays = tradesOn(data.trades, today);
  const todayR = todays.reduce((a, t) => a + (t.rMultiple ?? 0), 0);
  const conf = biasConfidence(plan.alignments);
  const checked = new Set(data.checks[selectedChecklistDate] ?? []);
  const core = data.checklistItems.filter((i) => i.group === "core");
  const cond = data.checklistItems.filter((i) => i.group === "conditional");
  const life = data.checklistItems.filter((i) => i.group === "lifestyle");
  const news = data.newsEvents.filter((n) => n.date === today);
  const upcoming = data.newsEvents
    .filter((n) => n.date > today)
    .slice()
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0];
  const models = data.models.filter((m) => m.active);
  const coreDone = core.filter((item) => checked.has(item.id)).length;
  const lossUsedPct = Math.min(
    100,
    Math.round(((plan.maxDailyLossPct - danger.dailyLeftPct) / Math.max(plan.maxDailyLossPct, 0.01)) * 100),
  );

  function revealDailyChecklist() {
    const target = checklistRef.current;
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Today"
        title="Was the read correct?"
        description={`Narrative → liquidity → location → timing → trigger → risk.${proto ? ` ${proto.title}: ${proto.focus}` : ` Day ${day}.`}`}
        aside={
          <>
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-up/30 bg-up/10 px-2 py-0.5 text-[10px] font-semibold tracking-[0.1em] text-up uppercase">
              <span className="size-1.5 rounded-full bg-up animate-pulse" aria-hidden="true" />
              Live New York
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {today} · {nowHHMM()} NY
            </span>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <KpiCard
          label="Equity"
          value={formatMoney(currentBalance(data))}
          hint={formatPct(sumPnlPct(data.trades))}
          icon={Wallet}
          variant={currentBalance(data) >= data.rules.startingBalance ? "up" : "down"}
        />
        <KpiCard
          label="Today"
          value={formatR(todayR)}
          hint={`${todays.length} execution${todays.length === 1 ? "" : "s"}`}
          icon={Flame}
          variant={todayR > 0 ? "up" : todayR < 0 ? "down" : "default"}
        />
        <KpiCard
          label="R to danger"
          value={`${danger.dailyR.toFixed(0)}R`}
          hint={`${danger.dailyLeftPct.toFixed(2)}% daily cap left`}
          icon={ShieldAlert}
          variant={danger.dailyR <= 2 ? "down" : "default"}
        />
        <KpiCard
          label="Payout path"
          value={`${Math.max(0, Math.round(pay.pct))}%`}
          hint={`Target ${formatPct(data.rules.payoutThresholdPct, 0)}`}
          icon={Target}
          variant="up"
        />
      </div>

      <Panel
        className="mb-5"
        kicker="Progress markers"
        title="Account milestones"
        action={<Badge variant={lock.locked ? "down" : "up"}>{lock.locked ? "Locked" : "Open"}</Badge>}
      >
        <div className="grid gap-2 sm:grid-cols-4">
          {[25, 50, 75, 100].map((milestone) => {
            const progress = pay.target > 0 ? Math.min(100, Math.max(0, (pay.pct / milestone) * 100)) : 0;
            return (
              <div key={milestone} className="rounded-md border border-white/[0.07] bg-white/[0.02] p-3">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-medium text-foreground/85">{milestone}% target</span>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {Math.round(progress)}%
                  </span>
                </div>
                <Progress aria-label={`${milestone}% payout milestone target`} value={progress} />
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Progress is measured on closed results toward the configured payout threshold.
        </p>
      </Panel>

      <ProgressTracker
        data={data}
        today={today}
        selectedDate={selectedChecklistDate}
        onSelectDate={setSelectedChecklistDate}
        onOpenChecklist={revealDailyChecklist}
      />

      <Panel
        className="mb-5"
        kicker="Circuit breaker"
        title={lock.locked ? "Platform lock active" : "Execution open"}
        action={
          <Badge variant={lock.locked ? "down" : "up"} className="gap-1.5">
            <span
              className={cn("size-1.5 rounded-full", lock.locked ? "bg-down" : "bg-up animate-pulse")}
              aria-hidden="true"
            />
            {lock.locked ? "Circuit tripped" : "Ready to execute"}
          </Badge>
        }
      >
        {lock.reasons.map((reason) => (
          <div
            key={reason}
            className="mb-1.5 flex items-center gap-2 rounded-md border border-down/30 bg-down/[0.07] px-3 py-2 text-sm text-down"
          >
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{reason}</span>
          </div>
        ))}
        {lock.warnings.map((reason) => (
          <div
            key={reason}
            className="mb-1.5 flex items-center gap-2 rounded-md border border-warn/30 bg-warn/[0.07] px-3 py-2 text-sm text-warn"
          >
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{reason}</span>
          </div>
        ))}
        {!lock.reasons.length && !lock.warnings.length ? (
          <p className="text-sm text-muted-foreground">
            No lockout triggers detected. Execute only the written playbook models.
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          {lock.locked ? (
            <Button size="sm" variant="outline" onClick={() => openToday(today)}>
              Override lock & open
            </Button>
          ) : (
            <Button size="sm" variant="destructive" onClick={() => closeToday(today)}>
              Close platform now
            </Button>
          )}
          <span className="font-mono text-[11px] text-muted-foreground">
            {plan.maxTrades - todays.length} of {plan.maxTrades} trades left
          </span>
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold tracking-[0.14em] uppercase">
            <span className="text-muted-foreground">Daily loss used</span>
            <span className="font-mono text-foreground">{lossUsedPct}%</span>
          </div>
          <Progress aria-label="Daily loss limit used percentage" value={lossUsedPct} />
        </div>
      </Panel>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Panel kicker="Weekly map" title={week ? `${week.structure} week` : "No weekly narrative"}>
          {week ? (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                Draw: <span className="font-semibold text-foreground">{week.primaryDraw || "—"}</span>
                {week.secondaryDraw ? <span> → {week.secondaryDraw}</span> : null}. {week.beforeDraw}
              </p>
              <RangeBar range={week.dealingRange} />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {week.liquidity.map((level) => (
                  <Badge key={level.type} variant={level.status === "taken" ? "down" : "default"}>
                    {level.type} {level.status}
                  </Badge>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Open Weekly to write PWH/PWL and the draw.</p>
          )}
        </Panel>

        <Panel
          kicker="Daily bias"
          title={plan.expectedDelivery || "No delivery model"}
          action={
            <Badge variant={conf >= 80 ? "up" : conf >= 60 ? "warn" : "default"}>{conf}% aligned</Badge>
          }
        >
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <Row k="HTF structure" v={plan.htfStructure} />
            <Row k="Location" v={plan.location} />
            <Row k="Liquidity" v={plan.liquidityCondition} />
            <Row k="Draw" v={plan.expectedDraw || "—"} />
            <Row k="AMD phase" v={plan.amdPhase || "—"} />
            <Row k="Risk params" v={`${plan.riskPerTrade}% · ${plan.maxTrades} trades`} />
          </dl>
          {plan.scenarios ? (
            <p className="mt-3 whitespace-pre-line rounded-md border border-white/[0.07] bg-black/40 p-3 text-xs leading-relaxed text-muted-foreground">
              {plan.scenarios}
            </p>
          ) : null}
        </Panel>
      </div>

      <div
        ref={checklistRef}
        id="daily-checklist"
        tabIndex={-1}
        className="scroll-mt-6 outline-hidden"
      >
        <Panel
          className="mb-5"
          kicker={`Execution gate · ${selectedChecklistDate}`}
          title="Daily checklist"
          meta={`${coreDone}/${core.length} core conditions met`}
          action={
            <Button size="sm" variant="outline" onClick={() => setChecklistOpen(true)}>
              Edit items
            </Button>
          }
        >
          <Group items={core} checked={checked} onToggle={(id) => toggleCheck(selectedChecklistDate, id)} />

          <div className="mt-5 mb-2 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
            <h3 className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              Conditional requirements
            </h3>
            <label className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{showConditionalRequirements ? "Shown" : "Hidden"}</span>
              <Switch
                aria-label="Show conditional requirements"
                checked={showConditionalRequirements}
                onCheckedChange={setShowConditionalRequirements}
              />
            </label>
          </div>
          {showConditionalRequirements ? (
            <Group items={cond} checked={checked} onToggle={(id) => toggleCheck(selectedChecklistDate, id)} />
          ) : null}

          <p className="mt-5 mb-2 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Lifestyle & mental state
          </p>
          <Group items={life} checked={checked} onToggle={(id) => toggleCheck(selectedChecklistDate, id)} />
        </Panel>
      </div>

      <Panel className="mb-5" kicker="Playbook models" title="Permitted setups">
        <div className="grid gap-2 sm:grid-cols-2">
          {models.map((model) => (
            <div
              key={model.id}
              className="rounded-md border border-white/[0.08] bg-white/[0.02] p-3 transition-colors hover:border-white/[0.2] hover:bg-white/[0.04]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-semibold text-accent">{model.code}</span>
                <span className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                  {model.market}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-foreground">{model.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {model.trigger} → <span className="font-medium text-foreground/90">{model.target}</span>
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        className="mb-5"
        kicker="Economic calendar"
        title={news.length ? "High-impact events" : "No prints today"}
        action={
          <Button size="sm" variant="outline" onClick={() => setNewsOpen(true)}>
            <CalendarClock aria-hidden="true" /> Manage
          </Button>
        }
      >
        {news.length ? (
          <div className="space-y-1.5">
            {news.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between gap-3 rounded-md border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="font-mono text-[11px] font-semibold text-accent">{event.time} NY</span>
                  <span className="truncate font-medium text-foreground">{event.name}</span>
                </div>
                <Badge variant={event.avoid ? "down" : "default"}>
                  {event.avoid ? "Stay flat" : event.impact}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing scheduled for {today}.
            {upcoming ? ` Next: ${upcoming.name} on ${upcoming.date} at ${upcoming.time} NY.` : ""}
          </p>
        )}
      </Panel>

      <div className="spotlight-red relative overflow-hidden rounded-2xl border border-white/[0.09] bg-card/70 p-6">
        <Quote className="mb-2 size-6 text-accent/50" aria-hidden="true" />
        <p className="font-display text-2xl leading-snug tracking-wide text-foreground italic sm:text-3xl">
          “{data.mantra}”
        </p>
        <p className="mt-3 text-[10px] font-semibold tracking-[0.16em] text-accent/80 uppercase">
          Core operating principle · ICT disciplines
        </p>
      </div>

      <ChecklistManager open={checklistOpen} onOpenChange={setChecklistOpen} />
      <NewsManager open={newsOpen} onOpenChange={setNewsOpen} today={today} />
    </AppShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
      <dt className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{k}</dt>
      <dd className="mt-0.5 truncate text-[13px] font-medium text-foreground capitalize">{v}</dd>
    </div>
  );
}

/*
 * Row click and checkbox click both toggle exactly once: the checkbox stops
 * propagation so its own handler is the only one that fires.
 */
function Group({
  items,
  checked,
  onToggle,
}: {
  items: { id: string; label: string }[];
  checked: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => {
        const isChecked = checked.has(item.id);
        return (
          <li
            key={item.id}
            className={cn(
              "flex items-start gap-3 rounded-md border px-3 py-2.5 transition-colors",
              isChecked
                ? "border-white/[0.12] bg-white/[0.035]"
                : "border-white/[0.06] hover:border-white/[0.14] hover:bg-white/[0.02]",
            )}
          >
            <Checkbox
              checked={isChecked}
              onClick={(event) => event.stopPropagation()}
              onCheckedChange={() => onToggle(item.id)}
              aria-label={item.label}
              className="mt-0.5"
            />
            <button
              type="button"
              onClick={() => onToggle(item.id)}
              className={cn(
                "flex-1 text-left text-sm font-medium leading-5 transition-colors",
                isChecked ? "text-muted-foreground line-through" : "text-foreground/90",
              )}
            >
              {item.label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
