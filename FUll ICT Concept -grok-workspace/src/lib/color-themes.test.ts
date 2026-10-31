import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  COLOR_THEMES,
  ACCENT_COLORS,
  DEFAULT_COLOR_THEME,
  DEFAULT_ACCENT_COLOR,
  getThemeById,
  getAccentById,
  applyColorTheme,
  applyAccentColor,
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
});
