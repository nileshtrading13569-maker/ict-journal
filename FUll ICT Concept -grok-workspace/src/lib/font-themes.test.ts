import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FONT_STORAGE_KEY,
  CURATED_FONT_PAIRINGS,
  FONT_THEMES,
  applyFontTheme,
  resetFontTheme,
  loadFontPreviewStylesheet,
  CURATED_PREVIEW_FONTS_URL,
  type FontThemeOption,
} from "./font-themes.ts";

describe("Milestone 1: Curated Font Pairings & Typography Engine", () => {
  describe("Constant & Storage Key Contracts", () => {
    it("exports the exact FONT_STORAGE_KEY specified in interface contracts", () => {
      assert.equal(FONT_STORAGE_KEY, "first-payout-font-theme-v1");
    });

    it("exports CURATED_PREVIEW_FONTS_URL pointing to Google Fonts CSS2 API", () => {
      assert.ok(typeof CURATED_PREVIEW_FONTS_URL === "string");
      assert.ok(CURATED_PREVIEW_FONTS_URL.startsWith("https://fonts.googleapis.com/css2?"));
      assert.ok(CURATED_PREVIEW_FONTS_URL.includes("Playfair+Display"));
      assert.ok(CURATED_PREVIEW_FONTS_URL.includes("Montserrat"));
    });
  });

  describe("8 Curated Font Pairings Catalog (R1 Requirements)", () => {
    it("contains exactly 8 curated font pairings in CURATED_FONT_PAIRINGS", () => {
      assert.equal(CURATED_FONT_PAIRINGS.length, 8);
    });

    it("verifies pairing 01: Gibson / GOTHAM", () => {
      const p = CURATED_FONT_PAIRINGS.find((item) => item.number === "01");
      assert.ok(p, "Pairing 01 must exist");
      assert.equal(p.id, "gibson-gotham");
      assert.match(p.name, /Gibson/i);
      assert.match(p.name, /Gotham/i);
      assert.ok(p.display.includes("Pinyon Script") || p.display.includes("Alex Brush"));
      assert.ok(p.sans.includes("Montserrat") || p.sans.includes("Inter"));
      assert.ok(p.googleFontsUrl?.includes("Pinyon+Script"));
      assert.ok(p.googleFontsUrl?.includes("Montserrat"));
    });

    it("verifies pairing 02: Playfair Display / MONTSERRAT", () => {
      const p = CURATED_FONT_PAIRINGS.find((item) => item.number === "02");
      assert.ok(p, "Pairing 02 must exist");
      assert.equal(p.id, "playfair-montserrat");
      assert.match(p.name, /Playfair Display/i);
      assert.match(p.name, /Montserrat/i);
      assert.ok(p.display.includes("Playfair Display"));
      assert.ok(p.sans.includes("Montserrat"));
      assert.ok(p.googleFontsUrl?.includes("Playfair+Display"));
      assert.ok(p.googleFontsUrl?.includes("Montserrat"));
    });

    it("verifies pairing 03: Beautiful Bloom / AVENIR NEXT", () => {
      const p = CURATED_FONT_PAIRINGS.find((item) => item.number === "03");
      assert.ok(p, "Pairing 03 must exist");
      assert.equal(p.id, "bloom-avenir");
      assert.match(p.name, /Beautiful Bloom/i);
      assert.match(p.name, /Avenir Next/i);
      assert.ok(p.display.includes("Birthstone Bounce") || p.display.includes("Caveat"));
      assert.ok(p.sans.includes("Nunito Sans") || p.sans.includes("apple-system"));
      assert.ok(p.googleFontsUrl?.includes("Birthstone+Bounce"));
      assert.ok(p.googleFontsUrl?.includes("Nunito+Sans"));
    });

    it("verifies pairing 04: MUSEO SANS / average", () => {
      const p = CURATED_FONT_PAIRINGS.find((item) => item.number === "04");
      assert.ok(p, "Pairing 04 must exist");
      assert.equal(p.id, "museo-average");
      assert.match(p.name, /Museo Sans/i);
      assert.match(p.name, /Average/i);
      assert.ok(p.display.includes("Albert Sans") || p.display.includes("Plus Jakarta Sans"));
      assert.ok(p.sans.includes("Average"));
      assert.ok(p.googleFontsUrl?.includes("Albert+Sans"));
      assert.ok(p.googleFontsUrl?.includes("Average"));
    });

    it("verifies pairing 05: Big Caslon / OSWALD", () => {
      const p = CURATED_FONT_PAIRINGS.find((item) => item.number === "05");
      assert.ok(p, "Pairing 05 must exist");
      assert.equal(p.id, "caslon-oswald");
      assert.match(p.name, /Big Caslon/i);
      assert.match(p.name, /Oswald/i);
      assert.ok(p.display.includes("Caslon"));
      assert.ok(p.sans.includes("Oswald"));
      assert.ok(p.googleFontsUrl?.includes("Caslon"));
      assert.ok(p.googleFontsUrl?.includes("Oswald"));
    });

    it("verifies pairing 06: Playlist / GEORGIA", () => {
      const p = CURATED_FONT_PAIRINGS.find((item) => item.number === "06");
      assert.ok(p, "Pairing 06 must exist");
      assert.equal(p.id, "playlist-georgia");
      assert.match(p.name, /Playlist/i);
      assert.match(p.name, /Georgia/i);
      assert.ok(p.display.includes("Caveat") || p.display.includes("Playball"));
      assert.ok(p.sans.includes("Georgia"));
      assert.ok(p.googleFontsUrl?.includes("Caveat"));
    });

    it("verifies pairing 07: BODONI / BARLOW CONDENSED", () => {
      const p = CURATED_FONT_PAIRINGS.find((item) => item.number === "07");
      assert.ok(p, "Pairing 07 must exist");
      assert.equal(p.id, "bodoni-barlow");
      assert.match(p.name, /Bodoni/i);
      assert.match(p.name, /Barlow Condensed/i);
      assert.ok(p.display.includes("Bodoni"));
      assert.ok(p.sans.includes("Barlow Condensed"));
      assert.ok(p.googleFontsUrl?.includes("Bodoni"));
      assert.ok(p.googleFontsUrl?.includes("Barlow+Condensed"));
    });

    it("verifies pairing 08: Quicksand / CRIMSON", () => {
      const p = CURATED_FONT_PAIRINGS.find((item) => item.number === "08");
      assert.ok(p, "Pairing 08 must exist");
      assert.equal(p.id, "quicksand-crimson");
      assert.match(p.name, /Quicksand/i);
      assert.match(p.name, /Crimson/i);
      assert.ok(p.display.includes("Quicksand"));
      assert.ok(p.sans.includes("Crimson"));
      assert.ok(p.googleFontsUrl?.includes("Quicksand"));
      assert.ok(p.googleFontsUrl?.includes("Crimson"));
    });

    it("ensures each curated pairing has non-empty required UI fields", () => {
      for (const p of CURATED_FONT_PAIRINGS) {
        assert.ok(p.id && p.id.length > 0, `Pairing ${p.number} missing id`);
        assert.ok(p.name && p.name.length > 0, `Pairing ${p.id} missing name`);
        assert.ok(p.badge && p.badge.length > 0, `Pairing ${p.id} missing badge`);
        assert.ok(p.description && p.description.length > 0, `Pairing ${p.id} missing description`);
        assert.ok(p.display && p.display.length > 0, `Pairing ${p.id} missing display`);
        assert.ok(p.sans && p.sans.length > 0, `Pairing ${p.id} missing sans`);
      }
    });

    it("ensures FONT_THEMES contains all 8 curated pairings", () => {
      for (const p of CURATED_FONT_PAIRINGS) {
        const found = FONT_THEMES.find((t) => t.id === p.id);
        assert.ok(found, `FONT_THEMES must include curated theme ${p.id}`);
      }
    });
  });

  describe("Dynamic Typography Application & DOM Manipulation", () => {
    function createMockDocument() {
      const properties = new Map<string, string>();
      const elements = new Map<string, any>();
      const headChildren: any[] = [];

      const doc = {
        documentElement: {
          style: {
            setProperty: (key: string, val: string) => {
              properties.set(key, val);
            },
            removeProperty: (key: string) => {
              properties.delete(key);
            },
          },
        },
        head: {
          appendChild: (el: any) => {
            headChildren.push(el);
            if (el.id) elements.set(el.id, el);
          },
        },
        getElementById: (id: string) => {
          return elements.get(id) ?? null;
        },
        createElement: (tag: string) => {
          const el = {
            tagName: tag.toUpperCase(),
            id: "",
            rel: "",
            href: "",
            remove: () => {
              if (el.id) elements.delete(el.id);
              const idx = headChildren.indexOf(el);
              if (idx !== -1) headChildren.splice(idx, 1);
            },
          };
          return el;
        },
      };

      return { doc, properties, elements, headChildren };
    }

    it("applies --font-display, --font-sans, and injects dynamic stylesheet link", () => {
      const { doc, properties, elements } = createMockDocument();
      (globalThis as any).document = doc;

      try {
        applyFontTheme("playfair-montserrat");

        // Verify CSS properties set on documentElement
        assert.ok(properties.has("--font-display"));
        assert.ok(properties.get("--font-display")?.includes("Playfair Display"));
        assert.ok(properties.has("--font-sans"));
        assert.ok(properties.get("--font-sans")?.includes("Montserrat"));

        // Verify dynamic link element in head
        const linkEl = elements.get("dynamic-font-theme");
        assert.ok(linkEl, "<link id='dynamic-font-theme'> must be injected");
        assert.equal(linkEl.rel, "stylesheet");
        assert.ok(linkEl.href.includes("Playfair+Display"));
      } finally {
        delete (globalThis as any).document;
      }
    });

    it("updates existing dynamic stylesheet link when switching curated pairings", () => {
      const { doc, properties, elements, headChildren } = createMockDocument();
      (globalThis as any).document = doc;

      try {
        applyFontTheme("playfair-montserrat");
        assert.equal(headChildren.length, 1);

        // Switch to Quicksand / Crimson
        applyFontTheme("quicksand-crimson");
        assert.equal(headChildren.length, 1, "Should not duplicate link tags");
        const linkEl = elements.get("dynamic-font-theme");
        assert.ok(linkEl.href.includes("Quicksand"));
        assert.ok(properties.get("--font-display")?.includes("Quicksand"));
        assert.ok(properties.get("--font-sans")?.includes("Crimson"));
      } finally {
        delete (globalThis as any).document;
      }
    });

    it("clears CSS variables and link element when applyFontTheme('default') is called", () => {
      const { doc, properties, elements } = createMockDocument();
      (globalThis as any).document = doc;

      try {
        applyFontTheme("playfair-montserrat");
        assert.ok(properties.has("--font-display"));
        assert.ok(elements.has("dynamic-font-theme"));

        // Apply default
        applyFontTheme("default");
        assert.equal(properties.has("--font-display"), false, "--font-display must be cleared");
        assert.equal(properties.has("--font-sans"), false, "--font-sans must be cleared");
        assert.equal(elements.has("dynamic-font-theme"), false, "dynamic link must be removed");
      } finally {
        delete (globalThis as any).document;
      }
    });

    it("clears CSS variables and link element when applyFontTheme(null) is called", () => {
      const { doc, properties, elements } = createMockDocument();
      (globalThis as any).document = doc;

      try {
        applyFontTheme("bodoni-barlow");
        assert.ok(properties.has("--font-display"));

        // Apply null
        applyFontTheme(null);
        assert.equal(properties.has("--font-display"), false);
        assert.equal(properties.has("--font-sans"), false);
      } finally {
        delete (globalThis as any).document;
      }
    });

    it("resetFontTheme cleanly clears custom properties and removes link element", () => {
      const { doc, properties, elements } = createMockDocument();
      (globalThis as any).document = doc;

      try {
        applyFontTheme("caslon-oswald");
        assert.ok(properties.has("--font-display"));

        resetFontTheme();
        assert.equal(properties.has("--font-display"), false);
        assert.equal(properties.has("--font-sans"), false);
        assert.equal(elements.has("dynamic-font-theme"), false);
      } finally {
        delete (globalThis as any).document;
      }
    });

    it("loadFontPreviewStylesheet injects preview pack link and is idempotent", () => {
      const { doc, elements, headChildren } = createMockDocument();
      (globalThis as any).document = doc;

      try {
        loadFontPreviewStylesheet();
        const previewEl = elements.get("google-fonts-preview-pack");
        assert.ok(previewEl, "<link id='google-fonts-preview-pack'> must be appended");
        assert.equal(previewEl.href, CURATED_PREVIEW_FONTS_URL);
        assert.equal(headChildren.length, 1);

        // Call again to verify idempotency
        loadFontPreviewStylesheet();
        assert.equal(headChildren.length, 1, "Must not append duplicate preview pack");
      } finally {
        delete (globalThis as any).document;
      }
    });
  });

  describe("SSR & Edge Safety", () => {
    it("does not throw when executed in a non-DOM / SSR environment (document undefined)", () => {
      assert.equal(typeof (globalThis as any).document, "undefined");
      assert.doesNotThrow(() => {
        applyFontTheme("playfair-montserrat");
        applyFontTheme("default");
        applyFontTheme(null);
        resetFontTheme();
        loadFontPreviewStylesheet();
      });
    });

    it("handles invalid or unknown theme IDs safely without throwing", () => {
      const { doc } = {
        doc: {
          documentElement: { style: { setProperty: () => {}, removeProperty: () => {} } },
          head: { appendChild: () => {} },
          getElementById: () => null,
          createElement: () => ({ remove: () => {} }),
        },
      };
      (globalThis as any).document = doc;

      try {
        assert.doesNotThrow(() => {
          applyFontTheme("unknown-theme-xyz" as any);
        });
      } finally {
        delete (globalThis as any).document;
      }
    });
  });
});
