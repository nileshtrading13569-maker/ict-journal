export type ColorTheme = {
  id: string;
  name: string;
  badge: string;
  description: string;
  previewColors: string[];
  defaultAccent: string;
  colors: {
    background: string;
    card: string;
    cardForeground: string;
    surface: string;
    surface2: string;
    surface3: string;
    popover: string;
    popoverForeground: string;
    border: string;
    input: string;
    foreground: string;
    muted: string;
    mutedForeground: string;
    subtle: string;
    accent: string;
    accentForeground: string;
    accentDeep: string;
    primary: string;
    primaryForeground: string;
    ring: string;
    glow1?: string;
    glow2?: string;
  };
};

export type AccentColor = {
  id: string;
  name: string;
  paletteGroup: string;
  value: string;
  foreground: string;
  deep?: string;
};

export const COLOR_THEMES: readonly ColorTheme[] = [
  {
    id: "light",
    name: "Light",
    badge: "Clean Porcelain",
    description: "Modern, crisp porcelain light aesthetic with high contrast ink typography.",
    previewColors: ["#ffffff", "#f8f9fa", "#f1f3f5", "#e9ecef", "#3b82f6", "#111827"],
    defaultAccent: "blue",
    colors: {
      background: "#f8f9fa",
      card: "#ffffff",
      cardForeground: "#111827",
      surface: "#ffffff",
      surface2: "#f3f4f6",
      surface3: "#e5e7eb",
      popover: "#ffffff",
      popoverForeground: "#111827",
      border: "rgba(0, 0, 0, 0.08)",
      input: "rgba(0, 0, 0, 0.08)",
      foreground: "#111827",
      muted: "#f3f4f6",
      mutedForeground: "#6b7280",
      subtle: "#9ca3af",
      accent: "#3b82f6",
      accentForeground: "#ffffff",
      accentDeep: "#1d4ed8",
      primary: "#3b82f6",
      primaryForeground: "#ffffff",
      ring: "#3b82f6",
    },
  },
  {
    id: "platinum",
    name: "Platinum",
    badge: "Metallic Silver",
    description: "Refined cool silver-platinum metal tones with graphite elements.",
    previewColors: ["#ebedf0", "#f3f5f7", "#e2e6ea", "#ced4da", "#2563eb", "#0f172a"],
    defaultAccent: "blue",
    colors: {
      background: "#ebedf0",
      card: "#f8f9fb",
      cardForeground: "#0f172a",
      surface: "#f8f9fb",
      surface2: "#e5e8ec",
      surface3: "#d7dce2",
      popover: "#f8f9fb",
      popoverForeground: "#0f172a",
      border: "rgba(15, 23, 42, 0.09)",
      input: "rgba(15, 23, 42, 0.09)",
      foreground: "#0f172a",
      muted: "#e5e8ec",
      mutedForeground: "#64748b",
      subtle: "#94a3b8",
      accent: "#2563eb",
      accentForeground: "#ffffff",
      accentDeep: "#1d4ed8",
      primary: "#2563eb",
      primaryForeground: "#ffffff",
      ring: "#2563eb",
    },
  },
  {
    id: "cinema",
    name: "Cinematic Red",
    badge: "Desk Default",
    description: "Pure obsidian canvas with cinema red action signals and hairline division rules.",
    previewColors: ["#000000", "#0a0a0a", "#151515", "#1d1d1d", "#e50914", "#ffffff"],
    defaultAccent: "cinema",
    colors: {
      background: "#000000",
      card: "#0a0a0a",
      cardForeground: "#f5f5f4",
      surface: "#0a0a0a",
      surface2: "#151515",
      surface3: "#1d1d1d",
      popover: "#0e0e0e",
      popoverForeground: "#f5f5f4",
      border: "rgba(255, 255, 255, 0.09)",
      input: "rgba(255, 255, 255, 0.09)",
      foreground: "#f5f5f4",
      muted: "#151515",
      mutedForeground: "#a2a2a0",
      subtle: "#6f6f6d",
      accent: "#e50914",
      accentForeground: "#ffffff",
      accentDeep: "#8e0d15",
      primary: "#e50914",
      primaryForeground: "#ffffff",
      ring: "#e50914",
    },
  },
  {
    id: "soulful-elegance",
    name: "Soulful Elegance",
    badge: "Gold & Amber",
    description: "Opulent Raisin Black canvas accented with Apache Gold, Golden Amber, and Atomic Grey.",
    previewColors: ["#1B1819", "#535533", "#BEA256", "#D8BD71", "#E4AD75"],
    defaultAccent: "apache-gold",
    colors: {
      background: "#1B1819",
      card: "#242022",
      cardForeground: "#FDFBF7",
      surface: "#242022",
      surface2: "#2e292c",
      surface3: "#3d373a",
      popover: "#242022",
      popoverForeground: "#FDFBF7",
      border: "rgba(216, 189, 113, 0.22)",
      input: "rgba(216, 189, 113, 0.18)",
      foreground: "#FDFBF7",
      muted: "#2e292c",
      mutedForeground: "#bfb7a8",
      subtle: "#535533",
      accent: "#D8BD71",
      accentForeground: "#1B1819",
      accentDeep: "#BEA256",
      primary: "#D8BD71",
      primaryForeground: "#1B1819",
      ring: "#E4AD75",
    },
  },
  {
    id: "royal-luxury",
    name: "Royal Luxury",
    badge: "Imperial Jewels",
    description: "Majestic deep emerald and imperial wine palette with ochre gold highlights and soft ivory.",
    previewColors: ["#091412", "#0F5C4D", "#7B1E2B", "#B98A3C", "#FBF4EC"],
    defaultAccent: "ochre-gold",
    colors: {
      background: "#091412",
      card: "#0f221e",
      cardForeground: "#FBF4EC",
      surface: "#0f221e",
      surface2: "#162e29",
      surface3: "#203d36",
      popover: "#0f221e",
      popoverForeground: "#FBF4EC",
      border: "rgba(185, 138, 60, 0.26)",
      input: "rgba(185, 138, 60, 0.20)",
      foreground: "#FBF4EC",
      muted: "#162e29",
      mutedForeground: "#9fb2ac",
      subtle: "#0F5C4D",
      accent: "#B98A3C",
      accentForeground: "#091412",
      accentDeep: "#7B1E2B",
      primary: "#B98A3C",
      primaryForeground: "#091412",
      ring: "#B98A3C",
    },
  },
  {
    id: "minimalist-luxury",
    name: "Minimalist Luxury",
    badge: "Burgundy & Black",
    description: "High-contrast pure obsidian and stark white with rich silk burgundy accents.",
    previewColors: ["#000000", "#14070a", "#360812", "#6D001A", "#FFFFFF"],
    defaultAccent: "burgundy-luxe",
    colors: {
      background: "#000000",
      card: "#0c0608",
      cardForeground: "#FFFFFF",
      surface: "#0c0608",
      surface2: "#170a0e",
      surface3: "#261017",
      popover: "#0c0608",
      popoverForeground: "#FFFFFF",
      border: "rgba(255, 255, 255, 0.12)",
      input: "rgba(255, 255, 255, 0.12)",
      foreground: "#FFFFFF",
      muted: "#170a0e",
      mutedForeground: "#b3a8ab",
      subtle: "#400d1b",
      accent: "#6D001A",
      accentForeground: "#FFFFFF",
      accentDeep: "#480011",
      primary: "#6D001A",
      primaryForeground: "#FFFFFF",
      ring: "#910d29",
    },
  },
  {
    id: "emerald-forest",
    name: "Emerald Forest",
    badge: "Forest Gradient",
    description: "Lush multi-layered gradient series from nocturnal emerald into misty jade and mint sage.",
    previewColors: ["#051F20", "#0B2B26", "#163B32", "#235347", "#8EB69B", "#DAF1DE"],
    defaultAccent: "forest-mint",
    colors: {
      background: "#051F20",
      card: "#0B2B26",
      cardForeground: "#DAF1DE",
      surface: "#0B2B26",
      surface2: "#163B32",
      surface3: "#235347",
      popover: "#0B2B26",
      popoverForeground: "#DAF1DE",
      border: "rgba(142, 182, 155, 0.24)",
      input: "rgba(142, 182, 155, 0.18)",
      foreground: "#DAF1DE",
      muted: "#163B32",
      mutedForeground: "#8EB69B",
      subtle: "#235347",
      accent: "#8EB69B",
      accentForeground: "#051F20",
      accentDeep: "#235347",
      primary: "#8EB69B",
      primaryForeground: "#051F20",
      ring: "#8EB69B",
    },
  },
  {
    id: "midnight-slate",
    name: "Midnight Slate",
    badge: "Navy Slate Gradient",
    description: "Atmospheric technical gradient descending from deep ocean navy into steel slate and silver ice.",
    previewColors: ["#06141B", "#11212D", "#253745", "#4A5C6A", "#9BA8AB", "#CCD0CF"],
    defaultAccent: "slate-ice",
    colors: {
      background: "#06141B",
      card: "#11212D",
      cardForeground: "#CCD0CF",
      surface: "#11212D",
      surface2: "#253745",
      surface3: "#4A5C6A",
      popover: "#11212D",
      popoverForeground: "#CCD0CF",
      border: "rgba(155, 168, 171, 0.24)",
      input: "rgba(155, 168, 171, 0.18)",
      foreground: "#CCD0CF",
      muted: "#253745",
      mutedForeground: "#9BA8AB",
      subtle: "#4A5C6A",
      accent: "#9BA8AB",
      accentForeground: "#06141B",
      accentDeep: "#4A5C6A",
      primary: "#9BA8AB",
      primaryForeground: "#06141B",
      ring: "#9BA8AB",
    },
  },
] as const;

export const ACCENT_COLORS: readonly AccentColor[] = [
  // Soulful Elegance Palette
  { id: "apache-gold", name: "Apache Gold", paletteGroup: "Soulful Elegance", value: "#D8BD71", foreground: "#1B1819", deep: "#BEA256" },
  { id: "golden-amber", name: "Golden Amber", paletteGroup: "Soulful Elegance", value: "#E4AD75", foreground: "#1B1819", deep: "#c28850" },
  { id: "dark-pastel", name: "Dark Pastel Gold", paletteGroup: "Soulful Elegance", value: "#BEA256", foreground: "#1B1819", deep: "#947c38" },
  { id: "atomic-grey", name: "Atomic Grey", paletteGroup: "Soulful Elegance", value: "#535533", foreground: "#ffffff", deep: "#3d3e25" },

  // Royal Luxury Palette
  { id: "ochre-gold", name: "Ochre Gold", paletteGroup: "Royal Luxury", value: "#B98A3C", foreground: "#091412", deep: "#8c6525" },
  { id: "royal-wine", name: "Royal Wine", paletteGroup: "Royal Luxury", value: "#7B1E2B", foreground: "#ffffff", deep: "#52121b" },
  { id: "deep-emerald", name: "Deep Emerald", paletteGroup: "Royal Luxury", value: "#0F5C4D", foreground: "#ffffff", deep: "#093a30" },
  { id: "soft-ivory", name: "Soft Ivory", paletteGroup: "Royal Luxury", value: "#FBF4EC", foreground: "#091412", deep: "#d6caba" },

  // Minimalist Luxury Palette
  { id: "burgundy-luxe", name: "Burgundy Luxe", paletteGroup: "Minimalist Luxury", value: "#6D001A", foreground: "#ffffff", deep: "#480011" },
  { id: "minimal-white", name: "Stark White", paletteGroup: "Minimalist Luxury", value: "#FFFFFF", foreground: "#000000", deep: "#d4d4d4" },

  // Emerald Forest Gradient Palette
  { id: "forest-mint", name: "Mint Jade", paletteGroup: "Emerald Forest", value: "#8EB69B", foreground: "#051F20", deep: "#235347" },
  { id: "emerald-pine", name: "Emerald Pine", paletteGroup: "Emerald Forest", value: "#235347", foreground: "#ffffff", deep: "#163B32" },
  { id: "pale-jade", name: "Pale Jade", paletteGroup: "Emerald Forest", value: "#DAF1DE", foreground: "#051F20", deep: "#8EB69B" },
  { id: "deep-forest", name: "Hunter Green", paletteGroup: "Emerald Forest", value: "#163B32", foreground: "#ffffff", deep: "#0B2B26" },

  // Midnight Slate Gradient Palette
  { id: "slate-ice", name: "Slate Ice", paletteGroup: "Midnight Slate", value: "#9BA8AB", foreground: "#06141B", deep: "#4A5C6A" },
  { id: "steel-navy", name: "Steel Navy", paletteGroup: "Midnight Slate", value: "#4A5C6A", foreground: "#ffffff", deep: "#253745" },
  { id: "silver-mist", name: "Silver Mist", paletteGroup: "Midnight Slate", value: "#CCD0CF", foreground: "#06141B", deep: "#9BA8AB" },
  { id: "midnight-navy", name: "Deep Navy", paletteGroup: "Midnight Slate", value: "#253745", foreground: "#ffffff", deep: "#11212D" },

  // Cinematic Classics
  { id: "cinema", name: "Cinema Red", paletteGroup: "Cinematic Classics", value: "#e50914", foreground: "#ffffff", deep: "#8e0d15" },
  { id: "scarlet", name: "Scarlet", paletteGroup: "Cinematic Classics", value: "#ff2d3f", foreground: "#ffffff", deep: "#b81222" },
  { id: "wine", name: "Wine", paletteGroup: "Cinematic Classics", value: "#9f1239", foreground: "#ffffff", deep: "#660720" },
  { id: "ember", name: "Ember", paletteGroup: "Cinematic Classics", value: "#f5b942", foreground: "#111111", deep: "#c28b23" },
  { id: "ice", name: "Ice", paletteGroup: "Cinematic Classics", value: "#7dd3fc", foreground: "#082f49", deep: "#0284c7" },
  { id: "violet", name: "Violet", paletteGroup: "Cinematic Classics", value: "#c4b5fd", foreground: "#2e1065", deep: "#7c3aed" },
  { id: "sage", name: "Sage", paletteGroup: "Cinematic Classics", value: "#d4ded0", foreground: "#111111", deep: "#94a390" },
] as const;

export type ColorThemeId = (typeof COLOR_THEMES)[number]["id"] | typeof CUSTOM_THEME_ID;
export type AccentColorId = (typeof ACCENT_COLORS)[number]["id"];

export const CUSTOM_THEME_ID = "custom" as const;
export const CUSTOM_THEME_STORAGE_KEY = "first-payout-custom-theme-palette-v1";

export type CustomThemeColors = {
  background: string;     // Canvas background, e.g. "#0c0e14"
  surface: string;        // Card & modal surface, e.g. "#141824"
  surface2?: string;      // Elevated surface 2
  surface3?: string;      // Elevated surface 3
  foreground: string;     // Primary text color, e.g. "#f8fafc"
  accent: string;         // Signature accent / primary color, e.g. "#38bdf8"
  accentForeground?: string; // Text on accent
  accentDeep?: string;    // Deep accent shade
  border?: string;        // Border color
  muted?: string;         // Muted surface
  mutedForeground?: string; // Secondary text
};

export const DEFAULT_CUSTOM_THEME_COLORS: CustomThemeColors = {
  background: "#0c0e14",
  surface: "#141824",
  surface2: "#1c2233",
  surface3: "#262e45",
  foreground: "#f8fafc",
  accent: "#38bdf8",
  accentForeground: "#0c0e14",
  accentDeep: "#0284c7",
  border: "rgba(56, 189, 248, 0.20)",
  muted: "#1c2233",
  mutedForeground: "#94a3b8",
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return { r, g, b };
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return { r, g, b };
  }
  return null;
}

function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function adjustBrightness(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const adjust = (val: number) => Math.max(0, Math.min(255, Math.round(val + (255 * percent) / 100)));
  const r = adjust(rgb.r).toString(16).padStart(2, "0");
  const g = adjust(rgb.g).toString(16).padStart(2, "0");
  const b = adjust(rgb.b).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

function getContrastColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#ffffff";
  const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return yiq >= 128 ? "#000000" : "#ffffff";
}

export function getCustomThemeColors(): CustomThemeColors {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return { ...DEFAULT_CUSTOM_THEME_COLORS };
  }
  try {
    const raw = window.localStorage.getItem(CUSTOM_THEME_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CUSTOM_THEME_COLORS };
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ...DEFAULT_CUSTOM_THEME_COLORS };
    }
    const background =
      typeof parsed.background === "string" && parsed.background
        ? parsed.background
        : DEFAULT_CUSTOM_THEME_COLORS.background;
    const surface =
      typeof parsed.surface === "string" && parsed.surface
        ? parsed.surface
        : DEFAULT_CUSTOM_THEME_COLORS.surface;
    const foreground =
      typeof parsed.foreground === "string" && parsed.foreground
        ? parsed.foreground
        : DEFAULT_CUSTOM_THEME_COLORS.foreground;
    const accent =
      typeof parsed.accent === "string" && parsed.accent
        ? parsed.accent
        : DEFAULT_CUSTOM_THEME_COLORS.accent;

    return {
      background,
      surface,
      foreground,
      accent,
      surface2:
        parsed.surface2 ||
        (parsed.surface ? adjustBrightness(surface, 6) : DEFAULT_CUSTOM_THEME_COLORS.surface2),
      surface3:
        parsed.surface3 ||
        (parsed.surface ? adjustBrightness(surface, 12) : DEFAULT_CUSTOM_THEME_COLORS.surface3),
      accentForeground:
        parsed.accentForeground ||
        (parsed.accent ? getContrastColor(accent) : DEFAULT_CUSTOM_THEME_COLORS.accentForeground),
      accentDeep:
        parsed.accentDeep ||
        (parsed.accent ? adjustBrightness(accent, -20) : DEFAULT_CUSTOM_THEME_COLORS.accentDeep),
      border:
        parsed.border ||
        (parsed.foreground ? hexToRgba(foreground, 0.12) : DEFAULT_CUSTOM_THEME_COLORS.border),
      muted:
        parsed.muted ||
        (parsed.surface ? adjustBrightness(surface, 6) : DEFAULT_CUSTOM_THEME_COLORS.muted),
      mutedForeground:
        parsed.mutedForeground ||
        (parsed.foreground ? adjustBrightness(foreground, -35) : DEFAULT_CUSTOM_THEME_COLORS.mutedForeground),
    };
  } catch {
    return { ...DEFAULT_CUSTOM_THEME_COLORS };
  }
}

export function saveCustomThemeColors(colors: Partial<CustomThemeColors>): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return;
  }
  try {
    const current = getCustomThemeColors();
    const merged: CustomThemeColors = { ...current, ...colors };
    if (colors.accent && !colors.accentForeground) {
      merged.accentForeground = getContrastColor(colors.accent);
      merged.accentDeep = adjustBrightness(colors.accent, -20);
    }
    if (colors.surface && !colors.surface2) {
      merged.surface2 = adjustBrightness(colors.surface, 6);
      merged.surface3 = adjustBrightness(colors.surface, 12);
      merged.muted = merged.surface2;
    }
    if (colors.foreground && !colors.border) {
      merged.border = hexToRgba(colors.foreground, 0.12);
      merged.mutedForeground = adjustBrightness(colors.foreground, -35);
    }
    window.localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(merged));
  } catch (e) {
    console.error("[color-themes] failed to save custom theme colors:", e);
  }
}

export function createCustomTheme(colors?: Partial<CustomThemeColors> | null): ColorTheme {
  const user = colors ?? {};

  const background = user.background || DEFAULT_CUSTOM_THEME_COLORS.background;
  const surface = user.surface || DEFAULT_CUSTOM_THEME_COLORS.surface;
  const foreground = user.foreground || DEFAULT_CUSTOM_THEME_COLORS.foreground;
  const accent = user.accent || DEFAULT_CUSTOM_THEME_COLORS.accent;

  const surface2 = user.surface2 || adjustBrightness(surface, 6);
  const surface3 = user.surface3 || adjustBrightness(surface, 12);
  const accentForeground = user.accentForeground || getContrastColor(accent);
  const accentDeep = user.accentDeep || adjustBrightness(accent, -20);
  const border = user.border || hexToRgba(foreground, 0.12);
  const muted = user.muted || surface2;
  const mutedForeground = user.mutedForeground || adjustBrightness(foreground, -35);

  return {
    id: CUSTOM_THEME_ID,
    name: "Custom Palette",
    badge: "Customizable",
    description: "Configure custom colors for canvas, surfaces, text, and accent.",
    previewColors: [background, surface, surface2, surface3, accent, foreground],
    defaultAccent: "custom-accent",
    colors: {
      background,
      card: surface,
      cardForeground: foreground,
      surface,
      surface2,
      surface3,
      popover: surface,
      popoverForeground: foreground,
      border,
      input: hexToRgba(foreground, 0.10),
      foreground,
      muted,
      mutedForeground,
      subtle: adjustBrightness(accent, -20),
      accent,
      accentForeground,
      accentDeep,
      primary: accent,
      primaryForeground: accentForeground,
      ring: accent,
    },
  };
}

export const DEFAULT_COLOR_THEME: ColorThemeId = "cinema";
export const DEFAULT_ACCENT_COLOR: AccentColorId = "cinema";

export const THEME_STORAGE_KEY = "first-payout-theme-palette-v1";
export const ACCENT_STORAGE_KEY = "first-payout-accent-color-v2";

export function getThemeById(
  id?: string | null,
  customColors?: Partial<CustomThemeColors> | null,
): ColorTheme {
  if (id === CUSTOM_THEME_ID) {
    return createCustomTheme(
      customColors ?? (typeof window !== "undefined" ? getCustomThemeColors() : null),
    );
  }
  return (
    COLOR_THEMES.find((theme) => theme.id === id) ??
    COLOR_THEMES.find((theme) => theme.id === DEFAULT_COLOR_THEME) ??
    COLOR_THEMES[0]
  );
}

export function getAccentById(id?: string | null): AccentColor {
  return (
    ACCENT_COLORS.find((accent) => accent.id === id) ??
    ACCENT_COLORS.find((accent) => accent.id === DEFAULT_ACCENT_COLOR) ??
    ACCENT_COLORS[0]
  );
}

export function applyColorTheme(
  themeId: string,
  accentOverride?: string | null,
  customColors?: Partial<CustomThemeColors> | null,
) {
  if (typeof document === "undefined") return;

  const theme = getThemeById(themeId, customColors);
  const root = document.documentElement.style;

  root.setProperty("--color-background", theme.colors.background);
  root.setProperty("--color-card", theme.colors.card);
  root.setProperty("--color-card-foreground", theme.colors.cardForeground);
  root.setProperty("--color-surface", theme.colors.surface);
  root.setProperty("--color-surface-2", theme.colors.surface2);
  root.setProperty("--color-surface-3", theme.colors.surface3);
  root.setProperty("--color-popover", theme.colors.popover);
  root.setProperty("--color-popover-foreground", theme.colors.popoverForeground);
  root.setProperty("--color-border", theme.colors.border);
  root.setProperty("--color-input", theme.colors.input);
  root.setProperty("--color-foreground", theme.colors.foreground);
  root.setProperty("--color-secondary", theme.colors.surface2);
  root.setProperty("--color-secondary-foreground", theme.colors.foreground);
  root.setProperty("--color-muted", theme.colors.muted);
  root.setProperty("--color-muted-foreground", theme.colors.mutedForeground);
  root.setProperty("--color-subtle", theme.colors.subtle);

  let effectiveAccentValue = theme.colors.accent;
  let effectiveAccentFg = theme.colors.accentForeground;
  let effectiveAccentDeep = theme.colors.accentDeep;
  let effectiveAccentId = theme.defaultAccent;

  if (accentOverride && accentOverride !== theme.defaultAccent) {
    const overrideAccent = ACCENT_COLORS.find((a) => a.id === accentOverride);
    if (overrideAccent) {
      effectiveAccentValue = overrideAccent.value;
      effectiveAccentFg = overrideAccent.foreground;
      effectiveAccentDeep = overrideAccent.deep ?? theme.colors.accentDeep;
      effectiveAccentId = overrideAccent.id;
    }
  } else if (theme.id !== CUSTOM_THEME_ID) {
    const defaultAccent = getAccentById(theme.defaultAccent);
    effectiveAccentValue = defaultAccent.value;
    effectiveAccentFg = defaultAccent.foreground;
    effectiveAccentDeep = defaultAccent.deep ?? theme.colors.accentDeep;
    effectiveAccentId = defaultAccent.id;
  }

  root.setProperty("--color-accent", effectiveAccentValue);
  root.setProperty("--color-accent-foreground", effectiveAccentFg);
  root.setProperty("--color-accent-deep", effectiveAccentDeep);
  root.setProperty("--color-primary", effectiveAccentValue);
  root.setProperty("--color-primary-foreground", effectiveAccentFg);
  root.setProperty("--color-ring", effectiveAccentValue);

  if (document.documentElement && typeof document.documentElement.setAttribute === "function") {
    document.documentElement.setAttribute("data-theme", theme.id);
    document.documentElement.setAttribute("data-accent", effectiveAccentId);
  }

  let metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (!metaThemeColor && typeof document.createElement === "function" && document.head) {
    metaThemeColor = document.createElement("meta");
    metaThemeColor.setAttribute("name", "theme-color");
    document.head.appendChild(metaThemeColor);
  }
  if (metaThemeColor && typeof metaThemeColor.setAttribute === "function") {
    metaThemeColor.setAttribute("content", theme.colors.background);
  }
}

export function applyAccentColor(accentId: string) {
  if (typeof document === "undefined") return;

  const accent = getAccentById(accentId);
  const root = document.documentElement.style;

  root.setProperty("--color-accent", accent.value);
  root.setProperty("--color-accent-foreground", accent.foreground);
  root.setProperty("--color-accent-deep", accent.deep ?? accent.value);
  root.setProperty("--color-primary", accent.value);
  root.setProperty("--color-primary-foreground", accent.foreground);
  root.setProperty("--color-ring", accent.value);

  if (document.documentElement && typeof document.documentElement.setAttribute === "function") {
    document.documentElement.setAttribute("data-accent", accent.id);
  }
}

