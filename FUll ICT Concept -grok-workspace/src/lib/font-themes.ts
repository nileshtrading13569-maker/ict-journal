export const FONT_THEMES = [
  {
    id: "jakarta",
    name: "Plus Jakarta Sans",
    badge: "TradeZella Default",
    description: "Modern geometric sans-serif with ultra-clean readability",
    display: '"Plus Jakarta Sans", "Inter", sans-serif',
    sans: '"Plus Jakarta Sans", "IBM Plex Sans", sans-serif',
  },
  {
    id: "inter",
    name: "Inter",
    badge: "Classic Tech",
    description: "Neutral, crisp interface typography standard",
    display: '"Inter", sans-serif',
    sans: '"Inter", -apple-system, sans-serif',
  },
  {
    id: "ibm-plex",
    name: "IBM Plex Sans",
    badge: "Terminal Core",
    description: "High-contrast technical monospace and sans aesthetic",
    display: '"IBM Plex Sans", sans-serif',
    sans: '"IBM Plex Sans", sans-serif',
  },
  {
    id: "cinematic-serif",
    name: "Instrument Serif",
    badge: "Editorial Serif",
    description: "Classic high-contrast serif for headings with sans body",
    display: '"Instrument Serif", Georgia, serif',
    sans: '"IBM Plex Sans", sans-serif',
  },
  {
    id: "system",
    name: "System Default",
    badge: "Native OS",
    description: "Native operating system typography with zero latency",
    display: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
] as const;

export type FontTheme = (typeof FONT_THEMES)[number]["id"];
export const DEFAULT_FONT_THEME: FontTheme = "jakarta";
export const FONT_STORAGE_KEY = "first-payout-font-theme-v1";

export function applyFontTheme(fontId: FontTheme) {
  if (typeof document === "undefined") return;
  const font = FONT_THEMES.find((option) => option.id === fontId) ?? FONT_THEMES[0];
  if (!font) return;
  const root = document.documentElement.style;
  root.setProperty("--font-display", font.display);
  root.setProperty("--font-sans", font.sans);
}

