import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  FONT_STORAGE_KEY,
  CURATED_FONT_PAIRINGS,
  FONT_THEMES,
  DEFAULT_FONT_THEME,
  DYNAMIC_FONT_LINK_ID,
  PREVIEW_PACK_LINK_ID,
  CURATED_PREVIEW_FONTS_URL,
  applyFontTheme,
  resetFontTheme,
  loadFontPreviewStylesheet,
  getFontThemeById,
  type FontTheme,
  type FontThemeOption,
} from "../../src/lib/font-themes.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function createMockBrowserEnvironment() {
  const styles = new Map<string, string>();
  const headElements = new Map<string, any>();
  const headChildren: any[] = [];
  const localStorageStore = new Map<string, string>();

  const doc = {
    documentElement: {
      style: {
        setProperty: (prop: string, val: string) => {
          styles.set(prop, val);
        },
        removeProperty: (prop: string) => {
          styles.delete(prop);
        },
        getPropertyValue: (prop: string) => styles.get(prop) ?? "",
      },
    },
    head: {
      appendChild: (el: any) => {
        headChildren.push(el);
        if (el.id) headElements.set(el.id, el);
      },
    },
    getElementById: (id: string) => headElements.get(id) ?? null,
    createElement: (tag: string) => {
      const el = {
        tagName: tag.toUpperCase(),
        id: "",
        rel: "",
        href: "",
        remove: () => {
          if (el.id) headElements.delete(el.id);
          const idx = headChildren.indexOf(el);
          if (idx !== -1) headChildren.splice(idx, 1);
        },
        parentNode: {
          removeChild: (child: any) => {
            if (child.id) headElements.delete(child.id);
            const idx = headChildren.indexOf(child);
            if (idx !== -1) headChildren.splice(idx, 1);
          },
        },
      };
      return el;
    },
  };

  const localStore = {
    getItem: (key: string) => localStorageStore.get(key) ?? null,
    setItem: (key: string, val: string) => {
      localStorageStore.set(key, String(val));
    },
    removeItem: (key: string) => {
      localStorageStore.delete(key);
    },
    clear: () => {
      localStorageStore.clear();
    },
  };

  return {
    doc,
    styles,
    headElements,
    headChildren,
    localStore,
    localStorageStore,
  };
}

describe("E2E Integration: Milestone 1 Curated Font Pairings & Persistence", () => {
  describe("1. Curated Font Pairings Catalog & Contract Integrity", () => {
    it("contains all 8 curated font pairings with correct numbers and IDs", () => {
      assert.equal(CURATED_FONT_PAIRINGS.length, 8, "Must contain exactly 8 curated pairings");

      const expectedPairings = [
        { num: "01", id: "gibson-gotham", displaySub: "Pinyon Script", sansSub: "Montserrat" },
        { num: "02", id: "playfair-montserrat", displaySub: "Playfair Display", sansSub: "Montserrat" },
        { num: "03", id: "bloom-avenir", displaySub: "Birthstone Bounce", sansSub: "Nunito Sans" },
        { num: "04", id: "museo-average", displaySub: "Albert Sans", sansSub: "Average" },
        { num: "05", id: "caslon-oswald", displaySub: "Caslon", sansSub: "Oswald" },
        { num: "06", id: "playlist-georgia", displaySub: "Caveat", sansSub: "Georgia" },
        { num: "07", id: "bodoni-barlow", displaySub: "Bodoni", sansSub: "Barlow Condensed" },
        { num: "08", id: "quicksand-crimson", displaySub: "Quicksand", sansSub: "Crimson" },
      ];

      expectedPairings.forEach((exp) => {
        const p = CURATED_FONT_PAIRINGS.find((item) => item.number === exp.num);
        assert.ok(p, `Pairing ${exp.num} must exist`);
        assert.equal(p.id, exp.id);
        assert.equal(p.isCurated, true);
        assert.ok(p.display.includes(exp.displaySub), `Display font for ${exp.num} must include ${exp.displaySub}`);
        assert.ok(p.sans.includes(exp.sansSub), `Sans font for ${exp.num} must include ${exp.sansSub}`);
        assert.ok(p.badge.startsWith(exp.num), `Badge for ${exp.num} must start with ${exp.num}`);
        assert.ok(p.googleFontsUrl, `Pairing ${exp.num} must have a googleFontsUrl`);
      });
    });

    it("ensures FONT_THEMES includes both curated pairings and terminal fonts", () => {
      assert.ok(FONT_THEMES.length >= 13, "FONT_THEMES must contain curated and terminal fonts");
      CURATED_FONT_PAIRINGS.forEach((curated) => {
        const found = FONT_THEMES.find((t) => t.id === curated.id);
        assert.ok(found, `FONT_THEMES must contain ${curated.id}`);
      });
      assert.equal(DEFAULT_FONT_THEME, "default");
    });
  });

  describe("2. Settings Sheet UI Source Verification", () => {
    it("verifies settings-sheet.tsx integrates curated pairings and safe default logic", () => {
      const settingsSheetPath = join(__dirname, "../../src/components/desk/settings-sheet.tsx");
      assert.ok(existsSync(settingsSheetPath), "settings-sheet.tsx must exist");
      const content = readFileSync(settingsSheetPath, "utf-8");

      // Verify imports
      assert.ok(content.includes("CURATED_FONT_PAIRINGS"), "Must import CURATED_FONT_PAIRINGS");
      assert.ok(content.includes("resetFontTheme"), "Must import resetFontTheme");
      assert.ok(content.includes("loadFontPreviewStylesheet"), "Must import loadFontPreviewStylesheet");

      // Verify Default Typography card
      assert.ok(content.includes("Default Typography"), "Must render Default Typography option");
      assert.ok(content.includes("TradeZella System"), "Must display TradeZella System badge");

      // Verify dual preview rendering
      assert.ok(content.includes("Heading:"), "Must display Heading indicator in dual preview");
      assert.ok(content.includes("Body:"), "Must display Body indicator in dual preview");

      // Verify open trigger for preview loading
      assert.ok(content.includes("loadFontPreviewStylesheet()"), "Must call loadFontPreviewStylesheet on drawer open");

      // Verify desk reset removes font storage key and calls resetFontTheme
      assert.ok(content.includes("window.localStorage.removeItem(FONT_STORAGE_KEY)"), "handleReset must remove FONT_STORAGE_KEY");
      assert.ok(content.includes("resetFontTheme()"), "handleReset must call resetFontTheme()");
    });
  });

  describe("3. Typography Application & Dynamic Stylesheet Invariants", () => {
    it("preserves default styles when no font is selected or when reset", () => {
      const env = createMockBrowserEnvironment();
      (globalThis as any).document = env.doc;

      try {
        // Initial state: nothing applied
        assert.equal(env.styles.size, 0);
        assert.equal(env.headElements.size, 0);

        // Apply default explicitly
        applyFontTheme("default");
        assert.equal(env.styles.has("--font-display"), false);
        assert.equal(env.styles.has("--font-sans"), false);
        assert.equal(env.headElements.has(DYNAMIC_FONT_LINK_ID), false);

        // Apply null
        applyFontTheme(null);
        assert.equal(env.styles.has("--font-display"), false);
        assert.equal(env.styles.has("--font-sans"), false);
        assert.equal(env.headElements.has(DYNAMIC_FONT_LINK_ID), false);
      } finally {
        delete (globalThis as any).document;
      }
    });

    it("applies each of the 8 curated font pairings dynamically", () => {
      const env = createMockBrowserEnvironment();
      (globalThis as any).document = env.doc;

      try {
        for (const pairing of CURATED_FONT_PAIRINGS) {
          applyFontTheme(pairing.id as FontTheme);

          // Verify CSS variables set on documentElement
          assert.equal(env.styles.get("--font-display"), pairing.display);
          assert.equal(env.styles.get("--font-sans"), pairing.sans);

          // Verify link tag
          const link = env.headElements.get(DYNAMIC_FONT_LINK_ID);
          assert.ok(link, `Dynamic link must exist for ${pairing.id}`);
          assert.equal(link.rel, "stylesheet");
          assert.equal(link.href, pairing.googleFontsUrl);

          // Verify single link tag maintained (no tag pollution)
          assert.equal(env.headChildren.filter((el) => el.id === DYNAMIC_FONT_LINK_ID).length, 1);
        }
      } finally {
        delete (globalThis as any).document;
      }
    });

    it("preloads font preview stylesheet idempotently", () => {
      const env = createMockBrowserEnvironment();
      (globalThis as any).document = env.doc;

      try {
        loadFontPreviewStylesheet();
        const preview = env.headElements.get(PREVIEW_PACK_LINK_ID);
        assert.ok(preview, "Preview pack link must be added");
        assert.equal(preview.href, CURATED_PREVIEW_FONTS_URL);
        assert.equal(env.headChildren.length, 1);

        // Second call must not duplicate
        loadFontPreviewStylesheet();
        assert.equal(env.headChildren.length, 1);
      } finally {
        delete (globalThis as any).document;
      }
    });
  });

  describe("4. End-to-End Persistence & Desk Hydration Lifecycle", () => {
    it("simulates full user lifecycle: selection -> persistence -> reload -> reset", () => {
      const env = createMockBrowserEnvironment();
      (globalThis as any).document = env.doc;
      (globalThis as any).window = { localStorage: env.localStore };

      try {
        // Step A: First visit (no stored font preference)
        const initialSaved = env.localStore.getItem(FONT_STORAGE_KEY);
        assert.equal(initialSaved, null, "Fresh session starts with no stored font");

        // Hydration simulation matching desk-provider.tsx:
        if (initialSaved) {
          applyFontTheme(initialSaved as FontTheme);
        }
        // Base typography untouched
        assert.equal(env.styles.has("--font-display"), false);
        assert.equal(env.styles.has("--font-sans"), false);

        // Step B: User opens settings and selects 02 Playfair Display & Montserrat
        const chosenId = "playfair-montserrat";
        applyFontTheme(chosenId);
        env.localStore.setItem(FONT_STORAGE_KEY, chosenId);

        assert.equal(env.localStore.getItem(FONT_STORAGE_KEY), chosenId);
        assert.ok(env.styles.get("--font-display")?.includes("Playfair Display"));
        assert.ok(env.styles.get("--font-sans")?.includes("Montserrat"));

        // Step C: User refreshes page (App re-mounts / DeskProvider hydrates)
        // Reset in-memory DOM styles
        env.styles.clear();
        env.headElements.clear();
        env.headChildren.length = 0;

        const rehydratedFont = env.localStore.getItem(FONT_STORAGE_KEY);
        assert.equal(rehydratedFont, chosenId, "Persisted font must survive reload");
        if (rehydratedFont && rehydratedFont !== "default") {
          applyFontTheme(rehydratedFont as FontTheme);
        }

        assert.ok(env.styles.get("--font-display")?.includes("Playfair Display"));
        assert.ok(env.styles.get("--font-sans")?.includes("Montserrat"));
        assert.ok(env.headElements.has(DYNAMIC_FONT_LINK_ID));

        // Step D: User switches to 07 Bodoni & Barlow Condensed
        const nextId = "bodoni-barlow";
        applyFontTheme(nextId);
        env.localStore.setItem(FONT_STORAGE_KEY, nextId);

        assert.equal(env.localStore.getItem(FONT_STORAGE_KEY), nextId);
        assert.ok(env.styles.get("--font-display")?.includes("Bodoni"));
        assert.ok(env.styles.get("--font-sans")?.includes("Barlow Condensed"));

        // Step E: User resets desk settings to default
        env.localStore.removeItem(FONT_STORAGE_KEY);
        resetFontTheme();

        assert.equal(env.localStore.getItem(FONT_STORAGE_KEY), null);
        assert.equal(env.styles.has("--font-display"), false, "Display font override must be cleared");
        assert.equal(env.styles.has("--font-sans"), false, "Sans font override must be cleared");
        assert.equal(env.headElements.has(DYNAMIC_FONT_LINK_ID), false, "Dynamic font link must be removed");

        // Step F: Next reload after reset keeps system default
        const postResetSaved = env.localStore.getItem(FONT_STORAGE_KEY);
        assert.equal(postResetSaved, null);
        if (postResetSaved) {
          applyFontTheme(postResetSaved as FontTheme);
        }
        assert.equal(env.styles.has("--font-display"), false);
      } finally {
        delete (globalThis as any).document;
        delete (globalThis as any).window;
      }
    });

    it("verifies switching back to Default Typography clears storage and styles", () => {
      const env = createMockBrowserEnvironment();
      (globalThis as any).document = env.doc;
      (globalThis as any).window = { localStorage: env.localStore };

      try {
        // User selects pairing 08
        env.localStore.setItem(FONT_STORAGE_KEY, "quicksand-crimson");
        applyFontTheme("quicksand-crimson");
        assert.ok(env.styles.has("--font-display"));

        // User clicks "Default Typography" card in SettingsSheet
        // handleFontThemeChange("default") executes:
        resetFontTheme();
        env.localStore.removeItem(FONT_STORAGE_KEY);

        assert.equal(env.localStore.getItem(FONT_STORAGE_KEY), null);
        assert.equal(env.styles.has("--font-display"), false);
        assert.equal(env.styles.has("--font-sans"), false);
        assert.equal(env.headElements.has(DYNAMIC_FONT_LINK_ID), false);
      } finally {
        delete (globalThis as any).document;
        delete (globalThis as any).window;
      }
    });
  });

  describe("5. SSR & Robustness Invariants", () => {
    it("safely handles non-browser SSR execution without throwing", () => {
      assert.equal(typeof (globalThis as any).document, "undefined");
      assert.doesNotThrow(() => {
        applyFontTheme("caslon-oswald");
        applyFontTheme("default");
        resetFontTheme();
        loadFontPreviewStylesheet();
      });
    });

    it("safely returns undefined for getFontThemeById on default or unknown", () => {
      assert.equal(getFontThemeById("default"), undefined);
      assert.equal(getFontThemeById(null), undefined);
      assert.equal(getFontThemeById(undefined), undefined);
      assert.equal(getFontThemeById("invalid-font"), undefined);

      const found = getFontThemeById("playfair-montserrat");
      assert.ok(found);
      assert.equal(found.id, "playfair-montserrat");
    });
  });
});
