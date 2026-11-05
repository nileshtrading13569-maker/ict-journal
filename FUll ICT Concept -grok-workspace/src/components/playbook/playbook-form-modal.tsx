import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Plus, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { deskSnapshot, useDeskStore } from "@/lib/ict-store";
import { syncDeskToServer } from "@/lib/desk-sync";
import { uid } from "@/lib/utils";
import type { SetupModel } from "@/lib/ict-types";

interface PlaybookFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: SetupModel | null;
  onSaved?: (model: SetupModel) => void;
}

export function PlaybookFormModal({ open, onOpenChange, model, onSaved }: PlaybookFormModalProps) {
  const models = useDeskStore((s) => s.models);
  const upsertModel = useDeskStore((s) => s.upsertModel);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [market, setMarket] = useState("XAUUSD");
  const [timeframe, setTimeframe] = useState("1H → 5m");
  const [htfNarrative, setHtfNarrative] = useState("");
  const [liquidityCondition, setLiquidityCondition] = useState("");
  const [pdArray, setPdArray] = useState("");
  const [trigger, setTrigger] = useState("");
  const [invalidation, setInvalidation] = useState("");
  const [target, setTarget] = useState("");
  const [requiredTiming, setRequiredTiming] = useState("");
  const [description, setDescription] = useState("");
  const [canvasBlueprint, setCanvasBlueprint] = useState("");
  const [validWhen, setValidWhen] = useState<string[]>([]);
  const [invalidWhen, setInvalidWhen] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [newValidRule, setNewValidRule] = useState("");
  const [newInvalidRule, setNewInvalidRule] = useState("");
  const [saving, setSaving] = useState(false);

  const prevOpenRef = useRef(false);
  const prevModelIdRef = useRef<string | null>(null);

  useEffect(() => {
    const isOpening = open && !prevOpenRef.current;
    const modelSwitched = open && model?.id !== prevModelIdRef.current;

    if (isOpening || modelSwitched) {
      if (model) {
        setCode(model.code || "");
        setName(model.name || "");
        setMarket(model.market || "XAUUSD");
        setTimeframe(model.timeframe || "1H → 5m");
        setHtfNarrative(model.htfNarrative || "");
        setLiquidityCondition(model.liquidityCondition || "");
        setPdArray(model.pdArray || "");
        setTrigger(model.trigger || "");
        setInvalidation(model.invalidation || "");
        setTarget(model.target || "");
        setRequiredTiming(model.requiredTiming || "");
        setDescription(model.description || (model as { notes?: string }).notes || "");
        setCanvasBlueprint(model.canvasBlueprint || (model as { snapshot?: string }).snapshot || "");
        setValidWhen(model.validWhen ? [...model.validWhen] : []);
        setInvalidWhen(model.invalidWhen ? [...model.invalidWhen] : []);
        setActive(model.active !== false);
      } else {
        // Suggest next letter
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const usedCodes = new Set(models.map((m) => m.code.toUpperCase()));
        let nextCode = "A";
        for (let i = 0; i < letters.length; i++) {
          if (!usedCodes.has(letters[i])) {
            nextCode = letters[i];
            break;
          }
        }

        setCode(nextCode);
        setName("");
        setMarket("XAUUSD");
        setTimeframe("1H → 5m");
        setHtfNarrative("");
        setLiquidityCondition("");
        setPdArray("");
        setTrigger("");
        setInvalidation("");
        setTarget("");
        setRequiredTiming("");
        setDescription("");
        setCanvasBlueprint("");
        setValidWhen(["HTF aligned", "Liquidity swept", "Kill zone timing"]);
        setInvalidWhen(["Mid-range", "Already delivered"]);
        setActive(true);
      }
      setNewValidRule("");
      setNewInvalidRule("");
    }

    prevOpenRef.current = open;
    prevModelIdRef.current = model?.id ?? null;
  }, [open, model, models]);

  const addValidRule = () => {
    const val = newValidRule.trim();
    if (val && !validWhen.includes(val)) {
      setValidWhen([...validWhen, val]);
      setNewValidRule("");
    }
  };

  const removeValidRule = (index: number) => {
    setValidWhen(validWhen.filter((_, i) => i !== index));
  };

  const addInvalidRule = () => {
    const val = newInvalidRule.trim();
    if (val && !invalidWhen.includes(val)) {
      setInvalidWhen([...invalidWhen, val]);
      setNewInvalidRule("");
    }
  };

  const removeInvalidRule = (index: number) => {
    setInvalidWhen(invalidWhen.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();

    if (!trimmedName) {
      toast.error("Please enter a playbook name.");
      return;
    }
    if (!trimmedCode) {
      toast.error("Please enter a playbook code.");
      return;
    }

    // Check code duplication
    const duplicate = models.find(
      (m) => m.id !== model?.id && m.code.toUpperCase() === trimmedCode,
    );
    if (duplicate) {
      toast.error(`Code '${trimmedCode}' is already used by ${duplicate.name}.`);
      return;
    }

    // Auto-include any rule the user typed into the input but didn't click Add before saving
    const finalValid = [...validWhen];
    const pendingValid = newValidRule.trim();
    if (pendingValid && !finalValid.includes(pendingValid)) {
      finalValid.push(pendingValid);
    }

    const finalInvalid = [...invalidWhen];
    const pendingInvalid = newInvalidRule.trim();
    if (pendingInvalid && !finalInvalid.includes(pendingInvalid)) {
      finalInvalid.push(pendingInvalid);
    }

    const updatedModel: SetupModel = {
      ...(model ?? {}),
      id: model?.id ?? `model-${uid()}`,
      code: trimmedCode,
      name: trimmedName,
      market: market.trim() || "XAUUSD",
      timeframe: timeframe.trim() || "1H → 5m",
      htfNarrative: htfNarrative.trim(),
      liquidityCondition: liquidityCondition.trim(),
      pdArray: pdArray.trim(),
      trigger: trigger.trim(),
      invalidation: invalidation.trim(),
      target: target.trim(),
      requiredTiming: requiredTiming.trim(),
      validWhen: finalValid.map((s) => s.trim()).filter(Boolean),
      invalidWhen: finalInvalid.map((s) => s.trim()).filter(Boolean),
      active,
      description: description.trim(),
      ...(canvasBlueprint.trim() ? { canvasBlueprint: canvasBlueprint.trim() } : {}),
    };

    setSaving(true);
    const prevModels = useDeskStore.getState().models;
    try {
      upsertModel(updatedModel);
      const snapshot = deskSnapshot();
      await syncDeskToServer(snapshot);
      toast.success(model ? "Playbook updated" : "Playbook created");
      onSaved?.(updatedModel);
      onOpenChange(false);
    } catch (err) {
      console.error("[playbook-form] save error:", err);
      useDeskStore.setState({ models: prevModels });
      toast.error("Failed to save playbook to cloud. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby="playbook-form-desc"
        className="max-h-[92vh] w-[95vw] max-w-[720px] overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0c0c0c] p-0 text-[#f5f5f4] shadow-[0_30px_90px_-20px_rgba(0,0,0,0.95)]"
      >
        <DialogTitle className="sr-only">
          {model ? "Edit playbook" : "Create playbook"}
        </DialogTitle>
        <DialogDescription id="playbook-form-desc" className="sr-only">
          Configure playbook rules, criteria, and timing.
        </DialogDescription>

        {/* 6. Decorative Progress Top Border */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#e50914] to-transparent" />

        {/* Header - DialogContent provides top-4 right-4 close button, pr-14 prevents collision */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.07] pl-6 pr-14">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="font-display text-[20px] sm:text-[22px] font-bold leading-none text-white truncate">
              {model ? "Edit playbook" : "Create playbook"}
            </h2>
            {code ? (
              <span className="font-mono inline-flex shrink-0 items-center rounded-md border border-[#e50914]/40 bg-[#e50914]/10 px-2 py-0.5 text-[11px] font-bold text-[#e50914]">
                Code [{code}]
              </span>
            ) : null}
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="max-h-[calc(92vh-140px)] min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            {/* 1. SECTION 1: IDENTITY */}
            <div className="space-y-3.5">
              <div className="flex items-center gap-2 border-l-2 border-[#e50914] pl-2.5 text-[11px] font-semibold uppercase tracking-wider text-white">
                Identity
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                    Code
                  </label>
                  <Input
                    type="text"
                    maxLength={4}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="A"
                    className="font-mono h-10 border-white/[0.09] bg-[#151515]/80 text-[14px] font-bold text-[#e50914] focus:border-[#e50914]"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                    Playbook name
                  </label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Sell-side raid reversal"
                    className="h-10 border-white/[0.09] bg-[#151515]/80 text-[13px] font-semibold text-white focus:border-[#e50914]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                    Market / Asset
                  </label>
                  <Input
                    type="text"
                    value={market}
                    onChange={(e) => setMarket(e.target.value)}
                    placeholder="XAUUSD"
                    className="font-mono h-10 border-white/[0.09] bg-[#151515]/80 text-[13px] text-white focus:border-[#e50914]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                    Timeframe
                  </label>
                  <Input
                    type="text"
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    placeholder="1H → 5m"
                    className="font-mono h-10 border-white/[0.09] bg-[#151515]/80 text-[13px] text-white focus:border-[#e50914]"
                  />
                </div>
              </div>
            </div>

            {/* 2. SECTION 2: SETUP CONTEXT */}
            <div className="space-y-3.5">
              <div className="flex items-center gap-2 border-l-2 border-[#e50914] pl-2.5 text-[11px] font-semibold uppercase tracking-wider text-white">
                Setup Context
              </div>

              {/* 5. HTF Narrative as Textarea */}
              <div>
                <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                  HTF narrative &amp; Context
                </label>
                <Textarea
                  value={htfNarrative}
                  onChange={(e) => setHtfNarrative(e.target.value)}
                  placeholder="Bearish weekly/daily. Price in premium of the dealing range..."
                  rows={2}
                  className="resize-none border-white/[0.09] bg-[#151515]/80 text-[13px] text-white placeholder-[#6f6f6d] focus:border-[#e50914]"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                    Liquidity condition
                  </label>
                  <Input
                    type="text"
                    value={liquidityCondition}
                    onChange={(e) => setLiquidityCondition(e.target.value)}
                    placeholder="SSL / PDL / Asia low taken first."
                    className="h-10 border-white/[0.09] bg-[#151515]/80 text-[13px] text-white focus:border-[#e50914]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                    PD Array
                  </label>
                  <Input
                    type="text"
                    value={pdArray}
                    onChange={(e) => setPdArray(e.target.value)}
                    placeholder="1H or 15m bearish FVG / OB in premium."
                    className="h-10 border-white/[0.09] bg-[#151515]/80 text-[13px] text-white focus:border-[#e50914]"
                  />
                </div>
              </div>
            </div>

            {/* 3. SECTION 3: EXECUTION RULES */}
            <div className="space-y-3.5">
              <div className="flex items-center gap-2 border-l-2 border-[#e50914] pl-2.5 text-[11px] font-semibold uppercase tracking-wider text-white">
                Execution Rules
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                    Trigger
                  </label>
                  <Input
                    type="text"
                    value={trigger}
                    onChange={(e) => setTrigger(e.target.value)}
                    placeholder="MSS + displacement + 5m FVG."
                    className="h-10 border-white/[0.09] bg-[#151515]/80 text-[13px] text-white focus:border-[#e50914]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                    Invalidation
                  </label>
                  <Input
                    type="text"
                    value={invalidation}
                    onChange={(e) => setInvalidation(e.target.value)}
                    placeholder="Close back beyond the swept structural extreme."
                    className="h-10 border-white/[0.09] bg-[#151515]/80 text-[13px] text-white focus:border-[#e50914]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                    Target
                  </label>
                  <Input
                    type="text"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="BSL / PDH / opposing external."
                    className="h-10 border-white/[0.09] bg-[#151515]/80 text-[13px] text-white focus:border-[#e50914]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                    Required timing / session
                  </label>
                  <Input
                    type="text"
                    value={requiredTiming}
                    onChange={(e) => setRequiredTiming(e.target.value)}
                    placeholder="NY AM kill zone (09:30–11:00 ET)"
                    className="h-10 border-white/[0.09] bg-[#151515]/80 text-[13px] text-white focus:border-[#e50914]"
                  />
                </div>
              </div>
            </div>

            {/* 4. SECTION 4: CHECKLIST RULES */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-l-2 border-[#e50914] pl-2.5 text-[11px] font-semibold uppercase tracking-wider text-white">
                Checklist Rules
              </div>

              {/* 3. Valid When Rules (Green Pills) */}
              <div>
                <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#3ddc84] uppercase">
                  Valid When (Required Conditions)
                </label>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {validWhen.map((rule, idx) => (
                      <div
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#3ddc84]/30 bg-[#3ddc84]/10 px-3 py-1.5 text-[12px] text-[#3ddc84]"
                      >
                        <Check className="size-3.5 stroke-[2.5]" />
                        <span>{rule}</span>
                        <button
                          type="button"
                          onClick={() => removeValidRule(idx)}
                          className="ml-1 text-[#3ddc84]/60 transition-colors hover:text-[#ff6b7d]"
                          aria-label={`Remove rule ${rule}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      type="text"
                      value={newValidRule}
                      onChange={(e) => setNewValidRule(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addValidRule())}
                      placeholder="Add a required condition..."
                      className="h-9 border-white/[0.09] bg-[#151515]/80 text-[12px] text-white focus:border-[#3ddc84]"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={addValidRule}
                      className="h-9 shrink-0 border border-white/[0.1] bg-white/[0.04] px-3.5 text-xs text-white hover:bg-white/[0.08]"
                    >
                      <Plus className="mr-1 size-3.5" /> Add
                    </Button>
                  </div>
                </div>
              </div>

              {/* 4. Invalid When Rules (Red Pills) */}
              <div>
                <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#ff6b7d] uppercase">
                  Invalid When (Disqualifiers)
                </label>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {invalidWhen.map((rule, idx) => (
                      <div
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#ff6b7d]/30 bg-[#ff6b7d]/10 px-3 py-1.5 text-[12px] text-[#ff6b7d]"
                      >
                        <X className="size-3.5 stroke-[2.5]" />
                        <span>{rule}</span>
                        <button
                          type="button"
                          onClick={() => removeInvalidRule(idx)}
                          className="ml-1 text-[#ff6b7d]/60 transition-colors hover:text-[#ff6b7d]"
                          aria-label={`Remove disqualifier ${rule}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      type="text"
                      value={newInvalidRule}
                      onChange={(e) => setNewInvalidRule(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInvalidRule())}
                      placeholder="Add a disqualifier..."
                      className="h-9 border-white/[0.09] bg-[#151515]/80 text-[12px] text-white focus:border-[#ff6b7d]"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={addInvalidRule}
                      className="h-9 shrink-0 border border-white/[0.1] bg-white/[0.04] px-3.5 text-xs text-white hover:bg-white/[0.08]"
                    >
                      <Plus className="mr-1 size-3.5" /> Add
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. SECTION 5: NOTES & OBSERVATIONS */}
            <div className="space-y-3.5">
              <div className="flex items-center gap-2 border-l-2 border-[#e50914] pl-2.5 text-[11px] font-semibold uppercase tracking-wider text-white">
                Strategy Notes &amp; Blueprint
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                  Strategy Notes &amp; Tape Observations
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Record trade nuances, tape reading observations, or setup rules..."
                  rows={3}
                  className="resize-none border-white/[0.09] bg-[#151515]/80 text-[13px] text-white placeholder-[#6f6f6d] focus:border-[#e50914]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-medium tracking-wider text-[#a2a2a0] uppercase">
                  Canvas Diagram / Snapshot URL (Optional)
                </label>
                <Input
                  type="text"
                  value={canvasBlueprint}
                  onChange={(e) => setCanvasBlueprint(e.target.value)}
                  placeholder="https://... or diagram image link"
                  className="font-mono h-10 border-white/[0.09] bg-[#151515]/80 text-[13px] text-white focus:border-[#e50914]"
                />
              </div>
            </div>

            {/* 6. Active Toggle (Switch Component) */}
            <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-[#141414] p-3.5">
              <div className="space-y-0.5">
                <label htmlFor="model-active-switch" className="cursor-pointer text-[13px] font-semibold text-white">
                  Active playbook
                </label>
                <p className="text-[11px] text-[#a2a2a0]">
                  Active playbooks show in trade log dropdowns and active terminal views
                </p>
              </div>
              <Switch
                id="model-active-switch"
                checked={active}
                onCheckedChange={setActive}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex h-16 shrink-0 items-center justify-end gap-2.5 border-t border-white/[0.07] px-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-10 border-white/[0.1] bg-white/[0.03] px-4 text-[13px] text-white hover:bg-white/[0.08]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-10 bg-[#e50914] px-4 text-[13px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(229,9,20,0.9)] transition-all hover:brightness-110 active:scale-[0.98]"
          >
            {saving ? "Saving…" : model ? "Save changes" : "Create playbook"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
