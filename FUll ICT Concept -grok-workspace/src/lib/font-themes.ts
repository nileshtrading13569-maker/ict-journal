export interface FontThemeOption {
  id: string;
  name: string;
  number?: string;
  headingName?: string;
  bodyName?: string;
  badge: string;
  category?: "curated" | "terminal";
  description: string;
  display: string;
  sans: string;
  googleFontsUrl?: string;
  isCurated?: boolean;
}

export const FONT_STORAGE_KEY = "first-payout-font-theme-v1";
export const DYNAMIC_FONT_LINK_ID = "dynamic-font-theme";
export const PREVIEW_PACK_LINK_ID = "google-fonts-preview-pack";

export const CURATED_PREVIEW_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Albert+Sans:wght@600&family=Average&family=Barlow+Condensed:wght@600&family=Birthstone+Bounce:wght@500&family=Bodoni+Moda:opsz,wght@6..96,600&family=Caveat:wght@600&family=Crimson+Pro:wght@500&family=Libre+Caslon+Display&family=Montserrat:wght@500;700&family=Nunito+Sans:wght@500&family=Oswald:wght@500&family=Pinyon+Script&family=Playfair+Display:wght@600;700&family=Quicksand:wght@600&display=swap";

// ── 8 Curated Font Pairings (ORIGINAL_REQUEST R1) ───────────────────────
export const CURATED_FONT_PAIRINGS: readonly FontThemeOption[] = [
  {
    id: "gibson-gotham",
    number: "01",
    name: "Gibson & Gotham",
    headingName: "Gibson (Script)",
    bodyName: "Gotham (Montserrat)",
    badge: "01 · Script & Geometric",
    category: "curated",
    isCurated: true,
    description: "Flowing calligraphy script headings with modern geometric all-caps sans",
    display: '"Pinyon Script", "Alex Brush", cursive',
    sans: '"Montserrat", "Inter", sans-serif',
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Pinyon+Script&display=swap",
  },
  {
    id: "playfair-montserrat",
    number: "02",
    name: "Playfair Display & Montserrat",
    headingName: "Playfair Display",
    bodyName: "Montserrat",
    badge: "02 · Editorial Luxury",
    category: "curated",
    isCurated: true,
    description: "High-contrast transitional serif paired with clean modern geometric sans",
    display: '"Playfair Display", Georgia, serif',
    sans: '"Montserrat", "Inter", sans-serif',
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap",
  },
  {
    id: "bloom-avenir",
    number: "03",
    name: "Beautiful Bloom & Avenir Next",
    headingName: "Beautiful Bloom",
    bodyName: "Avenir Next (Nunito)",
    badge: "03 · Signature & Humanist",
    category: "curated",
    isCurated: true,
    description: "Organic signature script titles paired with humanistic geometric body sans",
    display: '"Birthstone Bounce", "Caveat", cursive',
    sans: '"Nunito Sans", -apple-system, sans-serif',
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Birthstone+Bounce:wght@400;500&family=Nunito+Sans:ital,opsz,wght@0,6..12,400;0,6..12,600;0,6..12,700;1,6..12,400&display=swap",
  },
  {
    id: "museo-average",
    number: "04",
    name: "Museo Sans & Average",
    headingName: "Museo Sans",
    bodyName: "Average",
    badge: "04 · Geometric & Classic",
    category: "curated",
    isCurated: true,
    description: "Contemporary balanced sans display with classic literary body serif",
    display: '"Albert Sans", "Plus Jakarta Sans", sans-serif',
    sans: '"Average", Georgia, serif',
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Albert+Sans:ital,wght@0,500;0,600;0,700;1,400&family=Average&display=swap",
  },
  {
    id: "caslon-oswald",
    number: "05",
    name: "Big Caslon & Oswald",
    headingName: "Big Caslon",
    bodyName: "Oswald",
    badge: "05 · Heritage & Condensed",
    category: "curated",
    isCurated: true,
    description: "Distinguished British serif headings with punchy industrial condensed sans",
    display: '"Libre Caslon Display", "Big Caslon", Georgia, serif',
    sans: '"Oswald", "IBM Plex Sans", sans-serif',
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Libre+Caslon+Display&family=Oswald:wght@400;500;600;700&display=swap",
  },
  {
    id: "playlist-georgia",
    number: "06",
    name: "Playlist & Georgia",
    headingName: "Playlist",
    bodyName: "Georgia",
    badge: "06 · Brush & Editorial",
    category: "curated",
    isCurated: true,
    description: "Artistic brush script headings supported by authoritative editorial serif body",
    display: '"Caveat", "Playball", cursive',
    sans: 'Georgia, "Times New Roman", serif',
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&display=swap",
  },
  {
    id: "bodoni-barlow",
    number: "07",
    name: "Bodoni & Barlow Condensed",
    headingName: "Bodoni",
    bodyName: "Barlow Condensed",
    badge: "07 · High Fashion & Didone",
    category: "curated",
    isCurated: true,
    description: "Ultra high-contrast Didone serif paired with clean condensed grotesque sans",
    display: '"Bodoni Moda", "Didot", serif',
    sans: '"Barlow Condensed", sans-serif',
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Bodoni+Moda:ital,opsz,wght@0,6..96,500;0,6..96,700;1,6..96,400&display=swap",
  },
  {
    id: "quicksand-crimson",
    number: "08",
    name: "Quicksand & Crimson",
    headingName: "Quicksand",
    bodyName: "Crimson",
    badge: "08 · Modern Rounded & Warm",
    category: "curated",
    isCurated: true,
    description: "Friendly modern rounded geometric sans with warm scholarly serif reading text",
    display: '"Quicksand", sans-serif',
    sans: '"Crimson Pro", "Crimson Text", Georgia, serif',
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,500;0,600;1,400&family=Quicksand:wght@500;600;700&display=swap",
  },
] as const;

// ── Trading Terminal Essentials ─────────────────────────────────────────
export const TERMINAL_FONT_THEMES: readonly FontThemeOption[] = [
  {
    id: "satoshi",
    number: undefined,
    name: "Satoshi",
    headingName: "Satoshi",
    bodyName: "Satoshi",
    badge: "Modern Grotesk",
    category: "terminal",
    isCurated: false,
    description: "Clean modern geometric grotesque typography with balanced curves",
    display: '"Satoshi", "Plus Jakarta Sans", sans-serif',
    sans: '"Satoshi", "Inter", sans-serif',
    googleFontsUrl: "https://api.fontshare.com/v2/css?f[]=satoshi@700,500,400&display=swap",
  },
  {
    id: "geist",
    number: undefined,
    name: "Geist",
    headingName: "Geist",
    bodyName: "Geist",
    badge: "Precision Sans",
    category: "terminal",
    isCurated: false,
    description: "Modern typeface engineered for high-density interface precision",
    display: '"Geist", "Inter", sans-serif',
    sans: '"Geist", -apple-system, sans-serif',
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap",
  },
  {
    id: "gambetta",
    number: undefined,
    name: "Gambetta",
    headingName: "Gambetta",
    bodyName: "Gambetta",
    badge: "Contemporary Serif",
    category: "terminal",
    isCurated: false,
    description: "Sophisticated editorial serif with sharp distinctive terminals",
    display: '"Gambetta", "Instrument Serif", Georgia, serif',
    sans: '"Gambetta", Georgia, serif',
    googleFontsUrl: "https://api.fontshare.com/v2/css?f[]=gambetta@700,500,400&display=swap",
  },
  {
    id: "mono",
    number: undefined,
    name: "Mono",
    headingName: "JetBrains Mono",
    bodyName: "IBM Plex Mono",
    badge: "Tabular Monospace",
    category: "terminal",
    isCurated: false,
    description: "High-legibility developer monospace for charts and tabular financial data",
    display: '"JetBrains Mono", "IBM Plex Mono", monospace',
    sans: '"IBM Plex Mono", ui-monospace, monospace',
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap",
  },
  {
    id: "jakarta",
    number: undefined,
    name: "Plus Jakarta Sans",
    headingName: "Plus Jakarta Sans",
    bodyName: "IBM Plex Sans",
    badge: "TradeZella Default",
    category: "terminal",
    isCurated: false,
    description: "Modern geometric sans-serif with ultra-clean readability for numbers & charts",
    display: '"Plus Jakarta Sans", "Inter", sans-serif',
    sans: '"Plus Jakarta Sans", "IBM Plex Sans", sans-serif',
    googleFontsUrl: undefined,
  },
  {
    id: "inter",
    number: undefined,
    name: "Inter",
    headingName: "Inter",
    bodyName: "Inter",
    badge: "Classic Tech",
    category: "terminal",
    isCurated: false,
    description: "Neutral, crisp interface typography standard used across modern SaaS",
    display: '"Inter", sans-serif',
    sans: '"Inter", -apple-system, sans-serif',
    googleFontsUrl: undefined,
  },
  {
    id: "ibm-plex",
    number: undefined,
    name: "IBM Plex Sans",
    headingName: "IBM Plex Sans",
    bodyName: "IBM Plex Sans",
    badge: "Terminal Core",
    category: "terminal",
    isCurated: false,
    description: "High-contrast technical monospace and sans aesthetic inspired by terminals",
    display: '"IBM Plex Sans", sans-serif',
    sans: '"IBM Plex Sans", sans-serif',
    googleFontsUrl: undefined,
  },
  {
    id: "cinematic-serif",
    number: undefined,
    name: "Instrument Serif",
    headingName: "Instrument Serif",
    bodyName: "IBM Plex Sans",
    badge: "Editorial Serif",
    category: "terminal",
    isCurated: false,
    description: "Classic high-contrast serif for headings with terminal sans body",
    display: '"Instrument Serif", Georgia, serif',
    sans: '"IBM Plex Sans", sans-serif',
    googleFontsUrl: undefined,
  },
  {
    id: "system",
    number: undefined,
    name: "System Default",
    headingName: "System Default",
    bodyName: "System Default",
    badge: "Native OS",
    category: "terminal",
    isCurated: false,
    description: "Native operating system typography (SF Pro / Segoe UI / Roboto) with zero latency",
    display: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    googleFontsUrl: undefined,
  },
] as const;

export const FONT_THEMES: readonly FontThemeOption[] = [
  ...CURATED_FONT_PAIRINGS,
  ...TERMINAL_FONT_THEMES,
] as const;

export type FontTheme = (typeof FONT_THEMES)[number]["id"] | "default";
export const DEFAULT_FONT_THEME: FontTheme = "default";

export function getFontThemeById(themeId: string | null | undefined): FontThemeOption | undefined {
  if (!themeId || themeId === "default") return undefined;
  return FONT_THEMES.find((option) => option.id === themeId);
}

export function loadFontPreviewStylesheet(): void {
  if (typeof document === "undefined") return;
  if (!document.getElementById(PREVIEW_PACK_LINK_ID)) {
    const link = document.createElement("link");
    link.id = PREVIEW_PACK_LINK_ID;
    link.rel = "stylesheet";
    link.href = CURATED_PREVIEW_FONTS_URL;
    document.head?.appendChild(link);
  }
}

export function resetFontTheme(): void {
  if (typeof document === "undefined") return;

  const existing = document.getElementById(DYNAMIC_FONT_LINK_ID);
  if (existing) {
    if (typeof existing.remove === "function") {
      existing.remove();
    } else if (existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  }

  const rootStyle = document.documentElement?.style;
  if (rootStyle) {
    if (typeof rootStyle.removeProperty === "function") {
      rootStyle.removeProperty("--font-display");
      rootStyle.removeProperty("--font-sans");
    } else if (typeof rootStyle.setProperty === "function") {
      rootStyle.setProperty("--font-display", "");
      rootStyle.setProperty("--font-sans", "");
    }
  }
}

export function applyFontTheme(themeId: FontTheme | "default" | null | undefined): void {
  if (typeof document === "undefined") return;

  if (!themeId || themeId === "default") {
    resetFontTheme();
    return;
  }

  const font = FONT_THEMES.find((option) => option.id === themeId);
  if (!font) {
    resetFontTheme();
    return;
  }

  const existing = document.getElementById(DYNAMIC_FONT_LINK_ID) as HTMLLinkElement | null;

  if (font.googleFontsUrl) {
    if (existing) {
      if (existing.href !== font.googleFontsUrl) {
        existing.href = font.googleFontsUrl;
      }
    } else {
      const link = document.createElement("link");
      link.id = DYNAMIC_FONT_LINK_ID;
      link.rel = "stylesheet";
      link.href = font.googleFontsUrl;
      document.head?.appendChild(link);
    }
  } else if (existing) {
    if (typeof existing.remove === "function") {
      existing.remove();
    } else if (existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  }

  const root = document.documentElement?.style;
  if (root?.setProperty) {
    root.setProperty("--font-display", font.display);
    root.setProperty("--font-sans", font.sans);
  }
}
