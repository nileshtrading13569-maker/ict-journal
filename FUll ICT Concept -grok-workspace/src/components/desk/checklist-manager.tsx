import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDeskStore } from "@/lib/ict-store";
import type { ChecklistItem } from "@/lib/ict-types";
import { cn, uid } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDelete } from "./confirm-delete";

type Group = ChecklistItem["group"];

const GROUPS: { value: Group; label: string; hint: string }[] = [
  { value: "core", label: "Core", hint: "Checked every session" },
  { value: "conditional", label: "Conditional", hint: "Only when the model needs it" },
  { value: "lifestyle", label: "Lifestyle", hint: "The state you trade in" },
];

export function ChecklistManager({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const items = useDeskStore((s) => s.checklistItems);
  const upsertChecklistItem = useDeskStore((s) => s.upsertChecklistItem);
  const removeChecklistItem = useDeskStore((s) => s.removeChecklistItem);
  const [draft, setDraft] = useState("");
  const [draftGroup, setDraftGroup] = useState<Group>("core");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const pending = items.find((item) => item.id === deleteId);

  const addItem = () => {
    const label = draft.trim();
    if (!label) return;
    const item: ChecklistItem = { id: uid("check"), group: draftGroup, label };
    upsertChecklistItem(item);
    setDraft("");
    toast.success("Checklist item added");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Checklist items</DialogTitle>
          <DialogDescription>
            Core items count toward the daily gate score. Conditional and lifestyle items are recorded
            but never block execution.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          <div className="mb-4 rounded-lg border border-white/[0.09] bg-white/[0.02] p-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                aria-label="New checklist item"
                placeholder="Add a gate condition…"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addItem();
                }}
              />
              <Button type="button" onClick={addItem} disabled={!draft.trim()} className="shrink-0">
                <Plus aria-hidden="true" /> Add
              </Button>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Group for the new item">
              {GROUPS.map((group) => (
                <button
                  key={group.value}
                  type="button"
                  aria-pressed={draftGroup === group.value}
                  onClick={() => setDraftGroup(group.value)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    draftGroup === group.value
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-white/[0.1] text-muted-foreground hover:border-white/[0.24] hover:text-foreground",
                  )}
                >
                  {group.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            {GROUPS.map((group) => {
              const groupItems = items.filter((item) => item.group === group.value);
              return (
                <section key={group.value}>
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <h3 className="text-[10px] font-semibold tracking-[0.16em] text-accent uppercase">
                      {group.label}
                    </h3>
                    <span className="text-[11px] text-muted-foreground">
                      {groupItems.length} · {group.hint}
                    </span>
                  </div>
                  {groupItems.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-white/[0.1] px-3 py-2.5 text-xs text-muted-foreground">
                      Nothing here yet.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {groupItems.map((item) => (
                        <li key={item.id} className="flex items-center gap-2">
                          <Input
                            aria-label={`Label for ${item.label}`}
                            value={item.label}
                            onChange={(event) =>
                              upsertChecklistItem({ ...item, label: event.target.value })
                            }
                            className="h-9"
                          />
                          <select
                            aria-label={`Group for ${item.label}`}
                            value={item.group}
                            onChange={(event) =>
                              upsertChecklistItem({ ...item, group: event.target.value as Group })
                            }
                            className="h-9 shrink-0 rounded-md border border-white/[0.09] bg-surface-2/80 px-2 text-xs text-foreground outline-none focus-visible:border-accent/60"
                          >
                            {GROUPS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete ${item.label}`}
                            onClick={() => setDeleteId(item.id)}
                            className="shrink-0 text-muted-foreground hover:text-down"
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </div>

        <ConfirmDelete
          open={!!deleteId}
          onOpenChange={(next) => !next && setDeleteId(null)}
          title="Delete checklist item?"
          description={`"${pending?.label ?? ""}" will be removed from every future checklist. Past days keep their recorded checks.`}
          confirmLabel="Delete item"
          onConfirm={() => {
            if (deleteId) {
              removeChecklistItem(deleteId);
              toast.success("Checklist item deleted");
            }
            setDeleteId(null);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
