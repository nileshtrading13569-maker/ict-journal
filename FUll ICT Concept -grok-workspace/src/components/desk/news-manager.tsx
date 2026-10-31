import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDeskStore } from "@/lib/ict-store";
import type { Impact, NewsEvent } from "@/lib/ict-types";
import { cn, uid } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Field } from "./fields";
import { ConfirmDelete } from "./confirm-delete";

const IMPACTS: Impact[] = ["high", "medium", "low"];

const emptyEvent = (date: string): NewsEvent => ({
  id: uid("news"),
  name: "",
  date,
  time: "08:30",
  impact: "high",
  notes: "",
  avoid: true,
});

export function NewsManager({
  open,
  onOpenChange,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  today: string;
}) {
  const events = useDeskStore((s) => s.newsEvents);
  const upsertNews = useDeskStore((s) => s.upsertNews);
  const removeNews = useDeskStore((s) => s.removeNews);
  const [draft, setDraft] = useState<NewsEvent>(() => emptyEvent(today));
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const sorted = events.slice().sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const pending = events.find((event) => event.id === deleteId);

  const save = () => {
    if (!draft.name.trim()) return;
    upsertNews({ ...draft, name: draft.name.trim() });
    setDraft(emptyEvent(today));
    toast.success("Event saved to the calendar");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Economic calendar</DialogTitle>
          <DialogDescription>
            High-impact prints set the default to flat. Events flagged “stay flat” raise a warning on
            the circuit breaker for that date.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          <div className="mb-4 rounded-lg border border-white/[0.09] bg-white/[0.02] p-3">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Field label="Event" className="sm:col-span-2">
                <Input
                  placeholder="US CPI y/y"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </Field>
              <Field label="Date">
                <Input
                  type="date"
                  value={draft.date}
                  onChange={(event) => setDraft({ ...draft, date: event.target.value })}
                />
              </Field>
              <Field label="Time (NY)">
                <Input
                  type="time"
                  value={draft.time}
                  onChange={(event) => setDraft({ ...draft, time: event.target.value })}
                />
              </Field>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1.5" role="group" aria-label="Event impact">
                {IMPACTS.map((impact) => (
                  <button
                    key={impact}
                    type="button"
                    aria-pressed={draft.impact === impact}
                    onClick={() => setDraft({ ...draft, impact })}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors",
                      draft.impact === impact
                        ? impact === "high"
                          ? "border-accent bg-accent/15 text-accent"
                          : impact === "medium"
                            ? "border-warn/50 bg-warn/10 text-warn"
                            : "border-white/25 bg-white/[0.06] text-foreground"
                        : "border-white/[0.1] text-muted-foreground hover:border-white/[0.24] hover:text-foreground",
                    )}
                  >
                    {impact}
                  </button>
                ))}
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                Stay flat around the print
                <Switch
                  aria-label="Stay flat around the print"
                  checked={draft.avoid}
                  onCheckedChange={(avoid) => setDraft({ ...draft, avoid })}
                />
              </label>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={save}
              disabled={!draft.name.trim()}
              className="mt-3 w-full sm:w-auto"
            >
              <Plus aria-hidden="true" /> Add event
            </Button>
          </div>

          {sorted.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/[0.1] px-3 py-6 text-center text-sm text-muted-foreground">
              No events on the calendar.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {sorted.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2"
                >
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {event.date} · {event.time}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {event.name || "Untitled event"}
                  </span>
                  <span
                    className={cn(
                      "rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]",
                      event.impact === "high"
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : event.impact === "medium"
                          ? "border-warn/40 bg-warn/10 text-warn"
                          : "border-white/[0.12] text-muted-foreground",
                    )}
                  >
                    {event.impact}
                  </span>
                  {event.avoid ? (
                    <span className="rounded-sm border border-down/35 bg-down/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-down">
                      Flat
                    </span>
                  ) : null}
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDraft({ ...event })}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${event.name}`}
                      onClick={() => setDeleteId(event.id)}
                      className="text-muted-foreground hover:text-down"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <ConfirmDelete
          open={!!deleteId}
          onOpenChange={(next) => !next && setDeleteId(null)}
          title="Delete event?"
          description={`${pending?.name ?? "This event"} will be removed from the calendar.`}
          confirmLabel="Delete event"
          onConfirm={() => {
            if (deleteId) {
              removeNews(deleteId);
              toast.success("Event removed");
            }
            setDeleteId(null);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
