import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Palette, Type } from "lucide-react";
import { deskSnapshot, useDeskStore } from "@/lib/ict-store";
import { authEnabled } from "@/lib/auth/client";
import { isDeskData, saveDeskState } from "@/lib/desk-sync";
import { createResetState } from "@/lib/ict-defaults";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { ConfirmDelete } from "./confirm-delete";
import { Field } from "./fields";
import { TRADING_TZ } from "@/lib/ict-time";
import { cn } from "@/lib/utils";
import {
  CURATED_FONT_PAIRINGS,
  FONT_THEMES,
  FONT_STORAGE_KEY,
  DEFAULT_FONT_THEME,
  applyFontTheme,
  resetFontTheme,
  loadFontPreviewStylesheet,
  type FontTheme,
} from "@/lib/font-themes";
import {
  COLOR_THEMES,
  ACCENT_COLORS,
  DEFAULT_COLOR_THEME,
  DEFAULT_ACCENT_COLOR,
  THEME_STORAGE_KEY,
  ACCENT_STORAGE_KEY,
  applyColorTheme,
  applyAccentColor,
  getThemeById,
  getAccentById,
} from "@/lib/color-themes";

export function SettingsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const data = useDeskStore();
  const patchAccount = useDeskStore((s) => s.patchAccount);
  const setThemeId = useDeskStore((s) => s.setThemeId);
  const setStoreAccentColor = useDeskStore((s) => s.setAccentColor);
  const rebuildProtocolDates = useDeskStore((s) => s.rebuildProtocolDates);
  const resetAll = useDeskStore((s) => s.resetAll);
  const replaceAll = useDeskStore((s) => s.replaceAll);
  const [resetOpen, setResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [colorTheme, setColorTheme] = useState<string>(data.themeId ?? DEFAULT_COLOR_THEME);
  const [accentColor, setAccentColor] = useState<string>(data.accentColor ?? DEFAULT_ACCENT_COLOR);
  const [fontTheme, setFontTheme] = useState<string>("default");

  useEffect(() => {
    try {
      const savedTheme = data.themeId ?? window.localStorage.getItem(THEME_STORAGE_KEY) ?? DEFAULT_COLOR_THEME;
      const savedAccent = data.accentColor ?? window.localStorage.getItem(ACCENT_STORAGE_KEY) ?? DEFAULT_ACCENT_COLOR;
      setColorTheme(savedTheme);
      setAccentColor(savedAccent);
      applyColorTheme(savedTheme, savedAccent);
    } catch (error) {
      console.error("[settings] failed to load theme & accent color:", error);
      applyColorTheme(DEFAULT_COLOR_THEME, DEFAULT_ACCENT_COLOR);
    }

    try {
      const savedFont = window.localStorage.getItem(FONT_STORAGE_KEY);
      if (savedFont && savedFont !== "default") {
        const matched = FONT_THEMES.find((option) => option.id === savedFont);
        if (matched) {
          setFontTheme(matched.id);
          applyFontTheme(matched.id as FontTheme);
        } else {
          setFontTheme("default");
        }
      } else {
        // When unset or explicitly "default", do NOT call applyFontTheme(DEFAULT_FONT_THEME).
        // Leave native stylesheet fonts (IBM Plex Sans body, Plus Jakarta Sans headings) untouched.
        setFontTheme("default");
      }
    } catch (error) {
      console.error("[settings] failed to load font theme:", error);
      setFontTheme("default");
    }
  }, [data.themeId, data.accentColor]);

  // Preload curated font preview stylesheet when settings drawer is opened
  useEffect(() => {
    if (open) {
      loadFontPreviewStylesheet();
    }
  }, [open]);

  const handleColorThemeChange = (newThemeId: string) => {
    setColorTheme(newThemeId);
    const targetTheme = getThemeById(newThemeId);
    const newAccent = targetTheme.defaultAccent;
    setAccentColor(newAccent);
    applyColorTheme(newThemeId, newAccent);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, newThemeId);
      window.localStorage.setItem(ACCENT_STORAGE_KEY, newAccent);
      setThemeId(newThemeId);
      setStoreAccentColor(newAccent);
      toast.success(`Theme updated to ${targetTheme.name}`);
    } catch (error) {
      console.error("[settings] failed to save theme:", error);
      toast.error("Theme changed for this session but could not be saved.");
    }
  };

  const handleAccentColorChange = (newAccentId: string) => {
    setAccentColor(newAccentId);
    applyAccentColor(newAccentId);
    try {
      window.localStorage.setItem(ACCENT_STORAGE_KEY, newAccentId);
      setStoreAccentColor(newAccentId);
      const accent = getAccentById(newAccentId);
      toast.success(`Accent color set to ${accent.name}`);
    } catch (error) {
      console.error("[settings] failed to save accent color:", error);
      toast.error("Color changed for this session but could not be saved.");
    }
  };

  const handleFontThemeChange = (selectedId: string) => {
    setFontTheme(selectedId);

    if (selectedId === "default") {
      resetFontTheme();
      try {
        window.localStorage.removeItem(FONT_STORAGE_KEY);
        toast.success("Typography reset to TradeZella default");
      } catch (error) {
        console.error("[settings] failed to reset font theme:", error);
        toast.error("Font reset for this session but could not be saved.");
      }
      return;
    }

    applyFontTheme(selectedId as FontTheme);
    try {
      window.localStorage.setItem(FONT_STORAGE_KEY, selectedId);
      const matchedFont =
        (CURATED_FONT_PAIRINGS && CURATED_FONT_PAIRINGS.find((f) => f.id === selectedId)) ??
        FONT_THEMES.find((f) => f.id === selectedId);
      toast.success(`Font changed to ${matchedFont?.name ?? selectedId}`);
    } catch (error) {
      console.error("[settings] failed to save font theme:", error);
      toast.error("Font changed for this session but could not be saved.");
    }
  };

  const luxuryAccents = ACCENT_COLORS.filter((a) => a.paletteGroup !== "Cinematic Classics");
  const classicAccents = ACCENT_COLORS.filter((a) => a.paletteGroup === "Cinematic Classics");

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const resetState = createResetState();
      if (authEnabled) {
        await saveDeskState({ data: resetState });
      }
      resetAll(resetState);
      setColorTheme(DEFAULT_COLOR_THEME);
      setAccentColor(DEFAULT_ACCENT_COLOR);
      setFontTheme("default");
      try {
        window.localStorage.removeItem(THEME_STORAGE_KEY);
        window.localStorage.removeItem(ACCENT_STORAGE_KEY);
        window.localStorage.removeItem(FONT_STORAGE_KEY);
      } catch {}
      applyColorTheme(DEFAULT_COLOR_THEME, DEFAULT_ACCENT_COLOR);
      resetFontTheme();
      setResetOpen(false);
      toast.success("All desk data reset");
    } catch (error) {
      console.error("[settings] failed to reset desk data:", error);
      toast.error("Could not reset desk data. Your saved data was not changed.");
    } finally {
      setIsResetting(false);
    }
  };

  const downloadBackup = () => {
    const blob = new Blob([JSON.stringify(deskSnapshot(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `first-payout-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded");
  };

  const restoreBackup = async (file: File) => {
    try {
      if (file.size > 1_000_000) {
        throw new Error("Backup exceeds the 1 MB limit.");
      }
      const parsed: unknown = JSON.parse(await file.text());
      if (!isDeskData(parsed)) {
        throw new Error("This file is not a valid First Payout backup.");
      }
      if (!window.confirm(`Restore ${parsed.trades.length} trades and replace the current desk data?`)) {
        return;
      }
      if (authEnabled) await saveDeskState({ data: parsed });
      replaceAll(parsed);
      toast.success("Desk backup restored");
    } catch (error) {
      console.error("[settings] failed to restore desk backup:", error);
      toast.error(error instanceof Error ? error.message : "Could not restore the backup.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Account rules</SheetTitle>
          <SheetDescription>
            Funded-account constraints plus risk. ICT timing always uses {TRADING_TZ} — not the browser clock.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 p-5">
          {/* Color Themes & Luxury Palettes */}
          <section className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="mb-3">
              <div className="flex items-center gap-1.5 text-accent">
                <Palette className="size-3.5" />
                <h3 className="text-[10px] font-semibold tracking-[0.16em] uppercase">Theme Palettes</h3>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Select a cohesive color atmosphere inspired by soulful elegance, royal jewels, minimalist luxury, and technical gradients.
              </p>
            </div>
            <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Theme Palettes">
              {COLOR_THEMES.map((theme) => {
                const isSelected = colorTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleColorThemeChange(theme.id)}
                    className={cn(
                      "flex flex-col gap-2 rounded-lg border p-3 text-left transition-all",
                      isSelected
                        ? "border-accent bg-accent/10 shadow-xs ring-1 ring-accent/30"
                        : "border-border bg-surface-2 hover:border-accent/40"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-foreground">
                          {theme.name}
                        </span>
                        <span className="rounded border border-white/[0.1] bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                          {theme.badge}
                        </span>
                      </div>
                      {isSelected && (
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                          <Check className="size-3" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {theme.description}
                    </p>
                    <div className="flex items-center gap-1.5 pt-1">
                      {theme.previewColors.map((hex, idx) => (
                        <span
                          key={idx}
                          className="h-3 flex-1 rounded-sm border border-white/10 shadow-inner"
                          style={{ backgroundColor: hex }}
                          title={hex}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Active theme:{" "}
              <span className="font-semibold text-foreground">
                {getThemeById(colorTheme).name}
              </span>
            </p>
          </section>

          {/* Accent Color Section */}
          <section className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="mb-3">
              <h3 className="text-[10px] font-semibold tracking-[0.16em] text-accent uppercase">Accent Color</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Fine-tune the interactive accent signal across charts, buttons, badges, and focus rings.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                  Palette Tones
                </p>
                <div aria-label="Palette accent colors" className="flex flex-wrap gap-2.5" role="group">
                  {luxuryAccents.map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      aria-label={`${color.name} accent (${color.paletteGroup})`}
                      aria-pressed={accentColor === color.id}
                      title={`${color.name} (${color.paletteGroup}) - ${color.value}`}
                      onClick={() => handleAccentColorChange(color.id)}
                      className={`relative size-8 rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                        accentColor === color.id
                          ? "border-foreground scale-110 shadow-md ring-2 ring-accent"
                          : "border-white/20 hover:scale-105"
                      }`}
                      style={{ backgroundColor: color.value }}
                    >
                      {accentColor === color.id && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <Check
                            className="size-3.5"
                            style={{ color: color.foreground }}
                          />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                  Cinematic Classics
                </p>
                <div aria-label="Classic accent colors" className="flex flex-wrap gap-2.5" role="group">
                  {classicAccents.map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      aria-label={`${color.name} accent`}
                      aria-pressed={accentColor === color.id}
                      title={`${color.name} - ${color.value}`}
                      onClick={() => handleAccentColorChange(color.id)}
                      className={`relative size-8 rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                        accentColor === color.id
                          ? "border-foreground scale-110 shadow-md ring-2 ring-accent"
                          : "border-white/20 hover:scale-105"
                      }`}
                      style={{ backgroundColor: color.value }}
                    >
                      {accentColor === color.id && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <Check
                            className="size-3.5"
                            style={{ color: color.foreground }}
                          />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="mt-2.5 text-xs text-muted-foreground">
              Selected accent:{" "}
              <span className="font-semibold text-foreground">
                {getAccentById(accentColor).name} ({getAccentById(accentColor).value})
              </span>
            </p>
          </section>

          {/* Typography & Curated Font Pairings Section */}
          <section className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="mb-3">
              <div className="flex items-center gap-1.5 text-accent">
                <Type className="size-3.5" />
                <h3 className="text-[10px] font-semibold tracking-[0.16em] uppercase">Curated Typography</h3>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Select an editorial font pairing for headings and body text, or keep the platform default.
              </p>
            </div>

            {/* Default Typography Option Card */}
            <div className="mb-3">
              <button
                type="button"
                role="radio"
                aria-checked={fontTheme === "default"}
                onClick={() => handleFontThemeChange("default")}
                className={cn(
                  "flex w-full flex-col gap-2 rounded-lg border p-3 text-left transition-all",
                  fontTheme === "default"
                    ? "border-accent bg-accent/10 shadow-xs ring-1 ring-accent/30"
                    : "border-border bg-surface-2 hover:border-accent/40"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-foreground">
                      Default Typography
                    </span>
                    <span className="rounded border border-white/[0.1] bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                      TradeZella System
                    </span>
                  </div>
                  {fontTheme === "default" && (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <Check className="size-3" />
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Original platform typography with Plus Jakarta Sans headings and IBM Plex Sans body.
                </p>

                {/* Dual Preview for Default */}
                <div className="rounded border border-white/[0.06] bg-black/20 p-2.5">
                  <div className="text-[14px] font-semibold tracking-tight text-white font-display">
                    First Payout · Trade Confirmation
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-300 font-sans">
                    +3.45R · NY AM Silver Bullet · EURUSD Execution
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[9px] text-muted-foreground font-mono">
                    <span>Heading: Plus Jakarta Sans</span>
                    <span>·</span>
                    <span>Body: IBM Plex Sans</span>
                  </div>
                </div>
              </button>
            </div>

            {/* 8 Curated Font Pairings List */}
            <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Curated Typography Pairings">
              {((CURATED_FONT_PAIRINGS && CURATED_FONT_PAIRINGS.length > 0)
                ? CURATED_FONT_PAIRINGS
                : FONT_THEMES.filter((t) => t.category === "curated" || t.number)
              ).map((pairing) => {
                const isSelected = fontTheme === pairing.id;
                return (
                  <button
                    key={pairing.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleFontThemeChange(pairing.id)}
                    className={cn(
                      "flex flex-col gap-2 rounded-lg border p-3 text-left transition-all",
                      isSelected
                        ? "border-accent bg-accent/10 shadow-xs ring-1 ring-accent/30"
                        : "border-border bg-surface-2 hover:border-accent/40"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-foreground">
                          {pairing.name}
                        </span>
                        <span className="rounded border border-white/[0.1] bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                          {pairing.badge}
                        </span>
                      </div>
                      {isSelected && (
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                          <Check className="size-3" />
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      {pairing.description}
                    </p>

                    {/* Dual Preview Container */}
                    <div className="rounded border border-white/[0.06] bg-black/20 p-2.5">
                      <div
                        className="text-[14px] font-semibold tracking-tight text-white"
                        style={{ fontFamily: pairing.display }}
                      >
                        First Payout · Trade Confirmation
                      </div>
                      <div
                        className="mt-0.5 text-[11px] text-zinc-300"
                        style={{ fontFamily: pairing.sans }}
                      >
                        +3.45R · NY AM Silver Bullet · EURUSD Execution
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-[9px] text-muted-foreground font-mono">
                        <span>Heading: {pairing.headingName ?? pairing.display.split(",")[0].replace(/"/g, "")}</span>
                        <span>·</span>
                        <span>Body: {pairing.bodyName ?? pairing.sans.split(",")[0].replace(/"/g, "")}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Font Status Indicator */}
            <p className="mt-2.5 text-xs text-muted-foreground">
              Active font:{" "}
              <span className="font-semibold text-foreground">
                {fontTheme === "default"
                  ? "Default (TradeZella System)"
                  : (FONT_THEMES.find((theme) => theme.id === fontTheme)?.name ??
                     CURATED_FONT_PAIRINGS?.find((p) => p.id === fontTheme)?.name ??
                     fontTheme)}
              </span>
            </p>
          </section>
          <Field label="Account name">
            <Input value={data.accountName} onChange={(e) => patchAccount({ accountName: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starting balance">
              <Input
                type="number"
                value={data.rules.startingBalance}
                onChange={(e) => patchAccount({ startingBalance: Number(e.target.value) })}
              />
            </Field>
            <Field label="Payout threshold %">
              <Input
                type="number"
                step="0.5"
                value={data.rules.payoutThresholdPct}
                onChange={(e) => patchAccount({ payoutThresholdPct: Number(e.target.value) })}
              />
            </Field>
            <Field label="Profit target %">
              <Input
                type="number"
                step="0.5"
                value={data.rules.profitTargetPct}
                onChange={(e) => patchAccount({ profitTargetPct: Number(e.target.value) })}
              />
            </Field>
            <Field label="Profit split %">
              <Input
                type="number"
                value={data.rules.profitSplit}
                onChange={(e) => patchAccount({ profitSplit: Number(e.target.value) })}
              />
            </Field>
            <Field label="Max daily loss %">
              <Input
                type="number"
                step="0.1"
                value={data.rules.maxDailyLossPct}
                onChange={(e) => patchAccount({ maxDailyLossPct: Number(e.target.value) })}
              />
            </Field>
            <Field label="Max total DD %">
              <Input
                type="number"
                step="0.1"
                value={data.rules.maxTotalDrawdownPct}
                onChange={(e) => patchAccount({ maxTotalDrawdownPct: Number(e.target.value) })}
              />
            </Field>
            <Field label="Normal risk %">
              <Input
                type="number"
                step="0.05"
                value={data.rules.normalRiskPct}
                onChange={(e) => patchAccount({ normalRiskPct: Number(e.target.value) })}
              />
            </Field>
            <Field label="High-conviction %">
              <Input
                type="number"
                step="0.05"
                value={data.rules.highConvictionRiskPct}
                onChange={(e) => patchAccount({ highConvictionRiskPct: Number(e.target.value) })}
              />
            </Field>
            <Field label="Max trades / day">
              <Input
                type="number"
                value={data.rules.maxTrades}
                onChange={(e) => patchAccount({ maxTrades: Number(e.target.value) })}
              />
            </Field>
            <Field label="Max consecutive losses">
              <Input
                type="number"
                value={data.rules.maxConsecutiveLosses}
                onChange={(e) => patchAccount({ maxConsecutiveLosses: Number(e.target.value) })}
              />
            </Field>
            <Field label="Window start (NY)">
              <Input
                type="time"
                value={data.rules.windowStart}
                onChange={(e) => patchAccount({ windowStart: e.target.value })}
              />
            </Field>
            <Field label="Window end (NY)">
              <Input
                type="time"
                value={data.rules.windowEnd}
                onChange={(e) => patchAccount({ windowEnd: e.target.value })}
              />
            </Field>
            <Field label="Min trading days">
              <Input
                type="number"
                value={data.rules.minTradingDays}
                onChange={(e) => patchAccount({ minTradingDays: Number(e.target.value) })}
              />
            </Field>
            <Field label="Consistency cap %">
              <Input
                type="number"
                value={data.rules.consistencyPct}
                onChange={(e) => patchAccount({ consistencyPct: Number(e.target.value) })}
              />
            </Field>
            <Field label="Max lots">
              <Input
                type="number"
                step="0.01"
                value={data.rules.maxPositionLots}
                onChange={(e) => patchAccount({ maxPositionLots: Number(e.target.value) })}
              />
            </Field>
            <Field label="Protocol start">
              <Input
                type="date"
                value={data.rules.protocolStartDate}
                onChange={(e) => rebuildProtocolDates(e.target.value)}
              />
            </Field>
          </div>
          <div className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2">
            <span className="text-sm">News restricted</span>
            <Switch
              checked={data.rules.newsRestricted}
              onCheckedChange={(v) => patchAccount({ newsRestricted: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2">
            <span className="text-sm">Weekend restricted</span>
            <Switch
              checked={data.rules.weekendRestricted}
              onCheckedChange={(v) => patchAccount({ weekendRestricted: v })}
            />
          </div>
          <Field label="Scaling note">
            <Input
              value={data.rules.scalingNote}
              onChange={(e) => patchAccount({ scalingNote: e.target.value })}
            />
          </Field>
          <Field label="Mantra">
            <Textarea value={data.mantra} onChange={(e) => patchAccount({ mantra: e.target.value })} />
          </Field>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              onClick={() => {
                try {
                  patchAccount({
                    accountName: data.accountName,
                    phaseId: data.phaseId,
                    mantra: data.mantra,
                    ...data.rules,
                  });
                  setThemeId(colorTheme);
                  setStoreAccentColor(accentColor);
                  window.localStorage.setItem(THEME_STORAGE_KEY, colorTheme);
                  window.localStorage.setItem(ACCENT_STORAGE_KEY, accentColor);
                  if (fontTheme === "default") {
                    window.localStorage.removeItem(FONT_STORAGE_KEY);
                  } else {
                    window.localStorage.setItem(FONT_STORAGE_KEY, fontTheme);
                  }
                  toast.success("Account settings saved");
                  onOpenChange(false);
                } catch (error) {
                  console.error("[settings] failed to save account settings:", error);
                  toast.error("Could not save account settings");
                }
              }}
            >
              Save settings
            </Button>
            <Button variant="outline" onClick={downloadBackup}>Download backup</Button>
            <Button variant="outline" asChild>
              <label className="cursor-pointer">
                Restore backup
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void restoreBackup(file);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </Button>
            <Button variant="destructive" onClick={() => setResetOpen(true)}>
              Reset All Data
            </Button>
          </div>
        </div>
      </SheetContent>
      <ConfirmDelete
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset all desk data?"
        description="This permanently clears your trades, plans, notes, settings, and checklist progress. Your standard checklist will return unchecked. This cannot be undone."
        confirmLabel="Reset All Data"
        isPending={isResetting}
        pendingLabel="Resetting…"
        onConfirm={() => void handleReset()}
      />
    </Sheet>
  );
}
