import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  COLOR_THEMES,
  ACCENT_COLORS,
  DEFAULT_COLOR_THEME,
  DEFAULT_ACCENT_COLOR,
  CUSTOM_THEME_ID,
  CUSTOM_THEME_STORAGE_KEY,
  DEFAULT_CUSTOM_THEME_COLORS,
  createCustomTheme,
  getCustomThemeColors,
  saveCustomThemeColors,
  getThemeById,
  getAccentById,
  applyColorTheme,
  applyAccentColor,
  type CustomThemeColors,
} from "./color-themes.ts";
import { createInitialState, createResetState, ensureMinimumDeskData } from "./ict-defaults.ts";

describe("Color Themes and Palettes", () => {
  it("includes all 5 user-provided luxury palettes plus default", () => {
    const themeIds = COLOR_THEMES.map((t) => t.id);
    assert.ok(themeIds.includes("soulful-elegance"));
    assert.ok(themeIds.includes("royal-luxury"));
    assert.ok(themeIds.includes("minimalist-luxury"));
    assert.ok(themeIds.includes("emerald-forest"));
    assert.ok(themeIds.includes("midnight-slate"));
    assert.ok(themeIds.includes("cinema"));
  });

  it("verifies Soulful Elegance contains exact colors from image 1", () => {
    const theme = getThemeById("soulful-elegance");
    assert.equal(theme.colors.background, "#1B1819");
    assert.equal(theme.colors.subtle, "#535533");
    assert.equal(theme.colors.accent, "#D8BD71");
    assert.equal(theme.colors.accentDeep, "#BEA256");
    assert.equal(theme.colors.ring, "#E4AD75");
  });

  it("verifies Royal Luxury contains exact colors from image 2", () => {
    const theme = getThemeById("royal-luxury");
    assert.equal(theme.colors.foreground, "#FBF4EC");
    assert.equal(theme.colors.accent, "#B98A3C");
    assert.equal(theme.colors.subtle, "#0F5C4D");
    assert.equal(theme.colors.accentDeep, "#7B1E2B");
  });

  it("verifies Minimalist Luxury contains exact colors from image 3", () => {
    const theme = getThemeById("minimalist-luxury");
    assert.equal(theme.colors.background, "#000000");
    assert.equal(theme.colors.foreground, "#FFFFFF");
    assert.equal(theme.colors.accent, "#6D001A");
  });

  it("verifies Emerald Forest contains exact gradient hex codes from image 4", () => {
    const theme = getThemeById("emerald-forest");
    assert.deepEqual(theme.previewColors, [
      "#051F20",
      "#0B2B26",
      "#163B32",
      "#235347",
      "#8EB69B",
      "#DAF1DE",
    ]);
    assert.equal(theme.colors.background, "#051F20");
    assert.equal(theme.colors.card, "#0B2B26");
    assert.equal(theme.colors.surface2, "#163B32");
    assert.equal(theme.colors.surface3, "#235347");
    assert.equal(theme.colors.accent, "#8EB69B");
    assert.equal(theme.colors.foreground, "#DAF1DE");
  });

  it("verifies Midnight Slate contains exact gradient hex codes from image 5", () => {
    const theme = getThemeById("midnight-slate");
    assert.deepEqual(theme.previewColors, [
      "#06141B",
      "#11212D",
      "#253745",
      "#4A5C6A",
      "#9BA8AB",
      "#CCD0CF",
    ]);
    assert.equal(theme.colors.background, "#06141B");
    assert.equal(theme.colors.card, "#11212D");
    assert.equal(theme.colors.surface2, "#253745");
    assert.equal(theme.colors.surface3, "#4A5C6A");
    assert.equal(theme.colors.accent, "#9BA8AB");
    assert.equal(theme.colors.foreground, "#CCD0CF");
  });

  it("falls back to default theme for unknown or null themeId", () => {
    const fallbackNull = getThemeById(null);
    assert.equal(fallbackNull.id, DEFAULT_COLOR_THEME);

    const fallbackUnknown = getThemeById("non-existent-theme-id");
    assert.equal(fallbackUnknown.id, DEFAULT_COLOR_THEME);
  });

  it("falls back to default accent for unknown or null accentId", () => {
    const fallbackNull = getAccentById(null);
    assert.equal(fallbackNull.id, DEFAULT_ACCENT_COLOR);

    const fallbackUnknown = getAccentById("non-existent-accent-id");
    assert.equal(fallbackUnknown.id, DEFAULT_ACCENT_COLOR);
  });

  it("includes all signature palette accent options from the 5 palettes", () => {
    const accentIds = ACCENT_COLORS.map((a) => a.id);
    assert.ok(accentIds.includes("apache-gold"));
    assert.ok(accentIds.includes("golden-amber"));
    assert.ok(accentIds.includes("dark-pastel"));
    assert.ok(accentIds.includes("atomic-grey"));
    assert.ok(accentIds.includes("ochre-gold"));
    assert.ok(accentIds.includes("royal-wine"));
    assert.ok(accentIds.includes("deep-emerald"));
    assert.ok(accentIds.includes("soft-ivory"));
    assert.ok(accentIds.includes("burgundy-luxe"));
    assert.ok(accentIds.includes("minimal-white"));
    assert.ok(accentIds.includes("forest-mint"));
    assert.ok(accentIds.includes("emerald-pine"));
    assert.ok(accentIds.includes("pale-jade"));
    assert.ok(accentIds.includes("deep-forest"));
    assert.ok(accentIds.includes("slate-ice"));
    assert.ok(accentIds.includes("steel-navy"));
    assert.ok(accentIds.includes("silver-mist"));
    assert.ok(accentIds.includes("midnight-navy"));

    // Check specific values
    assert.equal(getAccentById("atomic-grey").value, "#535533");
    assert.equal(getAccentById("minimal-white").value, "#FFFFFF");
    assert.equal(getAccentById("deep-forest").value, "#163B32");
    assert.equal(getAccentById("midnight-navy").value, "#253745");
  });

  it("applies theme custom properties and data attributes to documentElement mock", () => {
    const properties = new Map<string, string>();
    const attributes = new Map<string, string>();
    let metaAttrs = new Map<string, string>();

    const doc = {
      documentElement: {
        style: {
          setProperty: (key: string, val: string) => {
            properties.set(key, val);
          },
        },
        setAttribute: (key: string, val: string) => {
          attributes.set(key, val);
        },
      },
      head: {
        appendChild: (el: { setAttribute: (k: string, v: string) => void }) => {
          metaAttrs = new Map<string, string>();
        },
      },
      createElement: () => ({
        setAttribute: (k: string, v: string) => {
          metaAttrs.set(k, v);
        },
      }),
      querySelector: (selector: string) => {
        if (selector === 'meta[name="theme-color"]' && metaAttrs.has("name")) {
          return {
            setAttribute: (k: string, v: string) => {
              metaAttrs.set(k, v);
            },
          };
        }
        return null;
      },
    };

    // Temporarily attach mock document
    (globalThis as unknown as { document: typeof doc }).document = doc;

    try {
      applyColorTheme("soulful-elegance", "golden-amber");
      assert.equal(properties.get("--color-background"), "#1B1819");
      assert.equal(properties.get("--color-accent"), "#E4AD75");
      assert.equal(properties.get("--color-primary"), "#E4AD75");
      assert.equal(properties.get("--color-ring"), "#E4AD75");
      assert.equal(attributes.get("data-theme"), "soulful-elegance");
      assert.equal(attributes.get("data-accent"), "golden-amber");
      assert.equal(metaAttrs.get("content"), "#1B1819");

      applyAccentColor("burgundy-luxe");
      assert.equal(properties.get("--color-accent"), "#6D001A");
      assert.equal(properties.get("--color-primary"), "#6D001A");
      assert.equal(attributes.get("data-accent"), "burgundy-luxe");
    } finally {
      delete (globalThis as unknown as { document?: typeof doc }).document;
    }
  });

  it("does not throw when executed in a non-DOM / SSR environment", () => {
    assert.doesNotThrow(() => {
      applyColorTheme("soulful-elegance");
      applyAccentColor("apache-gold");
    });
  });

  it("initializes and normalizes themeId and accentColor in desk defaults", () => {
    const initial = createInitialState();
    assert.equal(initial.themeId, "cinema");
    assert.equal(initial.accentColor, "cinema");

    const reset = createResetState();
    assert.equal(reset.themeId, "cinema");
    assert.equal(reset.accentColor, "cinema");

    const repaired = ensureMinimumDeskData({ ...initial, themeId: undefined, accentColor: undefined });
    assert.equal(repaired.themeId, "cinema");
    assert.equal(repaired.accentColor, "cinema");
  });

  it("creates custom theme with default values", () => {
    const theme = createCustomTheme();
    assert.equal(theme.id, CUSTOM_THEME_ID);
    assert.equal(theme.name, "Custom Palette");
    assert.equal(theme.badge, "Customizable");
    assert.equal(theme.description, "Configure custom colors for canvas, surfaces, text, and accent.");
    assert.equal(theme.defaultAccent, "custom-accent");
    assert.equal(theme.colors.background, DEFAULT_CUSTOM_THEME_COLORS.background);
    assert.equal(theme.colors.card, DEFAULT_CUSTOM_THEME_COLORS.surface);
    assert.equal(theme.colors.surface, DEFAULT_CUSTOM_THEME_COLORS.surface);
    assert.equal(theme.colors.foreground, DEFAULT_CUSTOM_THEME_COLORS.foreground);
    assert.equal(theme.colors.accent, DEFAULT_CUSTOM_THEME_COLORS.accent);
    assert.equal(theme.colors.primary, DEFAULT_CUSTOM_THEME_COLORS.accent);
    assert.equal(theme.colors.ring, DEFAULT_CUSTOM_THEME_COLORS.accent);
    assert.ok(Array.isArray(theme.previewColors));
    assert.equal(theme.previewColors.length, 6);
  });

  it("creates custom theme with partial and full color overrides", () => {
    const customInput: CustomThemeColors = {
      background: "#080c16",
      surface: "#101827",
      surface2: "#1f293d",
      surface3: "#2e3b52",
      foreground: "#f3f4f6",
      accent: "#10b981",
      accentForeground: "#000000",
      accentDeep: "#059669",
      border: "rgba(16, 185, 129, 0.2)",
      muted: "#1f293d",
      mutedForeground: "#9ca3af",
    };

    const theme = createCustomTheme(customInput);
    assert.equal(theme.id, "custom");
    assert.equal(theme.colors.background, "#080c16");
    assert.equal(theme.colors.card, "#101827");
    assert.equal(theme.colors.surface, "#101827");
    assert.equal(theme.colors.surface2, "#1f293d");
    assert.equal(theme.colors.surface3, "#2e3b52");
    assert.equal(theme.colors.foreground, "#f3f4f6");
    assert.equal(theme.colors.accent, "#10b981");
    assert.equal(theme.colors.accentForeground, "#000000");
    assert.equal(theme.colors.accentDeep, "#059669");
    assert.equal(theme.colors.border, "rgba(16, 185, 129, 0.2)");
    assert.equal(theme.colors.primary, "#10b981");
    assert.equal(theme.colors.ring, "#10b981");
  });

  it("resolves custom theme via getThemeById with and without custom color arguments", () => {
    const customDefault = getThemeById(CUSTOM_THEME_ID);
    assert.equal(customDefault.id, "custom");
    assert.equal(customDefault.name, "Custom Palette");
    assert.equal(customDefault.colors.background, DEFAULT_CUSTOM_THEME_COLORS.background);

    const customProvided = getThemeById("custom", {
      background: "#030712",
      accent: "#a855f7",
    });
    assert.equal(customProvided.id, "custom");
    assert.equal(customProvided.colors.background, "#030712");
    assert.equal(customProvided.colors.accent, "#a855f7");
  });

  it("applies custom theme CSS variables, attributes, and meta theme-color to documentElement mock", () => {
    const properties = new Map<string, string>();
    const attributes = new Map<string, string>();
    let metaAttrs = new Map<string, string>();

    const doc = {
      documentElement: {
        style: {
          setProperty: (key: string, val: string) => {
            properties.set(key, val);
          },
        },
        setAttribute: (key: string, val: string) => {
          attributes.set(key, val);
        },
      },
      head: {
        appendChild: () => {
          metaAttrs = new Map<string, string>();
        },
      },
      createElement: () => ({
        setAttribute: (k: string, v: string) => {
          metaAttrs.set(k, v);
        },
      }),
      querySelector: (selector: string) => {
        if (selector === 'meta[name="theme-color"]') {
          return {
            setAttribute: (k: string, v: string) => {
              metaAttrs.set(k, v);
            },
          };
        }
        return null;
      },
    };

    (globalThis as unknown as { document: typeof doc }).document = doc;

    try {
      applyColorTheme("custom", null, {
        background: "#0a0a0f",
        surface: "#12121a",
        foreground: "#f5f5f7",
        accent: "#6366f1",
      });

      assert.equal(properties.get("--color-background"), "#0a0a0f");
      assert.equal(properties.get("--color-card"), "#12121a");
      assert.equal(properties.get("--color-surface"), "#12121a");
      assert.equal(properties.get("--color-foreground"), "#f5f5f7");
      assert.equal(properties.get("--color-accent"), "#6366f1");
      assert.equal(properties.get("--color-primary"), "#6366f1");
      assert.equal(properties.get("--color-ring"), "#6366f1");
      assert.equal(attributes.get("data-theme"), "custom");
      assert.equal(attributes.get("data-accent"), "custom-accent");
      assert.equal(metaAttrs.get("content"), "#0a0a0f");
    } finally {
      delete (globalThis as unknown as { document?: typeof doc }).document;
    }
  });

  it("preserves custom background and surface when preset accent override is applied", () => {
    const properties = new Map<string, string>();
    const attributes = new Map<string, string>();

    const doc = {
      documentElement: {
        style: {
          setProperty: (key: string, val: string) => {
            properties.set(key, val);
          },
        },
        setAttribute: (key: string, val: string) => {
          attributes.set(key, val);
        },
      },
      head: { appendChild: () => {} },
      createElement: () => ({ setAttribute: () => {} }),
      querySelector: () => null,
    };

    (globalThis as unknown as { document: typeof doc }).document = doc;

    try {
      const customColors = {
        background: "#020617",
        surface: "#0f172a",
        foreground: "#f8fafc",
        accent: "#38bdf8",
      };

      // Apply custom theme with "golden-amber" preset accent swatch
      applyColorTheme("custom", "golden-amber", customColors);

      // Custom background and surface must remain intact
      assert.equal(properties.get("--color-background"), "#020617");
      assert.equal(properties.get("--color-card"), "#0f172a");
      assert.equal(properties.get("--color-foreground"), "#f8fafc");

      // Accent is overridden by golden-amber (#E4AD75)
      assert.equal(properties.get("--color-accent"), "#E4AD75");
      assert.equal(properties.get("--color-primary"), "#E4AD75");
      assert.equal(attributes.get("data-theme"), "custom");
      assert.equal(attributes.get("data-accent"), "golden-amber");

      // Then test independent applyAccentColor
      applyAccentColor("burgundy-luxe");
      assert.equal(properties.get("--color-background"), "#020617");
      assert.equal(properties.get("--color-accent"), "#6D001A");
      assert.equal(attributes.get("data-accent"), "burgundy-luxe");
    } finally {
      delete (globalThis as unknown as { document?: typeof doc }).document;
    }
  });

  it("ensures seamless coexistence: all 6 presets remain intact and can switch back and forth", () => {
    const properties = new Map<string, string>();
    const attributes = new Map<string, string>();

    const doc = {
      documentElement: {
        style: {
          setProperty: (key: string, val: string) => {
            properties.set(key, val);
          },
        },
        setAttribute: (key: string, val: string) => {
          attributes.set(key, val);
        },
      },
      head: { appendChild: () => {} },
      createElement: () => ({ setAttribute: () => {} }),
      querySelector: () => null,
    };

    (globalThis as unknown as { document: typeof doc }).document = doc;

    try {
      // 1. Verify preset definitions are completely untouched
      const cinema = getThemeById("cinema");
      assert.equal(cinema.colors.background, "#000000");
      assert.equal(cinema.colors.accent, "#e50914");

      const emerald = getThemeById("emerald-forest");
      assert.equal(emerald.colors.background, "#051F20");
      assert.equal(emerald.colors.accent, "#8EB69B");

      const midnight = getThemeById("midnight-slate");
      assert.equal(midnight.colors.background, "#06141B");
      assert.equal(midnight.colors.accent, "#9BA8AB");

      // 2. Switch to custom theme
      applyColorTheme("custom", null, { background: "#0c0e14", accent: "#38bdf8" });
      assert.equal(properties.get("--color-background"), "#0c0e14");
      assert.equal(properties.get("--color-accent"), "#38bdf8");
      assert.equal(attributes.get("data-theme"), "custom");

      // 3. Switch to preset theme "emerald-forest"
      applyColorTheme("emerald-forest");
      assert.equal(properties.get("--color-background"), "#051F20");
      assert.equal(properties.get("--color-accent"), "#8EB69B");
      assert.equal(attributes.get("data-theme"), "emerald-forest");

      // 4. Switch back to custom theme
      applyColorTheme("custom", null, { background: "#0c0e14", accent: "#38bdf8" });
      assert.equal(properties.get("--color-background"), "#0c0e14");
      assert.equal(properties.get("--color-accent"), "#38bdf8");
      assert.equal(attributes.get("data-theme"), "custom");
    } finally {
      delete (globalThis as unknown as { document?: typeof doc }).document;
    }
  });

  it("reads and saves custom theme colors with local storage persistence helper", () => {
    const storageMap = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => storageMap.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storageMap.set(key, value);
      },
      removeItem: (key: string) => {
        storageMap.delete(key);
      },
    };

    (globalThis as unknown as { window: { localStorage: typeof mockStorage } }).window = {
      localStorage: mockStorage,
    };

    try {
      // Default when empty
      const initial = getCustomThemeColors();
      assert.equal(initial.background, DEFAULT_CUSTOM_THEME_COLORS.background);

      // Save new colors
      saveCustomThemeColors({
        background: "#123456",
        accent: "#abcdef",
      });

      const updated = getCustomThemeColors();
      assert.equal(updated.background, "#123456");
      assert.equal(updated.accent, "#abcdef");
      assert.equal(updated.surface, DEFAULT_CUSTOM_THEME_COLORS.surface);
    } finally {
      delete (globalThis as unknown as { window?: unknown }).window;
    }
  });
});
