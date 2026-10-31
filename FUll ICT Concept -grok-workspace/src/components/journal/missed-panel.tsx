import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MissedTrade } from "@/lib/ict-types";

/**
 * Missed setups are research rows too — the reason matters as much as the
 * outcome that would have followed.
 */
export function MissedPanel({
  missed,
  onEdit,
  onDelete,
  onAdd,
}: {
  missed: MissedTrade[];
  onEdit: (row: MissedTrade) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  const sorted = missed
    .slice()
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={onAdd}>
          <Plus aria-hidden="true" /> Log missed
        </Button>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/[0.12] px-4 py-10 text-center text-sm text-muted-foreground">
          No missed setups recorded.
        </p>
      ) : (
        <div className="space-y-3">
          {sorted.map((row) => (
            <article
              key={row.id}
              className="overflow-hidden rounded-xl border border-white/[0.09] bg-card/85 transition-colors hover:border-white/[0.18]"
            >
              <div className="h-0.5 w-full bg-warn/60" aria-hidden="true" />
              <div className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {row.date} · {row.time} NY
                  </p>
                  <Badge variant="warn">Missed opportunity</Badge>
                </div>
                <h2 className="mt-1.5 font-display text-2xl tracking-tight text-foreground">
                  {row.market} <span className="text-accent uppercase">{row.side}</span>
                </h2>
                <p className="mt-1.5 text-sm text-foreground/90">
                  <span className="text-muted-foreground">Hesitation:</span> {row.why || "—"}
                  <span className="mx-1.5 text-white/25">→</span>
                  <span className="font-semibold text-foreground">{row.outcome || "unknown"}</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge variant={row.narrativeValid ? "up" : "down"}>
                    Narrative {row.narrativeValid ? "valid" : "invalid"}
                  </Badge>
                  <Badge variant={row.liquiditySwept ? "up" : "default"}>
                    Sweep {row.liquiditySwept ? "yes" : "no"}
                  </Badge>
                  <Badge variant={row.triggerOccurred ? "up" : "default"}>
                    Trigger {row.triggerOccurred ? "fired" : "no"}
                  </Badge>
                </div>
                {row.notes ? (
                  <p className="mt-3 rounded-md border border-white/[0.07] bg-black/40 p-3 text-xs leading-relaxed text-muted-foreground">
                    “{row.notes}”
                  </p>
                ) : null}
                <div className="mt-3 flex gap-2 border-t border-white/[0.06] pt-3">
                  <Button size="sm" variant="outline" onClick={() => onEdit(row)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(row.id)} className="hover:text-down">
                    Delete
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
