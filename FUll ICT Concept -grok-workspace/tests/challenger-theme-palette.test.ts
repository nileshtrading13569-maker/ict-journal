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
  type ColorTheme,
  type CustomThemeColors,
} from "../src/lib/color-themes.ts";
import { createInitialState, createResetState, ensureMinimumDeskData } from "../src/lib/ict-defaults.ts";
import type { DeskData } from "../src/lib/ict-types.ts";

function createMockDocument() {
  const properties = new Map<string, string>();
  const attributes = new Map<string, string>();
  const metaAttrs = new Map<string, string>();

  const doc = {
    documentElement: {
      style: {
        setProperty: (key: string, val: string) => {
          properties.set(key, val);
        },
        getPropertyValue: (key: string) => properties.get(key) ?? "",
      },
      setAttribute: (key: string, val: string) => {
        attributes.set(key, val);
      },
      getAttribute: (key: string) => attributes.get(key) ?? null,
    },
    head: {
      appendChild: (_el: unknown) => {
        metaAttrs.set("name", "theme-color");
      },
    },
    createElement: (_tag: string) => ({
      setAttribute: (k: string, v: string) => {
        metaAttrs.set(k, v);
      },
      getAttribute: (k: string) => metaAttrs.get(k) ?? null,
    }),
    querySelector: (selector: string) => {
      if (selector === 'meta[name="theme-color"]') {
        return {
          setAttribute: (k: string, v: string) => {
            metaAttrs.set(k, v);
          },
          getAttribute: (k: string) => metaAttrs.get(k) ?? null,
        };
      }
      return null;
    },
  };

  return { doc, properties, attributes, metaAttrs };
}

function createMockLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    _raw: store,
  };
}

// Mirror of toValidColorInputHex from settings-sheet.tsx for verification
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

// Independent DeskData custom theme validator replicating sync schema logic
function validateDeskDataCustomTheme(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  if (d.customThemeColors === undefined) return true;
  if (typeof d.customThemeColors !== "object" || d.customThemeColors === null) return false;
  const c = d.customThemeColors as Record<string, unknown>;
  return (
    typeof c.background === "string" &&
    typeof c.surface === "string" &&
    typeof c.foreground === "string" &&
    typeof c.accent === "string"
  );
}

describe("Adversarial Theme Challenge: Custom Theme Palette & Invariants", () => {
  // Snapshot all preset themes & accents for invariant checking
  const PRESET_SNAPSHOT = JSON.parse(JSON.stringify(COLOR_THEMES)) as readonly ColorTheme[];
  const ACCENT_SNAPSHOT = JSON.parse(JSON.stringify(ACCENT_COLORS));

  // 1. Theme State Switching Cycles
  describe("1. Theme state switching cycles and state isolation", () => {
    it("survives 30 rapid back-and-forth transitions between all 6 presets and custom palette with zero leakage", () => {
      const { doc, properties, attributes, metaAttrs } = createMockDocument();
      (globalThis as unknown as { document: typeof doc }).document = doc;

      const customCfg: CustomThemeColors = {
        background: "#05070a",
        surface: "#0e131d",
        foreground: "#f0f4f8",
        accent: "#38bdf8",
      };

      const presetIds = [
        "cinema",
        "soulful-elegance",
        "royal-luxury",
        "minimalist-luxury",
        "emerald-forest",
        "midnight-slate",
      ] as const;

      try {
        // Run 5 full rounds of all 6 presets alternating with custom palette (30 switches)
        for (let round = 0; round < 5; round++) {
          for (const presetId of presetIds) {
            // Step A: Switch to preset
            applyColorTheme(presetId);
            const presetExpected = getThemeById(presetId);

            assert.equal(attributes.get("data-theme"), presetId, `data-theme mismatch on preset ${presetId}`);
            assert.equal(
              properties.get("--color-background"),
              presetExpected.colors.background,
              `Background corrupted for preset ${presetId} in round ${round}`,
            );
            assert.equal(
              properties.get("--color-card"),
              presetExpected.colors.card,
              `Card corrupted for preset ${presetId} in round ${round}`,
            );
            assert.equal(
              metaAttrs.get("content"),
              presetExpected.colors.background,
              `Meta theme-color corrupted for preset ${presetId}`,
            );

            // Step B: Switch to custom palette
            applyColorTheme(CUSTOM_THEME_ID, null, customCfg);
            assert.equal(attributes.get("data-theme"), CUSTOM_THEME_ID, `data-theme mismatch on custom in round ${round}`);
            assert.equal(
              properties.get("--color-background"),
              customCfg.background,
              `Custom background leaked or corrupted after preset ${presetId} in round ${round}`,
            );
            assert.equal(
              properties.get("--color-card"),
              customCfg.surface,
              `Custom surface leaked or corrupted after preset ${presetId} in round ${round}`,
            );
            assert.equal(
              properties.get("--color-accent"),
              customCfg.accent,
              `Custom accent leaked or corrupted after preset ${presetId} in round ${round}`,
            );
            assert.equal(
              metaAttrs.get("content"),
              customCfg.background,
              `Meta theme-color corrupted for custom after ${presetId}`,
            );
          }
        }
      } finally {
        delete (globalThis as unknown as { document?: typeof doc }).document;
      }
    });

    it("verifies state independence when changing custom colors while a preset is active", () => {
      const { doc, properties, attributes } = createMockDocument();
      (globalThis as unknown as { document: typeof doc }).document = doc;

      try {
        // Apply preset
        applyColorTheme("royal-luxury");
        const royal = getThemeById("royal-luxury");
        assert.equal(properties.get("--color-background"), royal.colors.background);
        assert.equal(attributes.get("data-theme"), "royal-luxury");

        // Generate custom theme object with mutated colors — preset DOM must NOT change
        const customTheme = createCustomTheme({ background: "#ffffff", surface: "#eeeeee" });
        assert.equal(customTheme.colors.background, "#ffffff");

        // The live DOM must still reflect Royal Luxury
        assert.equal(properties.get("--color-background"), royal.colors.background);
        assert.equal(attributes.get("data-theme"), "royal-luxury");
      } finally {
        delete (globalThis as unknown as { document?: typeof doc }).document;
      }
    });
  });

  // 2. Boundary Color Inputs
  describe("2. Boundary color inputs and extreme edge cases", () => {
    it("handles pure black (#000000) without underflowing brightness or producing NaN", () => {
      const blackTheme = createCustomTheme({
        background: "#000000",
        surface: "#000000",
        foreground: "#000000",
        accent: "#000000",
      });

      assert.equal(blackTheme.colors.background, "#000000");
      assert.equal(blackTheme.colors.card, "#000000");
      assert.equal(blackTheme.colors.surface, "#000000");
      // Elevated surface2 adjusted by +6% must not underflow
      assert.ok(/^#[0-9a-fA-F]{6}$/.test(blackTheme.colors.surface2));
      // Accent contrast for pure black must be pure white
      assert.equal(blackTheme.colors.accentForeground, "#ffffff");
      // Preview colors must all be valid 6-character hex strings
      for (const hex of blackTheme.previewColors) {
        assert.ok(/^#[0-9a-fA-F]{6}$/.test(hex), `Invalid hex in preview: ${hex}`);
      }
    });

    it("handles pure white (#ffffff and #FFFFFF) without overflowing brightness", () => {
      const whiteTheme = createCustomTheme({
        background: "#ffffff",
        surface: "#ffffff",
        foreground: "#ffffff",
        accent: "#FFFFFF",
      });

      assert.equal(whiteTheme.colors.background, "#ffffff");
      assert.equal(whiteTheme.colors.surface, "#ffffff");
      // Elevated surface3 adjusted by +12% on white must clamp at #ffffff without overflow
      assert.equal(whiteTheme.colors.surface3.toLowerCase(), "#ffffff");
      // Accent contrast on white must be black
      assert.equal(whiteTheme.colors.accentForeground, "#000000");
      // Border generation on white foreground should be valid rgba
      assert.ok(whiteTheme.colors.border.startsWith("rgba(255, 255, 255"));
    });

    it("handles mixed case hex codes (#aAbBcC, #1a2B3c) consistently", () => {
      const mixedTheme = createCustomTheme({
        background: "#aAbBcC",
        surface: "#1a2B3c",
        foreground: "#FdEa90",
        accent: "#Ff00Aa",
      });

      assert.equal(mixedTheme.colors.background, "#aAbBcC");
      assert.equal(mixedTheme.colors.surface, "#1a2B3c");
      assert.equal(mixedTheme.colors.foreground, "#FdEa90");
      assert.equal(mixedTheme.colors.accent, "#Ff00Aa");
      // Accent deep should adjust brightness properly from mixed-case hex
      assert.ok(/^#[0-9a-fA-F]{6}$/.test(mixedTheme.colors.accentDeep));
      assert.ok(/^#[0-9a-fA-F]{6}$/.test(mixedTheme.colors.surface2));
    });

    it("handles 3-digit short hex codes (#000, #fff, #38b) gracefully", () => {
      const shortTheme = createCustomTheme({
        background: "#000",
        surface: "#111",
        foreground: "#fff",
        accent: "#38b",
      });

      assert.equal(shortTheme.colors.background, "#000");
      assert.equal(shortTheme.colors.surface, "#111");
      // Derived colors from 3-digit hex should compute valid rgb
      assert.ok(/^#[0-9a-fA-F]{6}$/.test(shortTheme.colors.surface2));
      assert.ok(/^#[0-9a-fA-F]{6}$/.test(shortTheme.colors.accentDeep));
    });

    it("handles extreme primary saturations and computes correct contrast foregrounds", () => {
      const saturations = [
        { hex: "#ff0000", expectedFg: "#ffffff" }, // pure red -> white text
        { hex: "#00ff00", expectedFg: "#000000" }, // pure green -> high luminance -> black text
        { hex: "#0000ff", expectedFg: "#ffffff" }, // pure blue -> dark luminance -> white text
        { hex: "#ffff00", expectedFg: "#000000" }, // pure yellow -> high luminance -> black text
        { hex: "#00ffff", expectedFg: "#000000" }, // cyan -> black text
        { hex: "#ff00ff", expectedFg: "#ffffff" }, // magenta -> white text
      ];

      for (const { hex, expectedFg } of saturations) {
        const theme = createCustomTheme({ accent: hex });
        assert.equal(
          theme.colors.accentForeground,
          expectedFg,
          `Contrast foreground failure for saturated accent ${hex}`,
        );
      }
    });

    it("handles empty strings and null/undefined values by falling back to DEFAULT_CUSTOM_THEME_COLORS", () => {
      const emptyTheme = createCustomTheme({
        background: "",
        surface: "",
        foreground: "",
        accent: "",
      });

      assert.equal(emptyTheme.colors.background, DEFAULT_CUSTOM_THEME_COLORS.background);
      assert.equal(emptyTheme.colors.surface, DEFAULT_CUSTOM_THEME_COLORS.surface);
      assert.equal(emptyTheme.colors.foreground, DEFAULT_CUSTOM_THEME_COLORS.foreground);
      assert.equal(emptyTheme.colors.accent, DEFAULT_CUSTOM_THEME_COLORS.accent);

      const nullTheme = createCustomTheme(null);
      assert.equal(nullTheme.colors.background, DEFAULT_CUSTOM_THEME_COLORS.background);
    });

    it("validates toValidColorInputHex helper with various inputs", () => {
      assert.equal(toValidColorInputHex("#123456"), "#123456");
      assert.equal(toValidColorInputHex("#aBcDef"), "#aBcDef");
      assert.equal(toValidColorInputHex("#123"), "#112233");
      assert.equal(toValidColorInputHex("#abc"), "#aabbcc");
      assert.equal(toValidColorInputHex("invalid", "#38bdf8"), "#38bdf8");
      assert.equal(toValidColorInputHex("", "#0c0e14"), "#0c0e14");
      assert.equal(toValidColorInputHex(undefined, "#141824"), "#141824");
    });
  });

  // 3. Custom Color Mutation and DOM CSS Custom Property Application
  describe("3. Custom color mutation and DOM CSS custom property application (all 20+ variables)", () => {
    it("accurately injects all 22 CSS variables, data-theme, data-accent, and meta theme-color", () => {
      const { doc, properties, attributes, metaAttrs } = createMockDocument();
      (globalThis as unknown as { document: typeof doc }).document = doc;

      try {
        const customPalette: CustomThemeColors = {
          background: "#090d16",
          surface: "#111827",
          surface2: "#1f2937",
          surface3: "#374151",
          foreground: "#f9fafb",
          accent: "#06b6d4",
          accentForeground: "#000000",
          accentDeep: "#0891b2",
          border: "rgba(6, 182, 212, 0.25)",
          muted: "#1f2937",
          mutedForeground: "#9ca3af",
        };

        applyColorTheme(CUSTOM_THEME_ID, null, customPalette);

        const expectedVariables: Record<string, string> = {
          "--color-background": "#090d16",
          "--color-card": "#111827",
          "--color-card-foreground": "#f9fafb",
          "--color-surface": "#111827",
          "--color-surface-2": "#1f2937",
          "--color-surface-3": "#374151",
          "--color-popover": "#111827",
          "--color-popover-foreground": "#f9fafb",
          "--color-border": "rgba(6, 182, 212, 0.25)",
          "--color-input": "rgba(249, 250, 251, 0.1)",
          "--color-foreground": "#f9fafb",
          "--color-secondary": "#1f2937",
          "--color-secondary-foreground": "#f9fafb",
          "--color-muted": "#1f2937",
          "--color-muted-foreground": "#9ca3af",
          "--color-accent": "#06b6d4",
          "--color-accent-foreground": "#000000",
          "--color-accent-deep": "#0891b2",
          "--color-primary": "#06b6d4",
          "--color-primary-foreground": "#000000",
          "--color-ring": "#06b6d4",
        };

        for (const [varName, expectedVal] of Object.entries(expectedVariables)) {
          const actualVal = properties.get(varName);
          assert.equal(
            actualVal,
            expectedVal,
            `CSS variable ${varName} mismatch. Expected ${expectedVal}, got ${actualVal}`,
          );
        }

        // Subtly adjusted subtle color must exist
        assert.ok(properties.has("--color-subtle"), "Missing --color-subtle variable");

        // Verify HTML element attributes
        assert.equal(attributes.get("data-theme"), "custom");
        assert.equal(attributes.get("data-accent"), "custom-accent");
        assert.equal(metaAttrs.get("content"), "#090d16");
      } finally {
        delete (globalThis as unknown as { document?: typeof doc }).document;
      }
    });

    it("updates only targeted CSS variables when mutating single color attributes sequentially", () => {
      const { doc, properties } = createMockDocument();
      (globalThis as unknown as { document: typeof doc }).document = doc;

      try {
        let currentPalette: CustomThemeColors = { ...DEFAULT_CUSTOM_THEME_COLORS };
        applyColorTheme(CUSTOM_THEME_ID, null, currentPalette);

        // Mutate Canvas Background only
        currentPalette = { ...currentPalette, background: "#1a1a2e" };
        applyColorTheme(CUSTOM_THEME_ID, null, currentPalette);
        assert.equal(properties.get("--color-background"), "#1a1a2e");
        // Surface and Accent should remain untouched
        assert.equal(properties.get("--color-surface"), DEFAULT_CUSTOM_THEME_COLORS.surface);
        assert.equal(properties.get("--color-accent"), DEFAULT_CUSTOM_THEME_COLORS.accent);

        // Mutate Surface only
        currentPalette = { ...currentPalette, surface: "#16213e" };
        applyColorTheme(CUSTOM_THEME_ID, null, currentPalette);
        assert.equal(properties.get("--color-background"), "#1a1a2e");
        assert.equal(properties.get("--color-surface"), "#16213e");
        assert.equal(properties.get("--color-card"), "#16213e");
        assert.equal(properties.get("--color-accent"), DEFAULT_CUSTOM_THEME_COLORS.accent);

        // Mutate Accent only
        currentPalette = { ...currentPalette, accent: "#e94560" };
        applyColorTheme(CUSTOM_THEME_ID, null, currentPalette);
        assert.equal(properties.get("--color-background"), "#1a1a2e");
        assert.equal(properties.get("--color-surface"), "#16213e");
        assert.equal(properties.get("--color-accent"), "#e94560");
        assert.equal(properties.get("--color-primary"), "#e94560");
        assert.equal(properties.get("--color-ring"), "#e94560");
      } finally {
        delete (globalThis as unknown as { document?: typeof doc }).document;
      }
    });
  });

  // 4. Accent Color Interaction
  describe("4. Accent color interaction and swatch decoupling", () => {
    it("modifies only accent variables when selecting preset accent swatches while custom palette is active", () => {
      const { doc, properties, attributes } = createMockDocument();
      (globalThis as unknown as { document: typeof doc }).document = doc;

      const customCfg: CustomThemeColors = {
        background: "#080b11",
        surface: "#101622",
        foreground: "#f1f5f9",
        accent: "#38bdf8",
      };

      try {
        // Step 1: Activate custom theme with its custom accent
        applyColorTheme(CUSTOM_THEME_ID, null, customCfg);
        assert.equal(properties.get("--color-background"), "#080b11");
        assert.equal(properties.get("--color-card"), "#101622");
        assert.equal(properties.get("--color-accent"), "#38bdf8");
        assert.equal(attributes.get("data-theme"), "custom");
        assert.equal(attributes.get("data-accent"), "custom-accent");

        // Step 2: User selects "ochre-gold" swatch (#B98A3C) from Royal Luxury
        applyColorTheme(CUSTOM_THEME_ID, "ochre-gold", customCfg);
        // Canvas background and surface MUST remain intact
        assert.equal(properties.get("--color-background"), "#080b11");
        assert.equal(properties.get("--color-card"), "#101622");
        assert.equal(properties.get("--color-foreground"), "#f1f5f9");
        // Accent variables MUST update to Ochre Gold
        assert.equal(properties.get("--color-accent"), "#B98A3C");
        assert.equal(properties.get("--color-primary"), "#B98A3C");
        assert.equal(properties.get("--color-ring"), "#B98A3C");
        assert.equal(attributes.get("data-accent"), "ochre-gold");
        assert.equal(attributes.get("data-theme"), "custom");

        // Step 3: User calls applyAccentColor("forest-mint") (#8EB69B) directly
        applyAccentColor("forest-mint");
        // Canvas background and card MUST remain intact
        assert.equal(properties.get("--color-background"), "#080b11");
        assert.equal(properties.get("--color-card"), "#101622");
        assert.equal(properties.get("--color-accent"), "#8EB69B");
        assert.equal(properties.get("--color-primary"), "#8EB69B");
        assert.equal(attributes.get("data-accent"), "forest-mint");

        // Step 4: Re-applying custom theme with null override restores custom accent
        applyColorTheme(CUSTOM_THEME_ID, null, customCfg);
        assert.equal(properties.get("--color-background"), "#080b11");
        assert.equal(properties.get("--color-card"), "#101622");
        assert.equal(properties.get("--color-accent"), "#38bdf8");
        assert.equal(attributes.get("data-accent"), "custom-accent");
      } finally {
        delete (globalThis as unknown as { document?: typeof doc }).document;
      }
    });

    it("allows switching back to default accent when switching between presets", () => {
      const { doc, properties, attributes } = createMockDocument();
      (globalThis as unknown as { document: typeof doc }).document = doc;

      try {
        // Soulful Elegance default accent is apache-gold (#D8BD71)
        applyColorTheme("soulful-elegance");
        assert.equal(properties.get("--color-accent"), "#D8BD71");
        assert.equal(attributes.get("data-accent"), "apache-gold");

        // Emerald Forest default accent is forest-mint (#8EB69B)
        applyColorTheme("emerald-forest");
        assert.equal(properties.get("--color-accent"), "#8EB69B");
        assert.equal(attributes.get("data-accent"), "forest-mint");

        // Minimalist Luxury default accent is burgundy-luxe (#6D001A)
        applyColorTheme("minimalist-luxury");
        assert.equal(properties.get("--color-accent"), "#6D001A");
        assert.equal(attributes.get("data-accent"), "burgundy-luxe");
      } finally {
        delete (globalThis as unknown as { document?: typeof doc }).document;
      }
    });
  });

  // 5. Invariant Checking & Immutability
  describe("5. Invariant checking and zero pollution", () => {
    it("guarantees COLOR_THEMES retains exact bit-for-bit hex codes across all presets", () => {
      assert.deepEqual(
        COLOR_THEMES,
        PRESET_SNAPSHOT,
        "COLOR_THEMES preset array was mutated or polluted by custom theme operations!",
      );
    });

    it("guarantees ACCENT_COLORS retains exact bit-for-bit values across all options", () => {
      assert.deepEqual(
        ACCENT_COLORS,
        ACCENT_SNAPSHOT,
        "ACCENT_COLORS array was mutated or polluted!",
      );
    });

    it("guarantees getThemeById maintains deterministic fallback invariants", () => {
      const badInputs = [null, undefined, "", "undefined", "null", "NaN", "invalid_id_xyz", 123 as unknown as string];
      for (const input of badInputs) {
        const theme = getThemeById(input);
        assert.equal(theme.id, DEFAULT_COLOR_THEME, `Failed fallback for input: ${input}`);
        assert.equal(theme.name, "Cinematic Red");
        assert.equal(theme.colors.background, "#000000");
      }
    });

    it("guarantees getAccentById maintains deterministic fallback invariants", () => {
      const badInputs = [null, undefined, "", "unknown_accent", {} as unknown as string];
      for (const input of badInputs) {
        const accent = getAccentById(input);
        assert.equal(accent.id, DEFAULT_ACCENT_COLOR, `Failed accent fallback for input: ${input}`);
        assert.equal(accent.value, "#e50914");
      }
    });

    it("handles corrupted, malformed, or hostile localStorage payloads gracefully", () => {
      const mockStorage = createMockLocalStorage();
      (globalThis as unknown as { window: { localStorage: typeof mockStorage } }).window = {
        localStorage: mockStorage,
      };

      try {
        const hostilePayloads = [
          "not a json string {{{",
          "null",
          "12345",
          '"just a string"',
          "[]",
          JSON.stringify({ maliciousKey: "<script>alert(1)</script>" }),
        ];

        for (const bad of hostilePayloads) {
          mockStorage.setItem(CUSTOM_THEME_STORAGE_KEY, bad);
          const retrieved = getCustomThemeColors();
          assert.equal(
            retrieved.background,
            DEFAULT_CUSTOM_THEME_COLORS.background,
            `Did not safely fall back for bad localStorage payload: ${bad}`,
          );
        }
      } finally {
        delete (globalThis as unknown as { window?: unknown }).window;
      }
    });

    it("verifies desk data state defaults and custom theme validation", () => {
      const initial = createInitialState();
      assert.equal(initial.themeId, "cinema");
      assert.equal(initial.accentColor, "cinema");

      const reset = createResetState();
      assert.equal(reset.themeId, "cinema");
      assert.equal(reset.accentColor, "cinema");

      const deskDataWithCustom: DeskData = {
        ...initial,
        themeId: "custom",
        customThemeColors: {
          background: "#0a0d14",
          surface: "#141824",
          foreground: "#f8fafc",
          accent: "#22c55e",
        },
      };

      assert.equal(validateDeskDataCustomTheme(deskDataWithCustom), true);

      const invalidCustom = {
        ...initial,
        customThemeColors: "invalid_string_not_object",
      };
      assert.equal(validateDeskDataCustomTheme(invalidCustom), false);
    });
  });
});
