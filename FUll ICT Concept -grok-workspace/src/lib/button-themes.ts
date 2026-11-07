// Global button styles: Liquid ("Raised plates") & Chrome ("Specular pointer glow")
export type ButtonThemeId =
  | "liquid-theme"
  | "liquid-black"
  | "liquid-white"
  | "liquid-gold"
  | "liquid-amethyst"
  | "chrome-theme"
  | "chrome-black"
  | "chrome-matte"
  | "chrome-white";

export interface ButtonThemeOption {
  id: ButtonThemeId;
  group: "liquid" | "chrome";
  name: string;
  badge?: string;
  isLocked?: boolean;
  description: string;
}

export const BUTTON_THEMES: readonly ButtonThemeOption[] = [
  // Liquid Group
  {
    id: "liquid-theme",
    group: "liquid",
    name: "Theme",
    description: "Adaptive raised liquid plate using active palette colors.",
  },
  {
    id: "liquid-black",
    group: "liquid",
    name: "Black",
    description: "Deep obsidian raised plate with physical depth.",
  },
  {
    id: "liquid-white",
    group: "liquid",
    name: "White",
    description: "Porcelain white plate with clean shadow offset.",
  },
  {
    id: "liquid-gold",
    group: "liquid",
    name: "Gold",
    badge: "Prestige 🔒",
    isLocked: false, // unlocked for interactive enjoyment
    description: "24k champagne gold rimmed plate with warm metallic luster.",
  },
  {
    id: "liquid-amethyst",
    group: "liquid",
    name: "Amethyst",
    badge: "Apex 🔒",
    isLocked: false,
    description: "Deep royal violet plate with luminous ultraviolet accents.",
  },

  // Chrome Group
  {
    id: "chrome-theme",
    group: "chrome",
    name: "Theme",
    description: "Dynamic chrome specular lighting matched to theme accent.",
  },
  {
    id: "chrome-black",
    group: "chrome",
    name: "Black chrome",
    description: "Smoked obsidian chrome with directional light bevel.",
  },
  {
    id: "chrome-matte",
    group: "chrome",
    name: "Matte chrome",
    description: "Dark satin brushed aluminum with subtle edge reflection.",
  },
  {
    id: "chrome-white",
    group: "chrome",
    name: "White chrome",
    description: "Polished ceramic chrome with bright specular glare.",
  },
] as const;

export const DEFAULT_BUTTON_THEME: ButtonThemeId = "liquid-theme";
export const BUTTON_THEME_STORAGE_KEY = "first-payout-button-theme-v1";

export function getButtonTheme(): ButtonThemeId {
  if (typeof window === "undefined" || !window.localStorage) {
    return DEFAULT_BUTTON_THEME;
  }
  const val = window.localStorage.getItem(BUTTON_THEME_STORAGE_KEY) as ButtonThemeId | null;
  if (val && BUTTON_THEMES.some((t) => t.id === val)) {
    return val;
  }
  return DEFAULT_BUTTON_THEME;
}

export function applyButtonTheme(themeId: ButtonThemeId): void {
  if (typeof document === "undefined" || !document.documentElement) return;
  document.documentElement.setAttribute("data-button-style", themeId);
}

export function saveButtonTheme(themeId: ButtonThemeId): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(BUTTON_THEME_STORAGE_KEY, themeId);
  applyButtonTheme(themeId);
}
