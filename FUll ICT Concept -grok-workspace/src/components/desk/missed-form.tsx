import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MISS_OUTCOMES, MISS_REASONS, type MissedTrade } from "@/lib/ict-types";
import { emptyMissed } from "@/lib/ict-defaults";
import { nowHHMM } from "@/lib/ict-time";
import { todayISO } from "@/lib/utils";
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
import { BoolRow, Chips, Field } from "./fields";

function one<T>(v: T | T[]): T {
  return (Array.isArray(v) ? v[0] : v) as T;
}

export function MissedForm({
  open,
  onOpenChange,
  row,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: MissedTrade | null;
}) {
  const upsert = useDeskStore((s) => s.upsertMissed);
  const [form, setForm] = useState<MissedTrade>(emptyMissed(todayISO(), nowHHMM()));

  useEffect(() => {
    if (!open) return;
    setForm(row ?? emptyMissed(todayISO(), nowHHMM()));
  }, [open, row]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{row ? "Edit missed trade" : "Missed trade"}</DialogTitle>
          <DialogDescription>
            Hesitation is data. Record the setup you saw and what price did without you.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Time (NY)">
              <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Market">
              <Input value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value })} />
            </Field>
            <Field label="Side">
              <Chips
                options={["long", "short"] as const}
                value={form.side}
                onChange={(v) => setForm({ ...form, side: one(v) })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <BoolRow
              label="Narrative valid"
              value={form.narrativeValid}
              onChange={(v) => setForm({ ...form, narrativeValid: v })}
            />
            <BoolRow
              label="Liquidity swept"
              value={form.liquiditySwept}
              onChange={(v) => setForm({ ...form, liquiditySwept: v })}
            />
            <BoolRow
              label="PD array present"
              value={form.pdArrayPresent}
              onChange={(v) => setForm({ ...form, pdArrayPresent: v })}
            />
            <BoolRow
              label="Trigger occurred"
              value={form.triggerOccurred}
              onChange={(v) => setForm({ ...form, triggerOccurred: v })}
            />
          </div>
          <Field label="Why I didn't enter">
            <Chips
              options={MISS_REASONS}
              value={form.why}
              onChange={(v) => setForm({ ...form, why: one(v) })}
            />
          </Field>
          <Field label="What happened after">
            <Chips
              options={MISS_OUTCOMES}
              value={form.outcome}
              onChange={(v) => setForm({ ...form, outcome: one(v) })}
            />
          </Field>
          <Field label="Notes">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              upsert(form);
              toast.success("Missed trade saved");
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
