import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { useDeskStore } from "@/lib/ict-store";
import { closedTrades } from "@/lib/ict-calc";
import { formatR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chips, Panel } from "@/components/desk/fields";
import { RangeBar } from "@/components/desk/range-bar";
import type { Trade } from "@/lib/ict-types";
import { cn } from "@/lib/utils";

const GUESSES = [
  "raid BSL",
  "raid SSL",
  "continuation",
  "reversal",
  "no trade",
] as const;

export const Route = createFileRoute("/replay")({ component: ReplayPage });

function ReplayPage() {
  const trades = useDeskStore((s) => s.trades);
  const closed = useMemo(
    () =>
      closedTrades(trades)
        .slice()
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)),
    [trades],
  );
  const [idx, setIdx] = useState(0);
  const [guess, setGuess] = useState<string>("");
  const [revealed, setRevealed] = useState(false);
  const trade = closed[idx];

  function next() {
    setIdx((i) => (closed.length ? (i + 1) % closed.length : 0));
    setGuess("");
    setRevealed(false);
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Replay"
        title="What should happen next?"
        description="Read the narrative. Pick a delivery. Then reveal what actually paid — or didn’t."
        aside={<span className="font-mono text-[11px] text-muted-foreground">Result hidden</span>}
      />

      {!trade ? (
        <p className="text-sm text-muted-foreground">Log closed trades to replay them.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Case {idx + 1} of {closed.length} · {trade.date} · {trade.market} · result hidden
          </p>
          <HiddenCase trade={trade} revealed={revealed} />
          <Panel title="Your call">
            <Chips options={GUESSES} value={guess} onChange={(v) => setGuess(Array.isArray(v) ? v[0] : v)} />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button disabled={!guess} onClick={() => setRevealed(true)}>
                Reveal
              </Button>
              <Button variant="outline" onClick={next}>
                Next case
              </Button>
            </div>
          </Panel>
          {revealed ? <Reveal trade={trade} guess={guess} /> : null}
        </div>
      )}
    </AppShell>
  );
}

function HiddenCase({ trade, revealed }: { trade: Trade; revealed: boolean }) {
  return (
    <Panel kicker={`${trade.session} · ${trade.killZone}`} title="Before the fill">
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <Item k="Weekly bias" v={trade.weeklyBias} />
        <Item k="Daily bias" v={trade.dailyBias} />
        <Item k="Draw" v={trade.drawOnLiquidity || "—"} />
        <Item k="Location" v={trade.location} />
        <Item k="Taken so far" v={trade.taken.join(", ") || "—"} />
        <Item k="PD array" v={`${trade.pdTimeframe} ${trade.pdArray}`.trim() || "—"} />
        <Item k="Time model" v={trade.timeModel || "—"} />
        <Item k="Structure" v={trade.structureBefore || "—"} />
        <Item k="Model" v={trade.modelName || "—"} />
      </dl>
      <div className="mt-4">
        <RangeBar range={trade.dealingRange} mark={revealed ? trade.entry : trade.dealingRange.current} />
      </div>
      {trade.screenshotHtf ? (
        <p className="mt-3 text-xs text-muted-foreground">HTF note: {trade.screenshotHtf}</p>
      ) : null}
    </Panel>
  );
}

function Reveal({ trade, guess }: { trade: Trade; guess: string }) {
  const actual =
    trade.side === "short" && trade.taken.some((t) => t.includes("H") || t === "BSL" || t === "PWH")
      ? "reversal"
      : trade.side === "long"
        ? "reversal"
        : "continuation";
  return (
    <Panel kicker="After" title="What happened">
      <div className="mb-3 flex flex-wrap gap-2">
        <Badge variant={(trade.rMultiple ?? 0) > 0 ? "up" : "down"}>
          {trade.side} · {trade.rMultiple == null ? "—" : formatR(trade.rMultiple)}
        </Badge>
        <Badge>{trade.modelName}</Badge>
        <Badge variant={trade.primaryError === "No actual error" ? "up" : "warn"}>
          {trade.primaryError || "unlabeled"}
        </Badge>
      </div>
      <p className="text-sm">
        You called <span className="font-medium">{guess || "nothing"}</span>. Price{" "}
        {trade.side === "long" ? "expanded higher" : "expanded lower"} from {trade.location} after{" "}
        {trade.taken.join(", ") || "no tagged sweep"}. Triggers: {trade.triggers.join(" · ") || "—"}.
      </p>
      {trade.notes ? <p className="mt-2 text-sm text-muted-foreground">{trade.notes}</p> : null}
      <p className={cn("mt-3 text-xs", guess && actual ? "text-muted-foreground" : "")}>
        Delivery read as {actual} for this sample — use it as a prompt, not a score.
      </p>
    </Panel>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="capitalize">{v}</dd>
    </div>
  );
}
