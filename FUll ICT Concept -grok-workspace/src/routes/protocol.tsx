import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { useDeskStore } from "@/lib/ict-store";
import { protocolDayNumber, remainingRToDanger, todayProtocol } from "@/lib/ict-stats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Panel } from "@/components/desk/fields";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/protocol")({ component: ProtocolPage });

function ProtocolPage() {
  const data = useDeskStore();
  const setPhaseId = useDeskStore((s) => s.setPhaseId);
  const upsertProtocolDay = useDeskStore((s) => s.upsertProtocolDay);
  const addProtocolDay = useDeskStore((s) => s.addProtocolDay);
  const dayN = protocolDayNumber(data);
  const today = todayProtocol(data);
  const danger = remainingRToDanger(data);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Payout protocol"
        title="Survive the cycle."
        description="Distance to danger matters more than distance to payout. ICT research sits on top of this floor."
        aside={
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-white/[0.12] px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            Phase {data.phaseId} · {data.phases.find((phase) => phase.id === data.phaseId)?.name}
          </span>
        }
      />

      <Panel className="mb-4" kicker={`Day ${dayN}`} title={today?.title ?? "Custom cycle"}>
        <p className="text-sm text-muted-foreground">{today?.focus}</p>
        <p className="mt-3 text-sm">
          {danger.dailyR.toFixed(1)}R left before daily cap · {danger.totalR.toFixed(1)}R before max DD
        </p>
      </Panel>

      <div className="mb-6 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {data.phases.map((p) => {
          const isActive = data.phaseId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPhaseId(p.id)}
              className={cn(
                "group relative overflow-hidden rounded-xl border p-4 text-left transition-colors duration-200",
                isActive
                  ? "border-accent/60 bg-accent/[0.07] shadow-[inset_0_2px_0_0_var(--color-accent)]"
                  : "border-white/[0.09] bg-card/70 hover:border-white/[0.2] hover:bg-card",
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Phase {p.id}
                </p>
                {isActive ? (
                  <span className="size-2 rounded-full bg-accent animate-pulse" />
                ) : null}
              </div>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground">{p.name}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {p.goal}
              </p>
            </button>
          );
        })}
      </div>

      <Panel className="mb-6" title="Account Constraints & Guidelines" kicker="Risk Parameters">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Item k="Daily Loss Limit" v={`${data.rules.maxDailyLossPct}%`} />
          <Item k="Max Drawdown" v={`${data.rules.maxTotalDrawdownPct}% (${data.rules.drawdownType})`} />
          <Item k="Payout Target" v={`${data.rules.payoutThresholdPct}%`} />
          <Item k="Profit Split" v={`${data.rules.profitSplit}%`} />
          <Item k="Consistency Score" v={`${data.rules.consistencyPct}%`} />
          <Item k="Min Trading Days" v={`${data.rules.minTradingDays} days`} />
          <Item k="News Trading" v={data.rules.newsRestricted ? "Restricted" : "Open"} />
          <Item k="Weekend Holding" v={data.rules.weekendRestricted ? "Flat" : "Allowed"} />
        </dl>
      </Panel>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-semibold text-foreground">30-Day Execution Track</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Discipline cycle progression</p>
        </div>
        <Button size="sm" variant="outline" onClick={addProtocolDay}>
          Add Day
        </Button>
      </div>

      <ol className="space-y-3">
        {data.protocolDays.map((d) => (
          <li
            key={d.id}
            className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-card/90 via-card/75 to-card/50 p-5 shadow-lg backdrop-blur-md transition-all duration-150 hover:border-white/[0.16]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-mono text-muted-foreground">
                  {d.date} · <span className="text-accent font-semibold">{d.riskPct}% Risk</span> · Max {d.maxTrades} trades
                </p>
                <p className="mt-1 font-display text-2xl font-semibold text-foreground">{d.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{d.focus}</p>
              </div>
              <div className="flex gap-1.5">
                <Badge
                  variant={d.completed ? "up" : d.skipped ? "warn" : "default"}
                  className="px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider"
                >
                  {d.completed ? "Completed" : d.skipped ? "Skipped" : "Pending"}
                </Badge>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={d.completed ? "outline" : "default"}
                onClick={() => upsertProtocolDay({ ...d, completed: !d.completed, skipped: false })}
              >
                {d.completed ? "Undo Completion" : "Mark Complete"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => upsertProtocolDay({ ...d, skipped: !d.skipped, completed: false })}
              >
                {d.skipped ? "Unskip" : "Skip Day"}
              </Button>
            </div>
            <Textarea
              className="mt-3.5 bg-black/25 text-xs leading-relaxed"
              rows={2}
              value={d.notes}
              onChange={(e) => upsertProtocolDay({ ...d, notes: e.target.value })}
              placeholder="Session reflections, psychology notes, or mistakes made today..."
            />
          </li>
        ))}
      </ol>
    </AppShell>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
      <dt className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{k}</dt>
      <dd className="mt-1 font-mono text-base font-semibold text-foreground">{v}</dd>
    </div>
  );
}
