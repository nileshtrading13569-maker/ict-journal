import { useState, useMemo } from "react";
import { Check, X, AlertTriangle, ShieldCheck, ArrowRight, Zap, Target } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDeskStore } from "@/lib/ict-store";
import type { SetupModel } from "@/lib/ict-types";

interface ConfluenceGraderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTakeTrade?: (model: SetupModel, tier: "A+" | "A" | "B" | "C", assessment: Record<string, "followed" | "not">) => void;
  initialModelId?: string;
}

export function ConfluenceGraderModal({
  open,
  onOpenChange,
  onTakeTrade,
  initialModelId,
}: ConfluenceGraderModalProps) {
  const allModels = useDeskStore((s) => s.models);
  const models = useMemo(() => allModels.filter((m) => m.active), [allModels]);
  const [selectedModelId, setSelectedModelId] = useState<string>(initialModelId || "");
  const [checkedRules, setCheckedRules] = useState<Record<string, boolean>>({});
  const [checkedDisqualifiers, setCheckedDisqualifiers] = useState<Record<string, boolean>>({});
  const [selectedTier, setSelectedTier] = useState<"A+" | "A" | "B" | "C">("A");

  const model = useMemo(() => {
    return models.find((m) => m.id === selectedModelId) || models[0];
  }, [models, selectedModelId]);

  const validRules = useMemo(() => {
    return model?.validWhen || [
      "HTF narrative aligned with draw on liquidity",
      "Key liquidity pool swept (BSL / SSL)",
      "High displacement with FVG / MSS confirmation",
      "Session kill zone timing confluence",
    ];
  }, [model]);

  const invalidRules = useMemo(() => {
    return model?.invalidWhen || [
      "Price trading in mid-range of dealing range",
      "Opposing HTF key level unmitigated",
      "Target already delivered before entry",
    ];
  }, [model]);

  // Calculate adherence
  const totalValid = validRules.length;
  const followedCount = validRules.filter((r) => checkedRules[r]).length;
  const adherencePct = totalValid > 0 ? Math.round((followedCount / totalValid) * 100) : 100;
  const hasDisqualifier = invalidRules.some((r) => checkedDisqualifiers[r]);

  const toggleRule = (rule: string) => {
    setCheckedRules((prev) => ({ ...prev, [rule]: !prev[rule] }));
  };

  const toggleDisqualifier = (rule: string) => {
    setCheckedDisqualifiers((prev) => ({ ...prev, [rule]: !prev[rule] }));
  };

  const handleTakeTrade = () => {
    if (!model) return;
    const assessment: Record<string, "followed" | "not"> = {};
    validRules.forEach((r) => {
      assessment[r] = checkedRules[r] ? "followed" : "not";
    });
    onOpenChange(false);
    onTakeTrade?.(model, selectedTier, assessment);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby="confluence-grader-desc"
        className="max-h-[92vh] w-[95vw] max-w-[620px] overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0c0c0c] p-0 text-[#f5f5f4] shadow-[0_30px_90px_-20px_rgba(0,0,0,0.95)]"
      >
        <DialogTitle className="sr-only">Pre-Flight Confluence Grader</DialogTitle>
        <DialogDescription id="confluence-grader-desc" className="sr-only">
          Grade setup confluence against playbook rules and select execution tier.
        </DialogDescription>

        {/* Decorative Top Accent */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#e50914] to-transparent" />

        {/* Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.07] pl-6 pr-14">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg border border-[#e50914]/30 bg-[#e50914]/10 text-[#e50914]">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <h2 className="font-display text-[19px] font-bold leading-none text-white">
                Pre-Flight Confluence Grader
              </h2>
              <p className="mt-1 text-[11px] text-[#a2a2a0]">
                Evaluate setup rules &amp; assign execution tier before entry
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[calc(92vh-140px)] min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Playbook Setup Selector */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold tracking-wider text-[#a2a2a0] uppercase">
              Select Playbook Setup
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {models.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSelectedModelId(m.id);
                    setCheckedRules({});
                    setCheckedDisqualifiers({});
                  }}
                  className={`flex items-center gap-2 rounded-lg border p-2.5 text-left transition-all ${
                    model?.id === m.id
                      ? "border-[#e50914] bg-[#e50914]/10 shadow-[0_0_15px_-3px_rgba(229,9,20,0.3)]"
                      : "border-white/[0.08] bg-[#141414] hover:border-white/[0.18]"
                  }`}
                >
                  <span className="font-mono flex size-6 shrink-0 items-center justify-center rounded bg-[#e50914]/20 text-[11px] font-bold text-[#e50914]">
                    {m.code}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold text-white">{m.name}</p>
                    <p className="font-mono text-[10px] text-[#a2a2a0]">{m.market}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Adherence & Tier Selection Banner */}
          <div className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-[#121212] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-[10px] font-semibold tracking-wider text-[#a2a2a0] uppercase">
                Confluence Adherence
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className={`font-mono text-2xl font-bold ${
                    hasDisqualifier
                      ? "text-[#ff6b7d]"
                      : adherencePct >= 80
                      ? "text-[#3ddc84]"
                      : adherencePct >= 60
                      ? "text-[#f5b942]"
                      : "text-[#a2a2a0]"
                  }`}
                >
                  {hasDisqualifier ? "DISQUALIFIED" : `${adherencePct}%`}
                </span>
                {!hasDisqualifier && (
                  <span className="font-mono text-[11px] text-[#a2a2a0]">
                    ({followedCount} of {totalValid} rules)
                  </span>
                )}
              </div>
            </div>

            {/* Simple Tier Toggle */}
            <div>
              <span className="text-[10px] font-semibold tracking-wider text-[#a2a2a0] uppercase">
                Execution Tier (Selectable)
              </span>
              <div className="mt-1 flex items-center gap-1">
                {(["A+", "A", "B", "C"] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setSelectedTier(tier)}
                    className={`font-mono flex h-8 min-w-9 items-center justify-center rounded-md border text-[12px] font-bold transition-all ${
                      selectedTier === tier
                        ? "border-[#e50914] bg-[#e50914] text-white shadow-sm"
                        : "border-white/[0.1] bg-white/[0.03] text-[#a2a2a0] hover:text-white"
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Disqualifier Warning Alert */}
          {hasDisqualifier && (
            <div className="flex items-center gap-2.5 rounded-lg border border-[#ff6b7d]/40 bg-[#ff6b7d]/10 p-3 text-[12px] text-[#ff6b7d]">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                <strong>Warning:</strong> A disqualifier rule is active. ICT playbook suggests waiting for a cleaner setup.
              </span>
            </div>
          )}

          {/* Valid Rules Checklist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider text-[#3ddc84] uppercase">
                ✓ Valid Confluence Checklist
              </span>
              <span className="text-[11px] text-[#a2a2a0]">Check what applies</span>
            </div>
            <div className="space-y-1.5">
              {validRules.map((r) => {
                const checked = !!checkedRules[r];
                return (
                  <div
                    key={r}
                    onClick={() => toggleRule(r)}
                    className={`flex cursor-pointer items-center justify-between rounded-lg border p-2.5 text-[12px] transition-all ${
                      checked
                        ? "border-[#3ddc84]/40 bg-[#3ddc84]/10 text-white"
                        : "border-white/[0.06] bg-[#141414] text-[#a2a2a0] hover:border-white/[0.14]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex size-4.5 shrink-0 items-center justify-center rounded border transition-colors ${
                          checked
                            ? "border-[#3ddc84] bg-[#3ddc84] text-black"
                            : "border-white/[0.2] bg-white/[0.02]"
                        }`}
                      >
                        {checked && <Check className="size-3 stroke-[3]" />}
                      </div>
                      <span className={checked ? "font-medium text-white" : ""}>{r}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Disqualifiers Checklist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider text-[#ff6b7d] uppercase">
                ✕ Disqualifier Checks
              </span>
              <span className="text-[11px] text-[#a2a2a0]">Flag if present</span>
            </div>
            <div className="space-y-1.5">
              {invalidRules.map((r) => {
                const checked = !!checkedDisqualifiers[r];
                return (
                  <div
                    key={r}
                    onClick={() => toggleDisqualifier(r)}
                    className={`flex cursor-pointer items-center justify-between rounded-lg border p-2.5 text-[12px] transition-all ${
                      checked
                        ? "border-[#ff6b7d]/50 bg-[#ff6b7d]/15 text-white"
                        : "border-white/[0.06] bg-[#141414] text-[#a2a2a0] hover:border-white/[0.14]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex size-4.5 shrink-0 items-center justify-center rounded border transition-colors ${
                          checked
                            ? "border-[#ff6b7d] bg-[#ff6b7d] text-white"
                            : "border-white/[0.2] bg-white/[0.02]"
                        }`}
                      >
                        {checked && <X className="size-3 stroke-[3]" />}
                      </div>
                      <span className={checked ? "font-medium text-[#ff6b7d]" : ""}>{r}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex h-16 shrink-0 items-center justify-between border-t border-white/[0.07] px-6">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#a2a2a0]">Selected Tier:</span>
            <span className="font-mono rounded bg-white/[0.1] px-2 py-0.5 text-[12px] font-bold text-white">
              Tier {selectedTier}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-9 border-white/[0.1] bg-white/[0.03] text-xs text-white hover:bg-white/[0.08]"
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={handleTakeTrade}
              className="h-9 gap-1.5 bg-[#e50914] px-4 text-xs font-semibold text-white shadow-md hover:brightness-110 active:scale-95"
            >
              <span>Take Trade</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
