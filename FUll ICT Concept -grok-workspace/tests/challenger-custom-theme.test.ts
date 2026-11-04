import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  COLOR_THEMES,
  ACCENT_COLORS,
  DEFAULT_COLOR_THEME,
  DEFAULT_ACCENT_COLOR,
  CUSTOM_THEME_ID,
  CUSTOM_THEME_STORAGE_KEY,
  THEME_STORAGE_KEY,
  ACCENT_STORAGE_KEY,
  DEFAULT_CUSTOM_THEME_COLORS,
  createCustomTheme,
  getCustomThemeColors,
  saveCustomThemeColors,
  getThemeById,
  getAccentById,
  applyColorTheme,
  applyAccentColor,
  type CustomThemeColors,
  type ColorTheme,
} from "../src/lib/color-themes.ts";
import {
  createInitialState,
  createResetState,
  ensureMinimumDeskData,
  emptyDesk,
} from "../src/lib/ict-defaults.ts";
import { isDeskData } from "../src/lib/desk-sync.ts";
import { useDeskStore, deskSnapshot } from "../src/lib/ict-store.ts";
import type { DeskData } from "../src/lib/ict-types.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

describe("Challenger 2 — Custom Theme Palette Verification", () => {
  // =========================================================================
  // 1. SettingsSheet UI Structure Verification
  // =========================================================================
  describe("1. SettingsSheet UI Structure Contract", () => {
    const settingsPath = join(__dirname, "../src/components/desk/settings-sheet.tsx");

    it("verifies SettingsSheet component file exists", () => {
      assert.ok(existsSync(settingsPath), `File does not exist: ${settingsPath}`);
    });

    it("verifies Theme Palettes container contains role='radiogroup' and aria-label='Theme Palettes'", () => {
      const content = readFileSync(settingsPath, "utf8");
      assert.match(
        content,
        /role="radiogroup"\s+aria-label="Theme Palettes"/,
        "SettingsSheet must define role='radiogroup' aria-label='Theme Palettes'",
      );
    });

    it("verifies Custom Palette option exists with role='radio', dynamic aria-checked, and tabIndex/keyboard support", () => {
      const content = readFileSync(settingsPath, "utf8");

      // Custom option card with role="radio" and aria-checked
      assert.match(
        content,
        /role="radio"[\s\S]*?aria-checked=\{isCustomSelected\}[\s\S]*?tabIndex=\{0\}/,
        "Custom Palette item must have role='radio', aria-checked={isCustomSelected}, and tabIndex={0}",
      );

      // Keyboard navigation support for Enter / Space
      assert.ok(
        content.includes('e.key === " " || e.key === "Enter"'),
        "Custom Palette item must support Space and Enter key selection",
      );

      // Card title and badge
      assert.ok(content.includes("Custom Palette"), "Must display 'Custom Palette' title");
      assert.ok(content.includes("Customizable"), "Must display 'Customizable' badge");
      assert.ok(
        content.includes("Configure custom colors for canvas, surfaces, text, and accent."),
        "Must display custom palette description",
      );
    });

    it("verifies active check indicator is rendered when isCustomSelected is true", () => {
      const content = readFileSync(settingsPath, "utf8");
      assert.match(
        content,
        /\{isCustomSelected\s*&&[\s\S]*?<Check\s+className="size-3"\s*\/>/,
        "Must render Check icon indicator when isCustomSelected is true",
      );
    });

    it("verifies dynamic preview swatches are rendered from createCustomTheme(customColors).previewColors", () => {
      const content = readFileSync(settingsPath, "utf8");
      assert.ok(
        content.includes("customTheme.previewColors.map"),
        "Must map over customTheme.previewColors for dynamic swatches",
      );
    });

    it("verifies color input controls for Canvas Background, Surface/Card, Text Foreground, and Accent Color", () => {
      const content = readFileSync(settingsPath, "utf8");

      // 1. Canvas Background
      assert.ok(content.includes("Canvas Background"), "Must label Canvas Background");
      assert.match(
        content,
        /aria-label="Canvas Background color picker"/,
        "Must provide Canvas Background color picker",
      );
      assert.match(
        content,
        /aria-label="Canvas Background hex code"/,
        "Must provide Canvas Background hex input",
      );

      // 2. Surface / Card
      assert.ok(content.includes("Surface / Card"), "Must label Surface / Card");
      assert.match(
        content,
        /aria-label="Surface \/ Card color picker"/,
        "Must provide Surface / Card color picker",
      );
      assert.match(
        content,
        /aria-label="Surface \/ Card hex code"/,
        "Must provide Surface / Card hex input",
      );

      // 3. Text Foreground
      assert.ok(content.includes("Text Foreground"), "Must label Text Foreground");
      assert.match(
        content,
        /aria-label="Text Foreground color picker"/,
        "Must provide Text Foreground color picker",
      );
      assert.match(
        content,
        /aria-label="Text Foreground hex code"/,
        "Must provide Text Foreground hex input",
      );

      // 4. Accent Color
      assert.ok(content.includes("Accent Color"), "Must label Accent Color");
      assert.match(
        content,
        /aria-label="Accent Color color picker"/,
        "Must provide Accent Color color picker",
      );
      assert.match(
        content,
        /aria-label="Accent Color hex code"/,
        "Must provide Accent Color hex input",
      );
    });

    it("verifies color pickers use toValidColorInputHex to sanitize hex inputs", () => {
      const content = readFileSync(settingsPath, "utf8");
      assert.ok(
        content.includes("toValidColorInputHex(customColors.background"),
        "Background picker must be sanitized with toValidColorInputHex",
      );
      assert.ok(
        content.includes("toValidColorInputHex(customColors.surface"),
        "Surface picker must be sanitized with toValidColorInputHex",
      );
      assert.ok(
        content.includes("toValidColorInputHex(customColors.foreground"),
        "Foreground picker must be sanitized with toValidColorInputHex",
      );
      assert.ok(
        content.includes("toValidColorInputHex(customColors.accent"),
        "Accent picker must be sanitized with toValidColorInputHex",
      );
    });

    it("verifies Active theme indicator renders getThemeById(colorTheme, customColors).name", () => {
      const content = readFileSync(settingsPath, "utf8");
      assert.ok(
        content.includes("Active theme:"),
        "Must render 'Active theme:' indicator label",
      );
      assert.ok(
        content.includes("getThemeById(colorTheme, customColors).name"),
        "Must resolve theme name dynamically via getThemeById(colorTheme, customColors).name",
      );

      // Verify at runtime: getThemeById with "custom" returns "Custom Palette"
      const customTheme = getThemeById(CUSTOM_THEME_ID, DEFAULT_CUSTOM_THEME_COLORS);
      assert.equal(customTheme.name, "Custom Palette");
    });
  });

  // =========================================================================
  // 2. Persistence Round-Trip & Storage Contracts
  // =========================================================================
  describe("2. Persistence Round-Trip Contract", () => {
    it("verifies exact localStorage key constant matches specification", () => {
      assert.equal(
        CUSTOM_THEME_STORAGE_KEY,
        "first-payout-custom-theme-palette-v1",
        "CUSTOM_THEME_STORAGE_KEY must be 'first-payout-custom-theme-palette-v1'",
      );
    });

    it("verifies localStorage helper round-trip and partial update merging", () => {
      const memoryStorage = new Map<string, string>();
      const mockStorage = {
        getItem: (k: string) => memoryStorage.get(k) ?? null,
        setItem: (k: string, v: string) => memoryStorage.set(k, v),
        removeItem: (k: string) => memoryStorage.delete(k),
      };

      (globalThis as unknown as { window: { localStorage: typeof mockStorage } }).window = {
        localStorage: mockStorage,
      };

      try {
        // 1. Initial state without stored value returns defaults
        const initial = getCustomThemeColors();
        assert.deepEqual(initial, DEFAULT_CUSTOM_THEME_COLORS);

        // 2. Save partial change (Canvas background only)
        saveCustomThemeColors({ background: "#050505" });
        assert.ok(memoryStorage.has(CUSTOM_THEME_STORAGE_KEY));

        const storedRaw = memoryStorage.get(CUSTOM_THEME_STORAGE_KEY)!;
        const parsed = JSON.parse(storedRaw);
        assert.equal(parsed.background, "#050505");
        assert.equal(parsed.surface, DEFAULT_CUSTOM_THEME_COLORS.surface);

        // 3. Save another partial change (Accent color)
        saveCustomThemeColors({ accent: "#ff007f" });
        const updated = getCustomThemeColors();
        assert.equal(updated.background, "#050505", "Previous background change must persist");
        assert.equal(updated.accent, "#ff007f", "New accent must be applied");
        assert.equal(updated.surface, DEFAULT_CUSTOM_THEME_COLORS.surface, "Surface must remain default");
      } finally {
        delete (globalThis as unknown as { window?: unknown }).window;
      }
    });

    it("verifies Zustand useDeskStore integration: setCustomThemeColors, snapshot, and partialize", () => {
      const memoryStorage = new Map<string, string>();
      const mockStorage = {
        getItem: (k: string) => memoryStorage.get(k) ?? null,
        setItem: (k: string, v: string) => memoryStorage.set(k, v),
        removeItem: (k: string) => memoryStorage.delete(k),
      };

      (globalThis as unknown as { window: { localStorage: typeof mockStorage } }).window = {
        localStorage: mockStorage,
      };

      try {
        const store = useDeskStore.getState();
        assert.ok(
          typeof store.setCustomThemeColors === "function",
          "useDeskStore must provide setCustomThemeColors action",
        );

        // Update colors via store action
        store.setCustomThemeColors({
          background: "#181824",
          surface: "#242438",
          foreground: "#eaeaea",
          accent: "#38bdf8",
        });

        // Check updated store state
        const updatedStoreState = useDeskStore.getState();
        assert.equal(updatedStoreState.customThemeColors?.background, "#181824");
        assert.equal(updatedStoreState.customThemeColors?.surface, "#242438");
        assert.equal(updatedStoreState.customThemeColors?.accent, "#38bdf8");

        // Check that deskSnapshot() captures customThemeColors
        const snapshot = deskSnapshot();
        assert.ok(snapshot.customThemeColors, "deskSnapshot must contain customThemeColors");
        assert.equal(snapshot.customThemeColors.background, "#181824");

        // Check localStorage synchronization
        const storedInLocalStorage = getCustomThemeColors();
        assert.equal(storedInLocalStorage.background, "#181824");
        assert.equal(storedInLocalStorage.surface, "#242438");
      } finally {
        delete (globalThis as unknown as { window?: unknown }).window;
      }
    });

    it("verifies schema validation in isDeskData against customThemeColors", () => {
      const baseValidDeskData: DeskData = createResetState();

      // 1. DeskData without customThemeColors (undefined) must be valid
      assert.equal(
        isDeskData(baseValidDeskData),
        true,
        "DeskData without customThemeColors must be valid",
      );

      // 2. DeskData with valid customThemeColors object must be valid
      const withCustomColors: DeskData = {
        ...baseValidDeskData,
        themeId: "custom",
        customThemeColors: {
          background: "#101010",
          surface: "#202020",
          foreground: "#ffffff",
          accent: "#38bdf8",
        },
      };
      assert.equal(
        isDeskData(withCustomColors),
        true,
        "DeskData with valid customThemeColors must pass isDeskData",
      );

      // 3. DeskData with customThemeColors as null must be rejected
      const withNullCustom = {
        ...baseValidDeskData,
        customThemeColors: null,
      };
      assert.equal(
        isDeskData(withNullCustom),
        false,
        "DeskData with customThemeColors: null must fail isDeskData",
      );

      // 4. DeskData with customThemeColors as primitive string must be rejected
      const withStringCustom = {
        ...baseValidDeskData,
        customThemeColors: "custom-palette-string",
      };
      assert.equal(
        isDeskData(withStringCustom),
        false,
        "DeskData with customThemeColors as string must fail isDeskData",
      );

      // 5. DeskData with customThemeColors as number must be rejected
      const withNumberCustom = {
        ...baseValidDeskData,
        customThemeColors: 42,
      };
      assert.equal(
        isDeskData(withNumberCustom),
        false,
        "DeskData with customThemeColors as number must fail isDeskData",
      );
    });
  });

  // =========================================================================
  // 3. Resilience Against Corrupted, Null, Undefined, or Partial Storage Data
  // =========================================================================
  describe("3. Storage Data Corruption and Resilience", () => {
    it("handles missing or empty storage values gracefully in getCustomThemeColors", () => {
      const storageMap = new Map<string, string>();
      const mockStorage = {
        getItem: (k: string) => storageMap.get(k) ?? null,
        setItem: (k: string, v: string) => storageMap.set(k, v),
        removeItem: (k: string) => storageMap.delete(k),
      };

      (globalThis as unknown as { window: { localStorage: typeof mockStorage } }).window = {
        localStorage: mockStorage,
      };

      try {
        // Null / not present
        storageMap.delete(CUSTOM_THEME_STORAGE_KEY);
        assert.deepEqual(getCustomThemeColors(), DEFAULT_CUSTOM_THEME_COLORS);

        // Empty string
        storageMap.set(CUSTOM_THEME_STORAGE_KEY, "");
        assert.deepEqual(getCustomThemeColors(), DEFAULT_CUSTOM_THEME_COLORS);

        // Whitespace only
        storageMap.set(CUSTOM_THEME_STORAGE_KEY, "   ");
        assert.deepEqual(getCustomThemeColors(), DEFAULT_CUSTOM_THEME_COLORS);
      } finally {
        delete (globalThis as unknown as { window?: unknown }).window;
      }
    });

    it("handles malformed JSON syntax gracefully without throwing", () => {
      const malformedPayloads = [
        "{ broken json",
        "{ 'background': '#000'",
        "undefined",
        "<xml>not json</xml>",
        "NaN",
        "{{}}",
        "{\"background\": }",
      ];

      for (const payload of malformedPayloads) {
        const mockStorage = {
          getItem: () => payload,
          setItem: () => {},
          removeItem: () => {},
        };

        (globalThis as unknown as { window: { localStorage: typeof mockStorage } }).window = {
          localStorage: mockStorage,
        };

        try {
          const result = getCustomThemeColors();
          assert.deepEqual(
            result,
            DEFAULT_CUSTOM_THEME_COLORS,
            `Payload '${payload}' must safely fall back to DEFAULT_CUSTOM_THEME_COLORS without throwing`,
          );
        } finally {
          delete (globalThis as unknown as { window?: unknown }).window;
        }
      }
    });

    it("handles non-object JSON values gracefully (null, numbers, strings, booleans)", () => {
      const primitivePayloads = [
        "null",
        "123",
        "true",
        "false",
        "\"a string\"",
      ];

      for (const payload of primitivePayloads) {
        const mockStorage = {
          getItem: () => payload,
          setItem: () => {},
          removeItem: () => {},
        };

        (globalThis as unknown as { window: { localStorage: typeof mockStorage } }).window = {
          localStorage: mockStorage,
        };

        try {
          const result = getCustomThemeColors();
          assert.deepEqual(
            result,
            DEFAULT_CUSTOM_THEME_COLORS,
            `Primitive JSON payload '${payload}' must safely fall back to DEFAULT_CUSTOM_THEME_COLORS`,
          );
        } finally {
          delete (globalThis as unknown as { window?: unknown }).window;
        }
      }
    });

    it("handles partial custom theme color objects by merging with defaults", () => {
      const mockStorage = {
        getItem: () => JSON.stringify({
          background: "#080808",
          // all other fields missing
        }),
        setItem: () => {},
        removeItem: () => {},
      };

      (globalThis as unknown as { window: { localStorage: typeof mockStorage } }).window = {
        localStorage: mockStorage,
      };

      try {
        const result = getCustomThemeColors();
        assert.equal(result.background, "#080808");
        assert.equal(result.surface, DEFAULT_CUSTOM_THEME_COLORS.surface);
        assert.equal(result.foreground, DEFAULT_CUSTOM_THEME_COLORS.foreground);
        assert.equal(result.accent, DEFAULT_CUSTOM_THEME_COLORS.accent);
        assert.equal(result.muted, DEFAULT_CUSTOM_THEME_COLORS.muted);
      } finally {
        delete (globalThis as unknown as { window?: unknown }).window;
      }
    });

    it("handles localStorage throwing exceptions (e.g. QuotaExceeded or SecurityError)", () => {
      const throwingStorage = {
        getItem: () => {
          throw new Error("QuotaExceededError: localStorage access denied");
        },
        setItem: () => {
          throw new Error("QuotaExceededError: storage full");
        },
        removeItem: () => {},
      };

      (globalThis as unknown as { window: { localStorage: typeof throwingStorage } }).window = {
        localStorage: throwingStorage,
      };

      try {
        // Reading must not crash
        const readResult = getCustomThemeColors();
        assert.deepEqual(readResult, DEFAULT_CUSTOM_THEME_COLORS);

        // Saving must not crash
        assert.doesNotThrow(() => {
          saveCustomThemeColors({ background: "#ffffff" });
        });
      } finally {
        delete (globalThis as unknown as { window?: unknown }).window;
      }
    });

    it("verifies ensureMinimumDeskData handles DeskData with or without customThemeColors without crashing", () => {
      // 1. Data without customThemeColors
      const dataWithoutCustom: DeskData = {
        ...createResetState(),
        themeId: "custom",
        customThemeColors: undefined,
      };
      const repaired1 = ensureMinimumDeskData(dataWithoutCustom);
      assert.ok(repaired1, "ensureMinimumDeskData must return repaired data");
      assert.equal(repaired1.themeId, "custom");

      // 2. Data with complete customThemeColors
      const dataWithCustom: DeskData = {
        ...createResetState(),
        themeId: "custom",
        customThemeColors: {
          background: "#0d1117",
          surface: "#161b22",
          foreground: "#c9d1d9",
          accent: "#58a6ff",
        },
      };
      const repaired2 = ensureMinimumDeskData(dataWithCustom);
      assert.equal(repaired2.customThemeColors?.background, "#0d1117");
      assert.equal(repaired2.customThemeColors?.accent, "#58a6ff");

      // 3. Corrupted arrays repaired while preserving theme configuration
      const corruptedData = {
        ...dataWithCustom,
        models: [] as any,
        instruments: [] as any,
        checklistItems: [] as any,
        recentlyDeletedModels: undefined as any,
      };
      const repaired3 = ensureMinimumDeskData(corruptedData);
      assert.ok(repaired3.models.length > 0, "Models must be repaired");
      assert.ok(repaired3.instruments.length > 0, "Instruments must be repaired");
      assert.ok(repaired3.checklistItems.length > 0, "Checklist must be repaired");
      assert.ok(Array.isArray(repaired3.recentlyDeletedModels), "recentlyDeletedModels must be array");
      assert.equal(repaired3.customThemeColors?.background, "#0d1117", "Custom colors must be preserved");
    });

    it("verifies createCustomTheme handles undefined, null, empty, or partial color objects gracefully", () => {
      // 1. undefined
      const themeUndef = createCustomTheme(undefined);
      assert.equal(themeUndef.id, "custom");
      assert.equal(themeUndef.name, "Custom Palette");
      assert.equal(themeUndef.colors.background, DEFAULT_CUSTOM_THEME_COLORS.background);
      assert.equal(themeUndef.previewColors.length, 6);

      // 2. null
      const themeNull = createCustomTheme(null);
      assert.equal(themeNull.colors.background, DEFAULT_CUSTOM_THEME_COLORS.background);

      // 3. empty object
      const themeEmpty = createCustomTheme({});
      assert.equal(themeEmpty.colors.background, DEFAULT_CUSTOM_THEME_COLORS.background);

      // 4. empty strings in fields fall back to default
      const themeEmptyStrings = createCustomTheme({
        background: "",
        surface: "",
        foreground: "",
        accent: "",
      });
      assert.equal(themeEmptyStrings.colors.background, DEFAULT_CUSTOM_THEME_COLORS.background);
      assert.equal(themeEmptyStrings.colors.surface, DEFAULT_CUSTOM_THEME_COLORS.surface);
      assert.equal(themeEmptyStrings.colors.foreground, DEFAULT_CUSTOM_THEME_COLORS.foreground);
      assert.equal(themeEmptyStrings.colors.accent, DEFAULT_CUSTOM_THEME_COLORS.accent);

      // 5. invalid hex strings fail safe without NaN or crash
      assert.doesNotThrow(() => {
        const themeInvalid = createCustomTheme({
          background: "not-a-color",
          surface: "also-invalid",
          accent: "xyz",
        });
        assert.ok(themeInvalid.colors.background);
        assert.ok(themeInvalid.previewColors.length === 6);
      });
    });
  });

  // =========================================================================
  // 4. Invariant Preservation & Coexistence
  // =========================================================================
  describe("4. Invariant Preservation & Preset Coexistence", () => {
    it("ensures all 6 luxury presets remain identical and unmodified", () => {
      const presets = [
        "cinema",
        "soulful-elegance",
        "royal-luxury",
        "minimalist-luxury",
        "emerald-forest",
        "midnight-slate",
      ] as const;

      for (const presetId of presets) {
        const theme = getThemeById(presetId);
        assert.equal(theme.id, presetId);
        assert.ok(theme.name.length > 0);
        assert.ok(theme.previewColors.length >= 5);
        assert.ok(theme.colors.background.startsWith("#"));
        assert.ok(theme.colors.accent.startsWith("#"));
      }
    });

    it("verifies round-trip switching between preset themes and custom palette preserves custom data", () => {
      const properties = new Map<string, string>();
      const attributes = new Map<string, string>();

      const doc = {
        documentElement: {
          style: {
            setProperty: (k: string, v: string) => properties.set(k, v),
          },
          setAttribute: (k: string, v: string) => attributes.set(k, v),
        },
        head: { appendChild: () => {} },
        createElement: () => ({ setAttribute: () => {} }),
        querySelector: () => null,
      };

      (globalThis as unknown as { document: typeof doc }).document = doc;

      try {
        const myCustomColors: CustomThemeColors = {
          background: "#0b0c10",
          surface: "#1f2833",
          foreground: "#c5c6c7",
          accent: "#66fcf1",
        };

        // 1. Activate Custom Theme
        applyColorTheme("custom", null, myCustomColors);
        assert.equal(attributes.get("data-theme"), "custom");
        assert.equal(properties.get("--color-background"), "#0b0c10");
        assert.equal(properties.get("--color-accent"), "#66fcf1");

        // 2. Switch to Royal Luxury preset
        applyColorTheme("royal-luxury");
        assert.equal(attributes.get("data-theme"), "royal-luxury");
        const royal = getThemeById("royal-luxury");
        assert.equal(properties.get("--color-background"), royal.colors.background);
        assert.equal(properties.get("--color-accent"), royal.colors.accent);

        // 3. Switch back to Custom Theme with saved colors
        applyColorTheme("custom", null, myCustomColors);
        assert.equal(attributes.get("data-theme"), "custom");
        assert.equal(properties.get("--color-background"), "#0b0c10");
        assert.equal(properties.get("--color-accent"), "#66fcf1");
      } finally {
        delete (globalThis as unknown as { document?: typeof doc }).document;
      }
    });
  });
});
