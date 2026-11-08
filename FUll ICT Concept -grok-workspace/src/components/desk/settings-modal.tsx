import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import {
  X,
  RotateCcw,
  RotateCw,
  Bookmark,
  Check,
  Lock,
  Share2,
  Zap,
  Plus,
} from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { deskSnapshot, useDeskStore } from "@/lib/ict-store";
import { authEnabled } from "@/lib/auth/client";
import { isDeskData, saveDeskState, syncDeskToServer } from "@/lib/desk-sync";
import { createResetState } from "@/lib/ict-defaults";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ConfirmDelete } from "./confirm-delete";
import { Field } from "./fields";
import { TRADING_TZ } from "@/lib/ict-time";
import { cn } from "@/lib/utils";
import {
  FONT_THEMES,
  FONT_STORAGE_KEY,
  applyFontTheme,
  resetFontTheme,
  type FontTheme,
} from "@/lib/font-themes";
import {
  COLOR_THEMES,
  DEFAULT_COLOR_THEME,
  DEFAULT_ACCENT_COLOR,
  THEME_STORAGE_KEY,
  ACCENT_STORAGE_KEY,
  CUSTOM_THEME_ID,
  CUSTOM_THEME_STORAGE_KEY,
  DEFAULT_CUSTOM_THEME_COLORS,
  getCustomThemeColors,
  saveCustomThemeColors,
  applyColorTheme,
  applyAccentColor,
  getThemeById,
  type CustomThemeColors,
} from "@/lib/color-themes";
import {
  SOUND_PROFILES,
  getClickSoundEnabled,
  setClickSoundEnabled,
  getTypingSoundEnabled,
  setTypingSoundEnabled,
  getSoundProfile,
  setSoundProfile,
  previewSwitchSound,
  playClickSound,
  type SoundProfile,
} from "@/lib/sound-fx";
import {
  BUTTON_THEMES,
  getButtonTheme,
  saveButtonTheme,
  type ButtonThemeId,
} from "@/lib/button-themes";

function toValidColorInputHex(hex?: string, fallback = "#38bdf8"): string {
  if (!hex) return fallback;
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return hex;
  }
  if (/^#[0-9A-Fa-f]{3}$/.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return fallback;
}

const FAN_SWATCHES = [
  { hex: "#EBEDF3", label: "EBEDF3", color: "#111827", rotate: -24, x: -72, y: 12 },
  { hex: "#F3F5F7", label: "F3F5F7", color: "#111827", rotate: -16, x: -48, y: 7 },
  { hex: "#050914", label: "050914", color: "#ffffff", rotate: -8, x: -24, y: 3 },
  { hex: "#F5F5F7", label: "F5F5F7", color: "#111827", rotate: 0, x: 0, y: 0 },
  { hex: "#000000", label: "000000", color: "#ffffff", rotate: 8, x: 24, y: 3 },
  { hex: "#888888", label: "888888", color: "#ffffff", rotate: 16, x: 48, y: 7 },
  { hex: "#3882F6", label: "3882F6", color: "#ffffff", rotate: 24, x: 72, y: 12 },
] as const;

interface AccentSwatchItem {
  id: string;
  name: string;
  color: string;
  isThemeDefault?: boolean;
}

const ACCENT_SWATCHES: readonly AccentSwatchItem[] = [
  { id: "theme", name: "Theme", color: "#ffffff", isThemeDefault: true },
  { id: "blue", name: "Electric Blue", color: "#1d4ed8" },
  { id: "cyan", name: "Cyan", color: "#06b6d4" },
  { id: "ocean", name: "Ocean", color: "#0284c7" },
  { id: "slate", name: "Slate Grey", color: "#64748b" },
  { id: "mint", name: "Mint", color: "#10b981" },
  { id: "emerald", name: "Emerald", color: "#059669" },
  { id: "lime", name: "Lime", color: "#84cc16" },
  { id: "amber", name: "Golden Amber", color: "#d97706" },
  { id: "orange", name: "Tangerine", color: "#ea580c" },
  { id: "crimson", name: "Crimson", color: "#ef4444" },
];

const TEXT_TONES = [
  { id: "ink", name: "Ink", value: "#0a0a0a" },
  { id: "graphite", name: "Graphite", value: "#374151" },
  { id: "espresso", name: "Espresso", value: "#3c2a21" },
  { id: "navy", name: "Navy", value: "#0f172a" },
] as const;

const LINE_STYLES = [
  { id: "theme", name: "Mono", label: "— Theme" },
  { id: "text", name: "Text colour", label: "— Text colour" },
  { id: "accent", name: "Accent", label: "— Accent" },
] as const;

const JOURNAL_FONTS = [
  { id: "satoshi", name: "Satoshi", category: "sans", displaySample: "Aa", previewPnl: "+$4,320", fontFamily: '"Satoshi", "Plus Jakarta Sans", sans-serif' },
  { id: "geist", name: "Geist", category: "sans", displaySample: "Aa", previewPnl: "+$4,320", fontFamily: '"Geist", "Inter", sans-serif' },
  { id: "gambetta", name: "Gambetta", category: "serif", displaySample: "Aa", previewPnl: "+$4,320", fontFamily: '"Gambetta", "Instrument Serif", Georgia, serif' },
  { id: "mono", name: "Mono", category: "mono", displaySample: "Aa", previewPnl: "+$4,320", fontFamily: '"JetBrains Mono", "IBM Plex Mono", monospace' },
] as const;

const QUICK_CUSTOM_PRESETS = [
  { name: "Cyber Neon", background: "#080b10", surface: "#111827", foreground: "#f3f4f6", accent: "#06b6d4" },
  { name: "Sunset Amber", background: "#120a0a", surface: "#1f1214", foreground: "#fff1f2", accent: "#f97316" },
  { name: "Royal Violet", background: "#0b0814", surface: "#151024", foreground: "#f5f3ff", accent: "#a855f7" },
  { name: "Rose Luxury", background: "#140a10", surface: "#21101a", foreground: "#fff1f2", accent: "#f43f5e" },
  { name: "Matrix Sage", background: "#06120b", surface: "#0d2015", foreground: "#f0fdf4", accent: "#10b981" },
  { name: "Electric Blue", background: "#060d19", surface: "#0c192c", foreground: "#f0f9ff", accent: "#38bdf8" },
] as const;

type SettingsTab = "buttons" | "themes" | "colours" | "custom" | "money";

interface HistoryState {
  themeId: string;
  accentColor: string;
  fontTheme: string;
  buttonTheme: ButtonThemeId;
  textTone: string;
  lineStyle: string;
}

export function SettingsModal({
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
  const setStoreCustomThemeColors = useDeskStore((s) => s.setCustomThemeColors);
  const rebuildProtocolDates = useDeskStore((s) => s.rebuildProtocolDates);
  const resetAll = useDeskStore((s) => s.resetAll);
  const replaceAll = useDeskStore((s) => s.replaceAll);

  const [activeTab, setActiveTab] = useState<SettingsTab>("buttons");
  const [resetOpen, setResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSavingMoney, setIsSavingMoney] = useState(false);
  const [isSavingLook, setIsSavingLook] = useState(false);

  // Appearance state
  const [colorTheme, setColorTheme] = useState<string>(() => data.themeId ?? DEFAULT_COLOR_THEME);
  const [accentColor, setAccentColor] = useState<string>(() => data.accentColor ?? DEFAULT_ACCENT_COLOR);
  const [fontTheme, setFontTheme] = useState<string>("satoshi");
  const [buttonTheme, setButtonThemeState] = useState<ButtonThemeId>("liquid-theme");
  const [textTone, setTextTone] = useState<string>("ink");
  const [customTextTone, setCustomTextTone] = useState<string>("#0a0a0a");
  const [lineStyle, setLineStyle] = useState<string>("theme");
  const [customLineColor, setCustomLineColor] = useState<string>("#e5e7eb");
  const [customAccent, setCustomAccent] = useState<string>("#3882F6");

  // Sound state
  const [clickSound, setClickSound] = useState<boolean>(false);
  const [typingSound, setTypingSound] = useState<boolean>(false);
  const [soundSwitchProfile, setSoundSwitchProfile] = useState<SoundProfile>("liquid");

  // Custom palette state
  const [customColors, setCustomColors] = useState<CustomThemeColors>(() => {
    return data.customThemeColors ?? getCustomThemeColors();
  });

  // Undo / Redo history
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const isInternalChange = useRef(false);

  // Interactive preview card segmented control
  const [activePreviewSegment, setActivePreviewSegment] = useState<"trades" | "daily" | "weekly">("trades");

  // Custom accent picker input ref
  const accentPickerRef = useRef<HTMLInputElement>(null);
  const customTextToneRef = useRef<HTMLInputElement>(null);
  const customLineColorRef = useRef<HTMLInputElement>(null);

  // Initialize and load saved state from localStorage & desk store
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!open) return;

    try {
      const savedTheme = data.themeId ?? window.localStorage.getItem(THEME_STORAGE_KEY) ?? DEFAULT_COLOR_THEME;
      const savedAccent = data.accentColor ?? window.localStorage.getItem(ACCENT_STORAGE_KEY) ?? DEFAULT_ACCENT_COLOR;
      const initialCustom = data.customThemeColors ?? getCustomThemeColors();
      setColorTheme(savedTheme);
      setAccentColor(savedAccent);
      setCustomColors(initialCustom);
      applyColorTheme(savedTheme, savedAccent, initialCustom);

      const savedFont = window.localStorage.getItem(FONT_STORAGE_KEY) ?? "satoshi";
      setFontTheme(savedFont);
      applyFontTheme(savedFont as FontTheme);

      const savedBtn = getButtonTheme();
      setButtonThemeState(savedBtn);

      setClickSound(getClickSoundEnabled());
      setTypingSound(getTypingSoundEnabled());
      setSoundSwitchProfile(getSoundProfile());

      const savedTextTone = window.localStorage.getItem("first-payout-text-tone-v1") ?? "ink";
      setTextTone(savedTextTone);

      const savedLineStyle = window.localStorage.getItem("first-payout-line-style-v1") ?? "theme";
      setLineStyle(savedLineStyle);

      const initialHistory: HistoryState = {
        themeId: savedTheme,
        accentColor: savedAccent,
        fontTheme: savedFont,
        buttonTheme: savedBtn,
        textTone: savedTextTone,
        lineStyle: savedLineStyle,
      };
      setHistory([initialHistory]);
      setHistoryIndex(0);
    } catch (e) {
      console.error("[settings-modal] initialization error:", e);
    }
  }, [open, data.themeId, data.accentColor, data.customThemeColors]);

  const pushHistory = (newState: HistoryState) => {
    if (isInternalChange.current) return;
    setHistory((prev) => {
      const sliced = prev.slice(0, historyIndex + 1);
      return [...sliced, newState];
    });
    setHistoryIndex((prev) => prev + 1);
  };

  const isLightTheme = (tid: string = colorTheme) => tid === "light" || tid === "platinum";

  const applyTextToneToDom = (toneId: string, hexOverride?: string, currentTheme: string = colorTheme) => {
    if (typeof document === "undefined") return;
    // For dark/obsidian themes, preserve the theme's high-contrast foreground unless custom override is passed
    if (!isLightTheme(currentTheme) && !hexOverride) {
      const theme = getThemeById(currentTheme, customColors);
      document.documentElement.style.setProperty("--color-foreground", theme.colors.foreground);
      return;
    }
    const toneHex =
      hexOverride ??
      TEXT_TONES.find((t) => t.id === toneId)?.value ??
      (toneId.startsWith("#") ? toneId : (isLightTheme(currentTheme) ? "#0a0a0a" : "#f5f5f4"));
    document.documentElement.style.setProperty("--color-foreground", toneHex);
  };

  const applyLineStyleToDom = (lineId: string, hexOverride?: string) => {
    if (typeof document === "undefined") return;
    let borderVal = "rgba(0, 0, 0, 0.08)";
    if (lineId === "text") {
      borderVal = "color-mix(in srgb, var(--color-foreground) 18%, transparent)";
    } else if (lineId === "accent") {
      borderVal = "color-mix(in srgb, var(--color-accent) 26%, transparent)";
    } else if (lineId === "custom" && hexOverride) {
      borderVal = hexOverride;
    } else if (hexOverride) {
      borderVal = hexOverride;
    }
    document.documentElement.style.setProperty("--color-border", borderVal);
  };

  const handleUndo = () => {
    if (historyIndex <= 0) return;
    const targetIdx = historyIndex - 1;
    const state = history[targetIdx];
    if (!state) return;
    isInternalChange.current = true;
    setColorTheme(state.themeId);
    setAccentColor(state.accentColor);
    setFontTheme(state.fontTheme);
    setButtonThemeState(state.buttonTheme);
    setTextTone(state.textTone);
    setLineStyle(state.lineStyle);

    applyColorTheme(state.themeId, state.accentColor, customColors);
    applyFontTheme(state.fontTheme as FontTheme);
    saveButtonTheme(state.buttonTheme);
    applyTextToneToDom(state.textTone, undefined, state.themeId);
    applyLineStyleToDom(state.lineStyle);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, state.themeId);
      window.localStorage.setItem(ACCENT_STORAGE_KEY, state.accentColor);
      window.localStorage.setItem(FONT_STORAGE_KEY, state.fontTheme);
      window.localStorage.setItem("first-payout-text-tone-v1", state.textTone);
      window.localStorage.setItem("first-payout-line-style-v1", state.lineStyle);
      setThemeId(state.themeId);
      setStoreAccentColor(state.accentColor);
    } catch {
      // ignore error
    }

    setHistoryIndex(targetIdx);
    isInternalChange.current = false;
    previewSwitchSound(soundSwitchProfile);
    toast("Undone look changes");
  };

  const handleRedo = () => {
    if (historyIndex >= history.length - 1) return;
    const targetIdx = historyIndex + 1;
    const state = history[targetIdx];
    if (!state) return;
    isInternalChange.current = true;
    setColorTheme(state.themeId);
    setAccentColor(state.accentColor);
    setFontTheme(state.fontTheme);
    setButtonThemeState(state.buttonTheme);
    setTextTone(state.textTone);
    setLineStyle(state.lineStyle);

    applyColorTheme(state.themeId, state.accentColor, customColors);
    applyFontTheme(state.fontTheme as FontTheme);
    saveButtonTheme(state.buttonTheme);
    applyTextToneToDom(state.textTone, undefined, state.themeId);
    applyLineStyleToDom(state.lineStyle);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, state.themeId);
      window.localStorage.setItem(ACCENT_STORAGE_KEY, state.accentColor);
      window.localStorage.setItem(FONT_STORAGE_KEY, state.fontTheme);
      window.localStorage.setItem("first-payout-text-tone-v1", state.textTone);
      window.localStorage.setItem("first-payout-line-style-v1", state.lineStyle);
      setThemeId(state.themeId);
      setStoreAccentColor(state.accentColor);
    } catch {
      // ignore error
    }

    setHistoryIndex(targetIdx);
    isInternalChange.current = false;
    previewSwitchSound(soundSwitchProfile);
    toast("Redone look changes");
  };

  const handleSaveLook = async () => {
    setIsSavingLook(true);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, colorTheme);
      window.localStorage.setItem(ACCENT_STORAGE_KEY, accentColor);
      window.localStorage.setItem(FONT_STORAGE_KEY, fontTheme);
      saveButtonTheme(buttonTheme);
      window.localStorage.setItem("first-payout-text-tone-v1", textTone);
      window.localStorage.setItem("first-payout-line-style-v1", lineStyle);
      setThemeId(colorTheme);
      setStoreAccentColor(accentColor);
      if (colorTheme === CUSTOM_THEME_ID) {
        setStoreCustomThemeColors(customColors);
      }
      playClickSound();

      const snapshot = deskSnapshot();
      try {
        await syncDeskToServer(snapshot);
      } catch (cloudErr) {
        console.warn("[settings] cloud sync warning:", cloudErr);
      }
      toast.success("Saved this look! Theme, typography, and button settings preserved.");
    } catch {
      toast.error("Could not save look");
    } finally {
      setIsSavingLook(false);
    }
  };

  // Sound handler
  const handleToggleClickSound = (enabled: boolean) => {
    setClickSound(enabled);
    setClickSoundEnabled(enabled);
    if (enabled) {
      previewSwitchSound(soundSwitchProfile);
    }
  };

  const handleToggleTypingSound = (enabled: boolean) => {
    setTypingSound(enabled);
    setTypingSoundEnabled(enabled);
    if (enabled) {
      previewSwitchSound(soundSwitchProfile);
    }
  };

  const handleSelectSoundProfile = (profile: SoundProfile) => {
    setSoundSwitchProfile(profile);
    setSoundProfile(profile);
    previewSwitchSound(profile);
  };

  // Button theme handler
  const handleSelectButtonTheme = (themeId: ButtonThemeId) => {
    setButtonThemeState(themeId);
    saveButtonTheme(themeId);
    previewSwitchSound(soundSwitchProfile);
    pushHistory({
      themeId: colorTheme,
      accentColor,
      fontTheme,
      buttonTheme: themeId,
      textTone,
      lineStyle,
    });
  };

  // Color theme handler
  const handleSelectTheme = (newThemeId: string) => {
    setColorTheme(newThemeId);
    const targetTheme = getThemeById(newThemeId, customColors);
    const newAccent = targetTheme.defaultAccent;
    setAccentColor(newAccent);
    applyColorTheme(newThemeId, newAccent, customColors);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, newThemeId);
      window.localStorage.setItem(ACCENT_STORAGE_KEY, newAccent);
      setThemeId(newThemeId);
      setStoreAccentColor(newAccent);
      previewSwitchSound(soundSwitchProfile);
      toast.success(`Theme switched to ${targetTheme.name}`);
      pushHistory({
        themeId: newThemeId,
        accentColor: newAccent,
        fontTheme,
        buttonTheme,
        textTone,
        lineStyle,
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Accent handler
  const handleSelectAccent = (newAccentId: string, hexOverride?: string) => {
    setAccentColor(newAccentId);
    if (newAccentId === "theme") {
      const targetTheme = getThemeById(colorTheme, customColors);
      applyAccentColor(targetTheme.defaultAccent);
      try {
        window.localStorage.setItem(ACCENT_STORAGE_KEY, targetTheme.defaultAccent);
        setStoreAccentColor(targetTheme.defaultAccent);
      } catch {
        // ignore error
      }
    } else if (hexOverride) {
      setCustomAccent(hexOverride);
      const root = document.documentElement.style;
      root.setProperty("--color-accent", hexOverride);
      root.setProperty("--color-primary", hexOverride);
      root.setProperty("--color-ring", hexOverride);
      try {
        window.localStorage.setItem(ACCENT_STORAGE_KEY, newAccentId);
        setStoreAccentColor(newAccentId);
      } catch {
        // ignore error
      }
    } else {
      applyAccentColor(newAccentId);
      try {
        window.localStorage.setItem(ACCENT_STORAGE_KEY, newAccentId);
        setStoreAccentColor(newAccentId);
      } catch {
        // ignore error
      }
    }
    previewSwitchSound(soundSwitchProfile);
    pushHistory({
      themeId: colorTheme,
      accentColor: newAccentId,
      fontTheme,
      buttonTheme,
      textTone,
      lineStyle,
    });
  };

  // Font handler
  const handleSelectFont = (selectedFontId: string) => {
    setFontTheme(selectedFontId);
    applyFontTheme(selectedFontId as FontTheme);
    try {
      window.localStorage.setItem(FONT_STORAGE_KEY, selectedFontId);
      previewSwitchSound(soundSwitchProfile);
      pushHistory({
        themeId: colorTheme,
        accentColor,
        fontTheme: selectedFontId,
        buttonTheme,
        textTone,
        lineStyle,
      });
      const matched = JOURNAL_FONTS.find((f) => f.id === selectedFontId);
      toast.success(`Typography switched to ${matched?.name ?? selectedFontId}`);
    } catch (e) {
      console.error(e);
    }
  };

  // Text tone handler
  const handleSelectTextTone = (toneId: string, hexVal?: string) => {
    setTextTone(toneId);
    try {
      window.localStorage.setItem("first-payout-text-tone-v1", toneId);
    } catch {
      // ignore error
    }
    previewSwitchSound(soundSwitchProfile);
    if (!isLightTheme(colorTheme) && !hexVal) {
      toast("Text tone presets are optimized for Light and Platinum themes.");
      return;
    }
    const resolvedHex = hexVal ?? TEXT_TONES.find((t) => t.id === toneId)?.value ?? (isLightTheme(colorTheme) ? "#0a0a0a" : "#f5f5f4");
    document.documentElement.style.setProperty("--color-foreground", resolvedHex);
    pushHistory({
      themeId: colorTheme,
      accentColor,
      fontTheme,
      buttonTheme,
      textTone: toneId,
      lineStyle,
    });
  };

  // Line style handler
  const handleSelectLineStyle = (lineId: string, hexVal?: string) => {
    setLineStyle(lineId);
    try {
      window.localStorage.setItem("first-payout-line-style-v1", lineId);
    } catch {
      // ignore error
    }
    previewSwitchSound(soundSwitchProfile);
    let borderVal = "rgba(0, 0, 0, 0.08)";
    if (lineId === "text") {
      borderVal = "color-mix(in srgb, var(--color-foreground) 18%, transparent)";
    } else if (lineId === "accent") {
      borderVal = "color-mix(in srgb, var(--color-accent) 26%, transparent)";
    } else if (lineId === "custom" && hexVal) {
      borderVal = hexVal;
    }
    document.documentElement.style.setProperty("--color-border", borderVal);
    pushHistory({
      themeId: colorTheme,
      accentColor,
      fontTheme,
      buttonTheme,
      textTone,
      lineStyle: lineId,
    });
  };

  // Reset to default
  const handleResetToDefault = () => {
    setColorTheme(DEFAULT_COLOR_THEME);
    setAccentColor(DEFAULT_ACCENT_COLOR);
    setFontTheme("satoshi");
    setButtonThemeState("liquid-theme");
    setTextTone("ink");
    setLineStyle("theme");

    applyColorTheme(DEFAULT_COLOR_THEME, DEFAULT_ACCENT_COLOR);
    applyFontTheme("satoshi" as FontTheme);
    saveButtonTheme("liquid-theme");

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, DEFAULT_COLOR_THEME);
      window.localStorage.setItem(ACCENT_STORAGE_KEY, DEFAULT_ACCENT_COLOR);
      window.localStorage.setItem(FONT_STORAGE_KEY, "satoshi");
      window.localStorage.removeItem("first-payout-text-tone-v1");
      window.localStorage.removeItem("first-payout-line-style-v1");
      setThemeId(DEFAULT_COLOR_THEME);
      setStoreAccentColor(DEFAULT_ACCENT_COLOR);
    } catch {
      // ignore error
    }

    pushHistory({
      themeId: DEFAULT_COLOR_THEME,
      accentColor: DEFAULT_ACCENT_COLOR,
      fontTheme: "satoshi",
      buttonTheme: "liquid-theme",
      textTone: "ink",
      lineStyle: "theme",
    });
    previewSwitchSound(soundSwitchProfile);
    toast.success("Settings reset to Cinema dark default");
  };

  // Money tab handlers
  const handleSaveMoneySettings = async () => {
    setIsSavingMoney(true);
    try {
      patchAccount({
        accountName: data.accountName,
        phaseId: data.phaseId,
        mantra: data.mantra,
        ...data.rules,
      });
      const snapshot = deskSnapshot();
      await syncDeskToServer(snapshot);
      playClickSound();
      toast.success("Account settings saved and synced to cloud");
      onOpenChange(false);
    } catch (e) {
      console.error("[settings] save money settings error:", e);
      toast.error("Could not sync account settings to cloud");
    } finally {
      setIsSavingMoney(false);
    }
  };

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
      setCustomColors({ ...DEFAULT_CUSTOM_THEME_COLORS });
      setFontTheme("satoshi");
      setButtonThemeState("liquid-theme");
      try {
        window.localStorage.removeItem(THEME_STORAGE_KEY);
        window.localStorage.removeItem(ACCENT_STORAGE_KEY);
        window.localStorage.removeItem(CUSTOM_THEME_STORAGE_KEY);
        window.localStorage.removeItem(FONT_STORAGE_KEY);
      } catch {
        // ignore error
      }
      applyColorTheme(DEFAULT_COLOR_THEME, DEFAULT_ACCENT_COLOR);
      resetFontTheme();
      setResetOpen(false);
      toast.success("All desk data reset");
    } catch (error) {
      console.error("[settings] failed to reset desk data:", error);
      toast.error("Could not reset desk data.");
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
      if (!window.confirm(`Restore ${parsed.trades.length} trades and replace current desk data?`)) {
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

  const activeFontDisplayName =
    JOURNAL_FONTS.find((f) => f.id === fontTheme)?.name ??
    FONT_THEMES.find((f) => f.id === fontTheme)?.name ??
    fontTheme;

  const activeThemeDisplayName = getThemeById(colorTheme, customColors).name;
  const activeLineDisplayName =
    LINE_STYLES.find((l) => l.id === lineStyle)?.name ?? "Theme";

  // Dynamic subtitle badge e.g. "Light · Mono · Satoshi"
  const subtitleBadge = `${activeThemeDisplayName} · ${activeLineDisplayName} · ${activeFontDisplayName}`;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Backdrop overlay */}
        <DialogPrimitive.Overlay
          style={{ position: "fixed" }}
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />

        {/* Floating Modal Content */}
        <DialogPrimitive.Content
          data-settings-modal="true"
          data-no-spotlight="true"
          style={{ position: "fixed" }}
          className={cn(
            "fixed top-1/2 left-1/2 z-[60] flex flex-col w-[94vw] max-w-4xl -translate-x-1/2 -translate-y-1/2",
            "max-h-[88vh] h-[85vh] rounded-[24px] overflow-hidden shadow-2xl",
            "border border-white/10 bg-[#090a0f] text-[#f3f4f6] no-spotlight",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "focus-visible:outline-none",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Settings</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Desk preferences, themes, buttons, typography and account settings
          </DialogPrimitive.Description>

          {/* Sleek Executive Header Bar (Compact & High Usability) */}
          <div className="relative shrink-0 px-6 sm:px-8 pt-5 pb-3.5 border-b border-white/[0.08] bg-gradient-to-b from-[#13151f] via-[#0e1017] to-[#0a0b10]">
            {/* Top Row: Title, Look Pill, Undo/Redo, Save Look, Close */}
            <div className="flex items-center justify-between gap-4">
              {/* Left: Settings Title & Active Look Badge */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-display">
                    Settings
                  </h2>
                </div>
                <div
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/10 bg-white/[0.04] text-[11px] text-zinc-300 font-medium tracking-wide truncate max-w-xs"
                  title={subtitleBadge}
                >
                  <span className="truncate">{subtitleBadge}</span>
                </div>
              </div>

              {/* Right: Actions (Undo, Redo, Save Look, Close) */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Undo / Redo */}
                <div className="flex items-center rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
                  <button
                    type="button"
                    data-no-spotlight="true"
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    className="size-7 rounded-md flex items-center justify-center hover:bg-white/[0.08] active:scale-95 disabled:opacity-25 disabled:pointer-events-none transition-all cursor-pointer text-zinc-300 hover:text-white no-spotlight"
                    title="Undo look changes"
                    aria-label="Undo"
                  >
                    <RotateCcw className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    data-no-spotlight="true"
                    onClick={handleRedo}
                    disabled={historyIndex >= history.length - 1}
                    className="size-7 rounded-md flex items-center justify-center hover:bg-white/[0.08] active:scale-95 disabled:opacity-25 disabled:pointer-events-none transition-all cursor-pointer text-zinc-300 hover:text-white no-spotlight"
                    title="Redo look changes"
                    aria-label="Redo"
                  >
                    <RotateCw className="size-3.5" />
                  </button>
                </div>

                {/* Save this look button */}
                <button
                  type="button"
                  data-no-spotlight="true"
                  onClick={handleSaveLook}
                  disabled={isSavingLook}
                  className="h-8 px-3.5 rounded-lg border border-white/10 bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-white flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50 no-spotlight"
                  title="Save current look to cloud and browser"
                >
                  <Bookmark className="size-3.5 text-red-400" />
                  <span>{isSavingLook ? "Saving…" : "Save this look"}</span>
                </button>

                {/* Circular Close Button */}
                <DialogPrimitive.Close
                  data-no-spotlight="true"
                  className="size-8 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.1] text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95 no-spotlight"
                  aria-label="Close settings"
                >
                  <X className="size-4" />
                </DialogPrimitive.Close>
              </div>
            </div>

            {/* Bottom Row: Segmented Pill Tab Bar */}
            <div className="mt-3.5 flex items-center justify-between gap-3">
              <div className="inline-flex p-1 rounded-xl bg-black/40 border border-white/[0.08] gap-1">
                {(
                  [
                    { id: "buttons", label: "Buttons" },
                    { id: "themes", label: "Themes" },
                    { id: "colours", label: "Colours" },
                    { id: "custom", label: "Custom" },
                    { id: "money", label: "Money" },
                  ] as const
                ).map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      data-no-spotlight="true"
                      onClick={() => {
                        setActiveTab(tab.id);
                        previewSwitchSound(soundSwitchProfile);
                      }}
                      className={cn(
                        "px-3.5 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer no-spotlight",
                        isActive
                          ? "bg-white/[0.14] text-white shadow-xs border border-white/15"
                          : "text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent",
                      )}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Active Tab helper on desktop */}
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-zinc-500 font-mono">
                <span>Tab:</span>
                <span className="text-zinc-300 font-semibold uppercase">{activeTab}</span>
              </div>
            </div>
          </div>

          {/* Scrollable Modal Content */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 bg-[#090a0f]">
            {/* ══════════════════════════════════════════════════════════════════
                TAB 1: BUTTONS
                ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "buttons" && (
              <div className="space-y-6">
                {/* Sound Section Card */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#121319] p-5 shadow-lg space-y-5">
                  <h3 className="text-base font-bold text-white">Sound</h3>

                  {/* Click sound row */}
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-white">Click sound</div>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        A mechanical keyboard click on every button. Made in the browser, nothing to download.
                      </p>
                    </div>
                    <Switch
                      checked={clickSound}
                      onCheckedChange={handleToggleClickSound}
                      aria-label="Toggle click sound"
                      data-no-spotlight="true"
                      className="no-spotlight"
                    />
                  </div>

                  {/* 4 Switch Profile Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    {SOUND_PROFILES.map((profile) => {
                      const isSelected = soundSwitchProfile === profile.id;
                      return (
                        <button
                          key={profile.id}
                          type="button"
                          data-no-spotlight="true"
                          onClick={() => handleSelectSoundProfile(profile.id)}
                          className={cn(
                            "flex flex-col gap-1 rounded-xl border p-3.5 text-left transition-all cursor-pointer bg-[#181922] no-spotlight",
                            isSelected
                              ? "border-white shadow-xs ring-1 ring-white"
                              : "border-white/[0.08] hover:border-white/30 hover:bg-white/[0.04]",
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="size-2.5 rounded-full"
                              style={{ backgroundColor: profile.colorDot }}
                            />
                            <span className="text-xs font-bold text-white">
                              {profile.name}
                            </span>
                          </div>
                          <span className="text-[11px] text-zinc-400">
                            {profile.type}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Typing sounds row */}
                  <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/[0.08]">
                    <div>
                      <div className="text-sm font-semibold text-white">Typing sounds</div>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        The same switch every time you type: the AI, your journal, notes and search.
                      </p>
                    </div>
                    <Switch
                      checked={typingSound}
                      onCheckedChange={handleToggleTypingSound}
                      aria-label="Toggle typing sound"
                      data-no-spotlight="true"
                      className="no-spotlight"
                    />
                  </div>
                </div>

                {/* Buttons Section */}
                <div className="space-y-5">
                  <div>
                    <h3 className="text-base font-bold text-white">Buttons</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Every button and switch in the journal. Theme picks the one your theme brings.
                    </p>
                  </div>

                  {/* Group 1: Liquid */}
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-white">Liquid</h4>
                      <p className="text-xs text-zinc-400">
                        Raised plates. They press in and never move.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {BUTTON_THEMES.filter((b) => b.group === "liquid").map((option) => {
                        const isSelected = buttonTheme === option.id;
                        return (
                          <div
                            key={option.id}
                            onClick={() => handleSelectButtonTheme(option.id)}
                            className={cn(
                              "rounded-2xl border p-4 transition-all cursor-pointer bg-[#121319] relative flex flex-col justify-between",
                              isSelected
                                ? "border-white shadow-sm ring-1.5 ring-white"
                                : "border-white/[0.08] hover:border-white/30 hover:shadow-xs",
                            )}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white">
                                  {option.name}
                                </span>
                                {option.badge && (
                                  <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
                                    {option.name === "Gold" ? "Prestige" : "Apex"}
                                    <Lock className="size-3 text-zinc-400" />
                                  </span>
                                )}
                              </div>
                              {isSelected && (
                                <Check className="size-4 text-white" />
                              )}
                            </div>

                            {/* Interactive Button Preview Box */}
                            <div className="rounded-xl border border-white/[0.06] bg-[#0c0d12] p-3 space-y-2.5">
                              {/* Top row buttons */}
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    previewSwitchSound(soundSwitchProfile);
                                  }}
                                  className={cn(
                                    "px-3.5 py-1.5 text-xs rounded-full flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer font-semibold",
                                    option.id === "liquid-theme" && "btn-liquid-theme",
                                    option.id === "liquid-black" && "btn-liquid-black",
                                    option.id === "liquid-white" && "btn-liquid-white",
                                    option.id === "liquid-gold" && "btn-liquid-gold",
                                    option.id === "liquid-amethyst" && "btn-liquid-amethyst",
                                  )}
                                >
                                  <Plus className="size-3.5" />
                                  <span>Log Trade</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    previewSwitchSound(soundSwitchProfile);
                                  }}
                                  className={cn(
                                    "px-3.5 py-1.5 text-xs rounded-full flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer font-semibold",
                                    option.id === "liquid-theme" && "btn-liquid-theme",
                                    option.id === "liquid-black" && "btn-liquid-black",
                                    option.id === "liquid-white" && "btn-liquid-white",
                                    option.id === "liquid-gold" && "btn-liquid-gold",
                                    option.id === "liquid-amethyst" && "btn-liquid-amethyst",
                                  )}
                                >
                                  <Zap className="size-3.5" />
                                  <span>Quick Log</span>
                                </button>
                              </div>

                              {/* Bottom row: Share + Segmented controls */}
                              <div className="flex items-center justify-between gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    previewSwitchSound(soundSwitchProfile);
                                  }}
                                  className={cn(
                                    "px-3 py-1.5 text-[11px] rounded-full flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer font-semibold",
                                    option.id === "liquid-theme" && "btn-liquid-theme",
                                    option.id === "liquid-black" && "btn-liquid-black",
                                    option.id === "liquid-white" && "btn-liquid-white",
                                    option.id === "liquid-gold" && "btn-liquid-gold",
                                    option.id === "liquid-amethyst" && "btn-liquid-amethyst",
                                  )}
                                >
                                  <Share2 className="size-3" />
                                  <span>Share</span>
                                </button>

                                <div className="flex items-center rounded-lg border border-white/10 bg-white/[0.06] p-0.5 text-[11px]">
                                  {(["trades", "daily", "weekly"] as const).map((seg) => (
                                    <button
                                      key={seg}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActivePreviewSegment(seg);
                                        previewSwitchSound(soundSwitchProfile);
                                      }}
                                      className={cn(
                                        "px-2 py-0.5 rounded capitalize font-medium transition-all cursor-pointer",
                                        activePreviewSegment === seg
                                          ? option.id === "liquid-black"
                                            ? "bg-black text-white shadow-xs"
                                            : option.id === "liquid-gold"
                                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-xs font-semibold"
                                            : option.id === "liquid-amethyst"
                                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-xs font-semibold"
                                            : "bg-white/[0.15] text-white shadow-xs border border-white/20"
                                          : "text-zinc-400 hover:text-white",
                                      )}
                                    >
                                      {seg}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Group 2: Chrome */}
                  <div className="space-y-3 pt-3">
                    <div>
                      <h4 className="text-sm font-bold text-white">Chrome</h4>
                      <p className="text-xs text-zinc-400">
                        They follow your pointer, with a light under it.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {BUTTON_THEMES.filter((b) => b.group === "chrome").map((option) => {
                        const isSelected = buttonTheme === option.id;
                        return (
                          <div
                            key={option.id}
                            onClick={() => handleSelectButtonTheme(option.id)}
                            className={cn(
                              "rounded-2xl border p-4 transition-all cursor-pointer bg-[#121319] relative flex flex-col justify-between",
                              isSelected
                                ? "border-white shadow-sm ring-1.5 ring-white"
                                : "border-white/[0.08] hover:border-white/30 hover:shadow-xs",
                            )}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-bold text-white">
                                {option.name}
                              </span>
                              {isSelected && (
                                <Check className="size-4 text-white" />
                              )}
                            </div>

                            {/* Chrome Button Preview Box */}
                            <div className="rounded-xl border border-white/[0.06] bg-[#0c0d12] p-3 space-y-2.5">
                              {/* Top row */}
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    previewSwitchSound(soundSwitchProfile);
                                  }}
                                  className={cn(
                                    "px-3.5 py-1.5 text-xs rounded-full flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer font-semibold",
                                    option.id === "chrome-theme" && "btn-chrome-theme",
                                    option.id === "chrome-black" && "btn-chrome-black",
                                    option.id === "chrome-matte" && "btn-chrome-matte",
                                    option.id === "chrome-white" && "btn-chrome-white",
                                  )}
                                >
                                  <Plus className="size-3.5" />
                                  <span>Log Trade</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    previewSwitchSound(soundSwitchProfile);
                                  }}
                                  className={cn(
                                    "px-3.5 py-1.5 text-xs rounded-full flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer font-semibold",
                                    option.id === "chrome-theme" && "btn-chrome-theme",
                                    option.id === "chrome-black" && "btn-chrome-black",
                                    option.id === "chrome-matte" && "btn-chrome-matte",
                                    option.id === "chrome-white" && "btn-chrome-white",
                                  )}
                                >
                                  <Zap className="size-3.5" />
                                  <span>Quick Log</span>
                                </button>
                              </div>

                              {/* Bottom row */}
                              <div className="flex items-center justify-between gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    previewSwitchSound(soundSwitchProfile);
                                  }}
                                  className={cn(
                                    "px-3 py-1.5 text-[11px] rounded-full flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer font-semibold",
                                    option.id === "chrome-theme" && "btn-chrome-theme",
                                    option.id === "chrome-black" && "btn-chrome-black",
                                    option.id === "chrome-matte" && "btn-chrome-matte",
                                    option.id === "chrome-white" && "btn-chrome-white",
                                  )}
                                >
                                  <Share2 className="size-3" />
                                  <span>Share</span>
                                </button>

                                <div className="flex items-center rounded-lg border border-white/10 bg-white/[0.06] p-0.5 text-[11px]">
                                  {(["trades", "daily", "weekly"] as const).map((seg) => (
                                    <button
                                      key={seg}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActivePreviewSegment(seg);
                                        previewSwitchSound(soundSwitchProfile);
                                      }}
                                      className={cn(
                                        "px-2 py-0.5 rounded capitalize font-medium transition-all cursor-pointer",
                                        activePreviewSegment === seg
                                          ? option.id === "chrome-black" || option.id === "chrome-matte"
                                            ? "bg-[#1f222a] text-white shadow-xs"
                                            : "bg-white/[0.15] text-white shadow-xs border border-white/20"
                                          : "text-zinc-400 hover:text-white",
                                      )}
                                    >
                                      {seg}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                TAB 2: THEMES
                ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "themes" && (
              <div className="space-y-4">
                {/* Active Theme & Typography Preview Card */}
                <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-r from-[#141620] via-[#101118] to-[#0c0d12] p-5 shadow-lg flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span
                      className="text-4xl sm:text-5xl font-bold leading-none tracking-tight text-white font-display select-none"
                      style={{ fontFamily: JOURNAL_FONTS.find((f) => f.id === fontTheme)?.fontFamily }}
                    >
                      Aa
                    </span>
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        <span>{activeThemeDisplayName}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.06] text-zinc-300 font-mono">
                          {activeFontDisplayName}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        Curated obsidian and luxury dark palettes with verified contrast metrics.
                      </p>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5">
                    {getThemeById(colorTheme, customColors).previewColors.map((hex, i) => (
                      <span
                        key={i}
                        className="size-4 rounded-full border border-white/15 shadow-sm"
                        style={{ backgroundColor: hex }}
                        title={hex}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {COLOR_THEMES.map((theme) => {
                    const isSelected = colorTheme === theme.id;
                    return (
                      <div
                        key={theme.id}
                        onClick={() => handleSelectTheme(theme.id)}
                        className={cn(
                          "rounded-2xl border p-4.5 transition-all cursor-pointer bg-[#121319] relative flex flex-col justify-between gap-3",
                          isSelected
                            ? "border-white shadow-sm ring-1.5 ring-white"
                            : "border-white/[0.08] hover:border-white/30 hover:shadow-xs",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">
                              {theme.name}
                            </span>
                            <span className="rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                              {theme.badge}
                            </span>
                          </div>
                          {isSelected && (
                            <Check className="size-4 text-white" />
                          )}
                        </div>

                        <p className="text-xs text-zinc-400 leading-relaxed">
                          {theme.description}
                        </p>

                        {/* Preview swatch bar */}
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
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                TAB 3: COLOURS
                ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "colours" && (
              <div className="space-y-6">
                {/* Signature Swatches Showcase */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#121319] p-5 shadow-lg space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">Signature Palette Fan</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Interactive luxury swatches. Click any swatch to instantly apply as signature accent.
                    </p>
                  </div>

                  <div className="flex items-center justify-center py-2 overflow-x-auto">
                    <div
                      className="relative w-72 h-24 flex items-end justify-center select-none"
                      style={{ perspective: "1000px" }}
                    >
                      {FAN_SWATCHES.map((swatch, idx) => (
                        <div
                          key={idx}
                          data-no-spotlight="true"
                          className="absolute bottom-0 w-11 h-20 sm:w-12 sm:h-22 rounded-2xl shadow-lg border border-white/10 flex flex-col justify-start p-1.5 transition-all hover:scale-110 hover:-translate-y-2 hover:z-40 cursor-pointer no-spotlight"
                          style={{
                            backgroundColor: swatch.hex,
                            color: swatch.color,
                            transformOrigin: "bottom center",
                            transform: `translateX(${swatch.x}px) translateY(${swatch.y}px) rotate(${swatch.rotate}deg)`,
                            zIndex: idx + 1,
                          }}
                          title={`Apply ${swatch.hex}`}
                          onClick={() => handleSelectAccent(swatch.hex, swatch.hex)}
                        >
                          <span
                            className="text-[9px] font-mono font-bold tracking-tight select-none pt-1 pl-0.5 opacity-90 [writing-mode:vertical-lr] rotate-180"
                            style={{ color: swatch.color }}
                          >
                            {swatch.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Accent Swatches Card */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#121319] p-5 shadow-lg space-y-3.5">
                  <div>
                    <h3 className="text-sm font-bold text-white">Accent</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Buttons, highlights and the page you are on.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    {ACCENT_SWATCHES.map((swatch) => {
                      const isSelected =
                        swatch.id === "theme"
                          ? accentColor === "theme" || accentColor === getThemeById(colorTheme, customColors).defaultAccent
                          : accentColor === swatch.id;
                      return (
                        <button
                          key={swatch.id}
                          type="button"
                          onClick={() => handleSelectAccent(swatch.id, swatch.isThemeDefault ? undefined : swatch.color)}
                          className={cn(
                            "relative size-9 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center cursor-pointer shadow-xs",
                            swatch.isThemeDefault && "bg-[#0c0d12] border-white/40 text-white",
                            isSelected
                              ? "border-white ring-2 ring-white/40 scale-105"
                              : "border-transparent",
                          )}
                          style={swatch.isThemeDefault ? {} : { backgroundColor: swatch.color }}
                          title={swatch.name}
                        >
                          {isSelected && (
                            <Check
                              className={cn(
                                "size-4 drop-shadow",
                                swatch.isThemeDefault ? "text-white" : "text-white",
                              )}
                            />
                          )}
                        </button>
                      );
                    })}

                    {/* Rainbow circle custom hex picker */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => accentPickerRef.current?.click()}
                        className={cn(
                          "size-9 rounded-full border border-white/15 transition-transform hover:scale-110 flex items-center justify-center cursor-pointer shadow-xs",
                          accentColor === "custom-accent" && "ring-2 ring-white scale-105",
                        )}
                        style={{
                          background:
                            "conic-gradient(from 180deg at 50% 50%, #f43f5e, #fb923c, #facc15, #4ade80, #38bdf8, #818cf8, #c084fc, #f43f5e)",
                        }}
                        title="Pick custom accent color"
                      >
                        {accentColor === "custom-accent" && <Check className="size-4 text-white drop-shadow" />}
                        <span className="sr-only">Custom Accent</span>
                      </button>
                      <input
                        ref={accentPickerRef}
                        type="color"
                        value={customAccent}
                        onChange={(e) => handleSelectAccent("custom-accent", e.target.value)}
                        className="sr-only"
                      />
                    </div>
                  </div>
                </div>

                {/* Text Tone Card */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#121319] p-5 shadow-lg space-y-3.5">
                  <div>
                    <h3 className="text-sm font-bold text-white">Text</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      For Light and Platinum. Every tone is checked to stay easy to read.
                    </p>
                  </div>

                  <div className="space-y-3 pt-1">
                    {/* Row 1: Ink, Graphite, Espresso */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {TEXT_TONES.slice(0, 3).map((tone) => {
                        const isSelected = textTone === tone.id;
                        return (
                          <button
                            key={tone.id}
                            type="button"
                            onClick={() => handleSelectTextTone(tone.id)}
                            className={cn(
                              "flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all cursor-pointer bg-[#181922]",
                              isSelected
                                ? "border-2 border-white shadow-xs"
                                : "border-white/[0.08] hover:border-white/30",
                            )}
                          >
                            <span
                              className="text-base font-bold select-none"
                              style={{ color: tone.value }}
                            >
                              Aa
                            </span>
                            <span className="text-xs font-semibold text-white">
                              {tone.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Row 2: Navy, Your own */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {TEXT_TONES.slice(3).map((tone) => {
                        const isSelected = textTone === tone.id;
                        return (
                          <button
                            key={tone.id}
                            type="button"
                            onClick={() => handleSelectTextTone(tone.id)}
                            className={cn(
                              "flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all cursor-pointer bg-[#181922]",
                              isSelected
                                ? "border-2 border-white shadow-xs"
                                : "border-white/[0.08] hover:border-white/30",
                            )}
                          >
                            <span
                              className="text-base font-bold select-none"
                              style={{ color: tone.value }}
                            >
                              Aa
                            </span>
                            <span className="text-xs font-semibold text-white">
                              {tone.name}
                            </span>
                          </button>
                        );
                      })}

                      {/* Rainbow "Your own" text tone */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => customTextToneRef.current?.click()}
                          className={cn(
                            "w-full flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all cursor-pointer bg-[#181922]",
                            textTone === "custom"
                              ? "border-2 border-white shadow-xs"
                              : "border-white/[0.08] hover:border-white/30",
                          )}
                        >
                          <span
                            className="size-4 rounded-full border border-white/10 shrink-0"
                            style={{
                              background:
                                "conic-gradient(from 180deg at 50% 50%, #f43f5e, #fb923c, #facc15, #4ade80, #38bdf8, #818cf8, #c084fc, #f43f5e)",
                            }}
                          />
                          <span className="text-xs font-semibold text-white">
                            Your own
                          </span>
                        </button>
                        <input
                          ref={customTextToneRef}
                          type="color"
                          value={customTextTone}
                          onChange={(e) => {
                            setCustomTextTone(e.target.value);
                            handleSelectTextTone("custom", e.target.value);
                          }}
                          className="sr-only"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lines Card */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#121319] p-5 shadow-lg space-y-3.5">
                  <div>
                    <h3 className="text-sm font-bold text-white">Lines</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      The fading lines between rows and sections.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Theme */}
                    <button
                      type="button"
                      onClick={() => handleSelectLineStyle("theme")}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border p-3.5 text-left transition-all cursor-pointer bg-[#181922]",
                        lineStyle === "theme"
                          ? "border-2 border-white shadow-xs"
                          : "border-white/[0.08] hover:border-white/30",
                      )}
                    >
                      <span className="text-muted-foreground font-semibold">—</span>
                      <span className="text-xs font-semibold text-white">Theme</span>
                    </button>

                    {/* Text colour */}
                    <button
                      type="button"
                      onClick={() => handleSelectLineStyle("text")}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border p-3.5 text-left transition-all cursor-pointer bg-[#181922]",
                        lineStyle === "text"
                          ? "border-2 border-white shadow-xs"
                          : "border-white/[0.08] hover:border-white/30",
                      )}
                    >
                      <span className="text-white font-bold">—</span>
                      <span className="text-xs font-semibold text-white">Text colour</span>
                    </button>

                    {/* Accent */}
                    <button
                      type="button"
                      onClick={() => handleSelectLineStyle("accent")}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border p-3.5 text-left transition-all cursor-pointer bg-[#181922]",
                        lineStyle === "accent"
                          ? "border-2 border-white shadow-xs"
                          : "border-white/[0.08] hover:border-white/30",
                      )}
                    >
                      <span className="text-blue-600 font-bold">—</span>
                      <span className="text-xs font-semibold text-white">Accent</span>
                    </button>

                    {/* Your own */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => customLineColorRef.current?.click()}
                        className={cn(
                          "w-full flex items-center gap-2.5 rounded-xl border p-3.5 text-left transition-all cursor-pointer bg-[#181922]",
                          lineStyle === "custom"
                            ? "border-2 border-white shadow-xs"
                            : "border-white/[0.08] hover:border-white/30",
                        )}
                      >
                        <span className="font-bold text-blue-500">—</span>
                        <span className="text-xs font-semibold text-white">Your own</span>
                      </button>
                      <input
                        ref={customLineColorRef}
                        type="color"
                        value={customLineColor}
                        onChange={(e) => {
                          setCustomLineColor(e.target.value);
                          handleSelectLineStyle("custom", e.target.value);
                        }}
                        className="sr-only"
                      />
                    </div>
                  </div>
                </div>

                {/* Font Selector Card (2x2 Grid) */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#121319] p-5 shadow-lg space-y-3.5">
                  <div>
                    <h3 className="text-sm font-bold text-white">Font</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      For the whole journal. Share cards keep Satoshi.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    {JOURNAL_FONTS.map((font) => {
                      const isSelected = fontTheme === font.id;
                      return (
                        <button
                          key={font.id}
                          type="button"
                          onClick={() => handleSelectFont(font.id)}
                          className={cn(
                            "flex flex-col justify-between rounded-2xl border p-4 text-left transition-all cursor-pointer bg-[#181922] h-24",
                            isSelected
                              ? "border-2 border-white shadow-xs"
                              : "border-white/[0.08] hover:border-white/30",
                          )}
                        >
                          <div
                            className="text-3xl font-bold text-white"
                            style={{ fontFamily: font.fontFamily }}
                          >
                            {font.displaySample}
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-white">
                              {font.name}
                            </span>
                            <span className="font-mono text-zinc-400 font-medium">
                              {font.previewPnl}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Footer with theme status and Reset to default */}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-zinc-400">
                    {activeThemeDisplayName} theme
                  </span>
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-white shadow-xs active:scale-95 transition-all cursor-pointer"
                  >
                    <RotateCcw className="size-3.5" />
                    <span>Reset to default</span>
                  </button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                TAB 4: CUSTOM
                ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "custom" && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-white/[0.08] bg-[#121319] p-5 shadow-lg space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">Custom Palette Builder</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Define bespoke colors for canvas, surface cards, primary text, and signature accent.
                    </p>
                  </div>

                  {/* Quick Starter Inspirations */}
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                      Quick Starter Inspirations
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {QUICK_CUSTOM_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => {
                            const nextColors: CustomThemeColors = {
                              ...DEFAULT_CUSTOM_THEME_COLORS,
                              background: preset.background,
                              surface: preset.surface,
                              foreground: preset.foreground,
                              accent: preset.accent,
                            };
                            setCustomColors(nextColors);
                            saveCustomThemeColors(nextColors);
                            if (setStoreCustomThemeColors) {
                              setStoreCustomThemeColors(nextColors);
                            }
                            setColorTheme(CUSTOM_THEME_ID);
                            setThemeId(CUSTOM_THEME_ID);
                            try {
                              window.localStorage.setItem(THEME_STORAGE_KEY, CUSTOM_THEME_ID);
                            } catch {
                              // ignore error
                            }
                            applyColorTheme(CUSTOM_THEME_ID, null, nextColors);
                            toast.success(`Applied ${preset.name} preset`);
                          }}
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-[#181922] px-3 py-2 text-left hover:border-white/30 hover:bg-[#20222e] transition-all cursor-pointer"
                        >
                          <span className="text-xs font-semibold text-white">
                            {preset.name}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="size-2 rounded-full border border-white/20" style={{ backgroundColor: preset.background }} />
                            <span className="size-2 rounded-full border border-white/20" style={{ backgroundColor: preset.surface }} />
                            <span className="size-2 rounded-full border border-white/20" style={{ backgroundColor: preset.accent }} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hex Pickers Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    {/* Canvas Background */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-white">Canvas Background</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          aria-label="Canvas Background color picker"
                          value={toValidColorInputHex(customColors.background, "#080b10")}
                          onChange={(e) => {
                            const next = { ...customColors, background: e.target.value };
                            setCustomColors(next);
                            saveCustomThemeColors(next);
                            if (setStoreCustomThemeColors) {
                              setStoreCustomThemeColors(next);
                            }
                            setColorTheme(CUSTOM_THEME_ID);
                            setThemeId(CUSTOM_THEME_ID);
                            try {
                              window.localStorage.setItem(THEME_STORAGE_KEY, CUSTOM_THEME_ID);
                            } catch {
                              // ignore error
                            }
                            applyColorTheme(CUSTOM_THEME_ID, null, next);
                          }}
                          className="size-9 rounded-lg border border-white/10 cursor-pointer p-0.5"
                        />
                        <Input
                          aria-label="Canvas Background hex code"
                          value={customColors.background}
                          maxLength={7}
                          onChange={(e) => {
                            const next = { ...customColors, background: e.target.value };
                            setCustomColors(next);
                            saveCustomThemeColors(next);
                            if (setStoreCustomThemeColors) {
                              setStoreCustomThemeColors(next);
                            }
                            setColorTheme(CUSTOM_THEME_ID);
                            setThemeId(CUSTOM_THEME_ID);
                            try {
                              window.localStorage.setItem(THEME_STORAGE_KEY, CUSTOM_THEME_ID);
                            } catch {
                              // ignore error
                            }
                            applyColorTheme(CUSTOM_THEME_ID, null, next);
                          }}
                          className="bg-[#181922] font-mono text-xs text-white border-white/10"
                        />
                      </div>
                    </div>

                    {/* Surface Card */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-white">Surface Card</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          aria-label="Surface / Card color picker"
                          value={toValidColorInputHex(customColors.surface, "#111827")}
                          onChange={(e) => {
                            const next = { ...customColors, surface: e.target.value };
                            setCustomColors(next);
                            saveCustomThemeColors(next);
                            if (setStoreCustomThemeColors) {
                              setStoreCustomThemeColors(next);
                            }
                            setColorTheme(CUSTOM_THEME_ID);
                            setThemeId(CUSTOM_THEME_ID);
                            try {
                              window.localStorage.setItem(THEME_STORAGE_KEY, CUSTOM_THEME_ID);
                            } catch {
                              // ignore error
                            }
                            applyColorTheme(CUSTOM_THEME_ID, null, next);
                          }}
                          className="size-9 rounded-lg border border-white/10 cursor-pointer p-0.5"
                        />
                        <Input
                          aria-label="Surface / Card hex code"
                          value={customColors.surface}
                          maxLength={7}
                          onChange={(e) => {
                            const next = { ...customColors, surface: e.target.value };
                            setCustomColors(next);
                            saveCustomThemeColors(next);
                            if (setStoreCustomThemeColors) {
                              setStoreCustomThemeColors(next);
                            }
                            setColorTheme(CUSTOM_THEME_ID);
                            setThemeId(CUSTOM_THEME_ID);
                            try {
                              window.localStorage.setItem(THEME_STORAGE_KEY, CUSTOM_THEME_ID);
                            } catch {
                              // ignore error
                            }
                            applyColorTheme(CUSTOM_THEME_ID, null, next);
                          }}
                          className="bg-[#181922] font-mono text-xs text-white border-white/10"
                        />
                      </div>
                    </div>

                    {/* Text Foreground */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-white">Text Foreground</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          aria-label="Text Foreground color picker"
                          value={toValidColorInputHex(customColors.foreground, "#f3f4f6")}
                          onChange={(e) => {
                            const next = { ...customColors, foreground: e.target.value };
                            setCustomColors(next);
                            saveCustomThemeColors(next);
                            if (setStoreCustomThemeColors) {
                              setStoreCustomThemeColors(next);
                            }
                            setColorTheme(CUSTOM_THEME_ID);
                            setThemeId(CUSTOM_THEME_ID);
                            try {
                              window.localStorage.setItem(THEME_STORAGE_KEY, CUSTOM_THEME_ID);
                            } catch {
                              // ignore error
                            }
                            applyColorTheme(CUSTOM_THEME_ID, null, next);
                          }}
                          className="size-9 rounded-lg border border-white/10 cursor-pointer p-0.5"
                        />
                        <Input
                          aria-label="Text Foreground hex code"
                          value={customColors.foreground}
                          maxLength={7}
                          onChange={(e) => {
                            const next = { ...customColors, foreground: e.target.value };
                            setCustomColors(next);
                            saveCustomThemeColors(next);
                            if (setStoreCustomThemeColors) {
                              setStoreCustomThemeColors(next);
                            }
                            setColorTheme(CUSTOM_THEME_ID);
                            setThemeId(CUSTOM_THEME_ID);
                            try {
                              window.localStorage.setItem(THEME_STORAGE_KEY, CUSTOM_THEME_ID);
                            } catch {
                              // ignore error
                            }
                            applyColorTheme(CUSTOM_THEME_ID, null, next);
                          }}
                          className="bg-[#181922] font-mono text-xs text-white border-white/10"
                        />
                      </div>
                    </div>

                    {/* Accent Color */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-white">Accent Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          aria-label="Accent Color color picker"
                          value={toValidColorInputHex(customColors.accent, "#06b6d4")}
                          onChange={(e) => {
                            const next = { ...customColors, accent: e.target.value };
                            setCustomColors(next);
                            saveCustomThemeColors(next);
                            if (setStoreCustomThemeColors) {
                              setStoreCustomThemeColors(next);
                            }
                            setColorTheme(CUSTOM_THEME_ID);
                            setThemeId(CUSTOM_THEME_ID);
                            try {
                              window.localStorage.setItem(THEME_STORAGE_KEY, CUSTOM_THEME_ID);
                            } catch {
                              // ignore error
                            }
                            applyColorTheme(CUSTOM_THEME_ID, null, next);
                          }}
                          className="size-9 rounded-lg border border-white/10 cursor-pointer p-0.5"
                        />
                        <Input
                          aria-label="Accent Color hex code"
                          value={customColors.accent}
                          maxLength={7}
                          onChange={(e) => {
                            const next = { ...customColors, accent: e.target.value };
                            setCustomColors(next);
                            saveCustomThemeColors(next);
                            if (setStoreCustomThemeColors) {
                              setStoreCustomThemeColors(next);
                            }
                            setColorTheme(CUSTOM_THEME_ID);
                            setThemeId(CUSTOM_THEME_ID);
                            try {
                              window.localStorage.setItem(THEME_STORAGE_KEY, CUSTOM_THEME_ID);
                            } catch {
                              // ignore error
                            }
                            applyColorTheme(CUSTOM_THEME_ID, null, next);
                          }}
                          className="bg-[#181922] font-mono text-xs text-white border-white/10"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                TAB 5: MONEY
                ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "money" && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-white/[0.08] bg-[#121319] p-5 shadow-lg space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-white">Account Rules & Money</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Funded-account constraints plus risk tiers. ICT timing strictly uses {TRADING_TZ}.
                    </p>
                  </div>

                  <Field label="Account name">
                    <Input
                      value={data.accountName}
                      onChange={(e) => patchAccount({ accountName: e.target.value })}
                      className="bg-[#181922] text-white border-white/10"
                    />
                  </Field>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <Field label="Starting balance ($)">
                      <Input
                        type="number"
                        value={data.rules.startingBalance}
                        onChange={(e) => patchAccount({ startingBalance: Number(e.target.value) })}
                        className="bg-[#181922] text-white border-white/10"
                      />
                    </Field>
                    <Field label="Payout threshold %">
                      <Input
                        type="number"
                        step="0.5"
                        value={data.rules.payoutThresholdPct}
                        onChange={(e) => patchAccount({ payoutThresholdPct: Number(e.target.value) })}
                        className="bg-[#181922] text-white border-white/10"
                      />
                    </Field>
                    <Field label="Profit target %">
                      <Input
                        type="number"
                        step="0.5"
                        value={data.rules.profitTargetPct}
                        onChange={(e) => patchAccount({ profitTargetPct: Number(e.target.value) })}
                        className="bg-[#181922] text-white border-white/10"
                      />
                    </Field>
                    <Field label="Profit split %">
                      <Input
                        type="number"
                        value={data.rules.profitSplit}
                        onChange={(e) => patchAccount({ profitSplit: Number(e.target.value) })}
                        className="bg-[#181922] text-white border-white/10"
                      />
                    </Field>
                    <Field label="Max daily loss %">
                      <Input
                        type="number"
                        step="0.1"
                        value={data.rules.maxDailyLossPct}
                        onChange={(e) => patchAccount({ maxDailyLossPct: Number(e.target.value) })}
                        className="bg-[#181922] text-white border-white/10"
                      />
                    </Field>
                    <Field label="Max total DD %">
                      <Input
                        type="number"
                        step="0.1"
                        value={data.rules.maxTotalDrawdownPct}
                        onChange={(e) => patchAccount({ maxTotalDrawdownPct: Number(e.target.value) })}
                        className="bg-[#181922] text-white border-white/10"
                      />
                    </Field>
                    <Field label="Normal risk %">
                      <Input
                        type="number"
                        step="0.05"
                        value={data.rules.normalRiskPct}
                        onChange={(e) => patchAccount({ normalRiskPct: Number(e.target.value) })}
                        className="bg-[#181922] text-white border-white/10"
                      />
                    </Field>
                    <Field label="High-conviction %">
                      <Input
                        type="number"
                        step="0.05"
                        value={data.rules.highConvictionRiskPct}
                        onChange={(e) => patchAccount({ highConvictionRiskPct: Number(e.target.value) })}
                        className="bg-[#181922] text-white border-white/10"
                      />
                    </Field>
                    <Field label="Max trades / day">
                      <Input
                        type="number"
                        value={data.rules.maxTrades}
                        onChange={(e) => patchAccount({ maxTrades: Number(e.target.value) })}
                        className="bg-[#181922] text-white border-white/10"
                      />
                    </Field>
                    <Field label="Max consecutive losses">
                      <Input
                        type="number"
                        value={data.rules.maxConsecutiveLosses}
                        onChange={(e) => patchAccount({ maxConsecutiveLosses: Number(e.target.value) })}
                        className="bg-[#181922] text-white border-white/10"
                      />
                    </Field>
                    <Field label="Window start (NY)">
                      <Input
                        type="time"
                        value={data.rules.windowStart}
                        onChange={(e) => patchAccount({ windowStart: e.target.value })}
                        className="bg-[#181922] text-white border-white/10"
                      />
                    </Field>
                    <Field label="Window end (NY)">
                      <Input
                        type="time"
                        value={data.rules.windowEnd}
                        onChange={(e) => patchAccount({ windowEnd: e.target.value })}
                        className="bg-[#181922] text-white border-white/10"
                      />
                    </Field>
                    <Field label="Min trading days">
                      <Input
                        type="number"
                        value={data.rules.minTradingDays}
                        onChange={(e) => patchAccount({ minTradingDays: Number(e.target.value) })}
                        className="bg-[#181922] text-white border-white/10"
                      />
                    </Field>
                    <Field label="Consistency cap %">
                      <Input
                        type="number"
                        value={data.rules.consistencyPct}
                        onChange={(e) => patchAccount({ consistencyPct: Number(e.target.value) })}
                        className="bg-[#181922] text-white border-white/10"
                      />
                    </Field>
                    <Field label="Max lots">
                      <Input
                        type="number"
                        step="0.01"
                        value={data.rules.maxPositionLots}
                        onChange={(e) => patchAccount({ maxPositionLots: Number(e.target.value) })}
                        className="bg-[#181922] text-white border-white/10"
                      />
                    </Field>
                    <Field label="Protocol start">
                      <Input
                        type="date"
                        value={data.rules.protocolStartDate}
                        onChange={(e) => rebuildProtocolDates(e.target.value)}
                        className="bg-[#181922] text-white border-white/10"
                      />
                    </Field>
                  </div>

                  {/* Restrict Toggles */}
                  <div className="flex items-center justify-between rounded-xl bg-[#181922] px-3.5 py-2.5 border border-white/10">
                    <span className="text-xs font-semibold text-white">News restricted</span>
                    <Switch
                      checked={data.rules.newsRestricted}
                      onCheckedChange={(v) => patchAccount({ newsRestricted: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-[#181922] px-3.5 py-2.5 border border-white/10">
                    <span className="text-xs font-semibold text-white">Weekend restricted</span>
                    <Switch
                      checked={data.rules.weekendRestricted}
                      onCheckedChange={(v) => patchAccount({ weekendRestricted: v })}
                    />
                  </div>

                  <Field label="Scaling note">
                    <Input
                      value={data.rules.scalingNote}
                      onChange={(e) => patchAccount({ scalingNote: e.target.value })}
                      className="bg-[#181922] text-white border-white/10"
                    />
                  </Field>

                  <Field label="Mantra">
                    <Textarea
                      value={data.mantra}
                      onChange={(e) => patchAccount({ mantra: e.target.value })}
                      className="bg-[#181922] text-white border-white/10"
                    />
                  </Field>

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-3">
                    <Button onClick={handleSaveMoneySettings} disabled={isSavingMoney}>
                      {isSavingMoney ? "Saving…" : "Save settings"}
                    </Button>
                    <Button variant="outline" onClick={downloadBackup}>
                      Download backup
                    </Button>
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
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>

      {/* Delete / Reset Confirmation Dialog */}
      <ConfirmDelete
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset all desk data?"
        description="This permanently clears your trades, plans, notes, settings, and checklist progress. This cannot be undone."
        confirmLabel="Reset All Data"
        isPending={isResetting}
        pendingLabel="Resetting…"
        onConfirm={() => void handleReset()}
      />
    </DialogPrimitive.Root>
  );
}

// Backward-compatible alias for existing imports
export { SettingsModal as SettingsSheet };
