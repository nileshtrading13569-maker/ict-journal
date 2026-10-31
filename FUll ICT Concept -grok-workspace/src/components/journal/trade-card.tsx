import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/desk/stat-tile";
import { fmtPx } from "@/lib/ict-calc";
import type { Trade } from "@/lib/ict-types";
import { cn, formatR } from "@/lib/utils";

export function TradeCard({
  trade,
  onEdit,
  onDelete,
}: {
  trade: Trade;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const r = trade.rMultiple;
  const isOpen = r == null;
  const isWin = (r ?? 0) > 0;
  const isLoss = (r ?? 0) < 0;

  return (
    <article className="group overflow-hidden rounded-xl border border-white/[0.09] bg-card/85 transition-colors duration-200 hover:border-white/[0.18]">
      <div
        className={cn(
          "h-0.5 w-full",
          isWin ? "bg-up/70" : isLoss ? "bg-down/70" : isOpen ? "bg-warn/70" : "bg-white/20",
        )}
        aria-hidden="true"
      />
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-muted-foreground">
              <span>
                {trade.date} · {trade.time} NY
              </span>
              <span className="text-white/20">/</span>
              <span className="font-semibold uppercase tracking-wider text-foreground/80">
                {trade.session}
              </span>
              <span className="text-white/20">/</span>
              <span className="text-accent/90">{trade.killZone}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
              <h2 className="font-display text-2xl leading-none tracking-tight text-foreground sm:text-3xl">
                {trade.market}
              </h2>
              <Badge variant={trade.side === "long" ? "up" : "down"}>{trade.side}</Badge>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{trade.modelName || "No model"}</span>
              <span className="mx-1.5 text-white/20">/</span>
              {trade.pdTimeframe} {trade.pdArray || "—"}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <p
              className={cn(
                "font-mono text-2xl font-bold tabular-nums sm:text-3xl",
                isWin ? "text-up" : isLoss ? "text-down" : "text-muted-foreground",
              )}
            >
              {isOpen ? "OPEN" : formatR(r!)}
            </p>
            <Badge variant={trade.ruleFollowed ? "up" : "down"}>
              {trade.ruleFollowed ? "Rules followed" : "Rule broken"}
            </Badge>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <StatTile label="Bias" value={`${trade.weeklyBias}/${trade.dailyBias}`} mono={false} />
          <StatTile label="Draw on liq" value={trade.drawOnLiquidity || "—"} mono={false} />
          <StatTile label="Location" value={trade.location} mono={false} />
          <StatTile label="Taken liq" value={trade.taken.join(", ") || "—"} mono={false} />
          <StatTile label="Trigger" value={trade.triggers.slice(0, 3).join(" · ") || "—"} mono={false} />
          <StatTile label="Entry / SL" value={`${fmtPx(trade.entry)} / ${fmtPx(trade.sl)}`} />
          <StatTile label="Primary error" value={trade.primaryError || "None"} mono={false} tone="warn" />
          <StatTile label="Grade" value={trade.grade || "—"} tone="accent" />
        </div>

        {trade.notes ? (
          <p className="mt-3 rounded-md border border-white/[0.07] bg-black/40 p-3 text-xs leading-relaxed text-muted-foreground">
            “{trade.notes}”
          </p>
        ) : null}

        {trade.screenshotHtf.startsWith("data:image/") || trade.screenshotExec.startsWith("data:image/") ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {trade.screenshotHtf.startsWith("data:image/") ? (
              <img
                src={trade.screenshotHtf}
                alt="Higher-timeframe chart"
                className="max-h-32 rounded-md border border-white/10 object-contain"
              />
            ) : null}
            {trade.screenshotExec.startsWith("data:image/") ? (
              <img
                src={trade.screenshotExec}
                alt="Execution chart"
                className="max-h-32 rounded-md border border-white/10 object-contain"
              />
            ) : null}
          </div>
        ) : null}

        <div className="mt-3 flex gap-2 border-t border-white/[0.06] pt-3">
          <Button size="sm" variant="outline" onClick={onEdit}>
            Edit ticket
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="hover:text-down">
            Delete
          </Button>
        </div>
      </div>
    </article>
  );
}

export type { Trade };
