import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CURATED_FONT_PAIRINGS,
  FONT_THEMES,
  FONT_STORAGE_KEY,
  DEFAULT_FONT_THEME,
  DYNAMIC_FONT_LINK_ID,
  PREVIEW_PACK_LINK_ID,
  CURATED_PREVIEW_FONTS_URL,
  applyFontTheme,
  resetFontTheme,
  loadFontPreviewStylesheet,
  getFontThemeById,
  type FontThemeOption,
  type FontTheme,
} from "../src/lib/font-themes.ts";

// Standard generic CSS font family keywords
const GENERIC_CSS_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "cursive",
  "fantasy",
  "monospace",
  "system-ui",
]);

// Well-known reliable system fallback fonts
const SYSTEM_FALLBACK_FONTS = new Set([
  "georgia",
  "times new roman",
  "inter",
  "ibm plex sans",
  "-apple-system",
  "blinkmacsystemfont",
  "segoe ui",
  "roboto",
  "didot",
  "big caslon",
  "alex brush",
  "playball",
  "plus jakarta sans",
  "caveat",
]);

// Helper to parse CSS font-family stack into tokens
function parseFontStack(stack: string): string[] {
  assert.ok(typeof stack === "string" && stack.length > 0, "Font stack must be a non-empty string");
  const tokens: string[] = [];
  let current = "";
  let inQuotes: "'" | '"' | null = null;

  for (let i = 0; i < stack.length; i++) {
    const char = stack[i];
    if (char === '"' || char === "'") {
      if (inQuotes === char) {
        inQuotes = null;
      } else if (!inQuotes) {
        inQuotes = char;
      }
      current += char;
    } else if (char === "," && !inQuotes) {
      const trimmed = current.trim();
      if (trimmed) tokens.push(trimmed);
      current = "";
    } else {
      current += char;
    }
  }

  assert.equal(inQuotes, null, `Unterminated quote in font stack: ${stack}`);
  const last = current.trim();
  if (last) tokens.push(last);

  return tokens;
}

// Clean unquoted family name
function stripQuotes(family: string): string {
  return family.replace(/^["']|["']$/g, "").trim();
}

// Extract font family name from Google Fonts family query parameter (e.g. 'Montserrat:ital,wght@...' -> 'Montserrat')
function extractGoogleFontFamilyName(param: string): string {
  const colonIdx = param.indexOf(":");
  return colonIdx === -1 ? param.trim() : param.slice(0, colonIdx).trim();
}

// Mock CSSStyleDeclaration that behaves like browser document.documentElement.style
function createMockDOM() {
  const styleStore = new Map<string, string>();
  const headElements = new Map<string, any>();
  const headChildren: any[] = [];

  const styleObj = {
    setProperty(prop: string, val: string) {
      if (val === "") {
        styleStore.delete(prop);
      } else {
        styleStore.set(prop, val);
      }
    },
    removeProperty(prop: string) {
      const val = styleStore.get(prop) ?? "";
      styleStore.delete(prop);
      return val;
    },
    getPropertyValue(prop: string) {
      return styleStore.get(prop) ?? "";
    },
    get length() {
      return styleStore.size;
    },
    item(idx: number) {
      return Array.from(styleStore.keys())[idx] ?? "";
    },
    get cssText() {
      return Array.from(styleStore.entries())
        .map(([k, v]) => `${k}: ${v};`)
        .join(" ");
    },
  };

  const doc = {
    documentElement: {
      style: styleObj,
    },
    head: {
      appendChild(node: any) {
        headChildren.push(node);
        if (node.id) headElements.set(node.id, node);
      },
    },
    getElementById(id: string) {
      return headElements.get(id) ?? null;
    },
    createElement(tag: string) {
      const el = {
        tagName: tag.toUpperCase(),
        id: "",
        rel: "",
        href: "",
        parentNode: {
          removeChild(child: any) {
            if (child.id) headElements.delete(child.id);
            const idx = headChildren.indexOf(child);
            if (idx !== -1) headChildren.splice(idx, 1);
          },
        },
        remove() {
          if (el.id) headElements.delete(el.id);
          const idx = headChildren.indexOf(el);
          if (idx !== -1) headChildren.splice(idx, 1);
        },
      };
      return el;
    },
  };

  return { doc, styleStore, headElements, headChildren };
}

describe("Adversarial Verification Suite: Typography & Curated Font Pairings", () => {
  describe("Invariant 1: Curated Font Pairings Catalog Definition & Numbering", () => {
    it("has exactly 8 curated font pairings", () => {
      assert.equal(CURATED_FONT_PAIRINGS.length, 8, "CURATED_FONT_PAIRINGS must contain exactly 8 items");
    });

    it("has strictly ascending 2-digit numbers from '01' to '08'", () => {
      const expectedNumbers = ["01", "02", "03", "04", "05", "06", "07", "08"];
      const actualNumbers = CURATED_FONT_PAIRINGS.map((p) => p.number);
      assert.deepEqual(actualNumbers, expectedNumbers, "Numbers must be strictly '01' through '08'");
    });

    it("ensures each pairing is marked isCurated === true and category === 'curated'", () => {
      for (const p of CURATED_FONT_PAIRINGS) {
        assert.equal(p.isCurated, true, `Pairing ${p.number} (${p.id}) must have isCurated: true`);
        assert.equal(p.category, "curated", `Pairing ${p.number} (${p.id}) must have category: 'curated'`);
      }
    });

    it("verifies pairing identities and names match ORIGINAL_REQUEST R1 catalog exactly", () => {
      const expected = [
        { num: "01", id: "gibson-gotham", displayRegex: /Pinyon Script|Alex Brush/i, sansRegex: /Montserrat|Inter/i },
        { num: "02", id: "playfair-montserrat", displayRegex: /Playfair Display/i, sansRegex: /Montserrat/i },
        { num: "03", id: "bloom-avenir", displayRegex: /Birthstone Bounce|Caveat/i, sansRegex: /Nunito Sans/i },
        { num: "04", id: "museo-average", displayRegex: /Albert Sans|Plus Jakarta Sans/i, sansRegex: /Average/i },
        { num: "05", id: "caslon-oswald", displayRegex: /Caslon/i, sansRegex: /Oswald/i },
        { num: "06", id: "playlist-georgia", displayRegex: /Caveat|Playball/i, sansRegex: /Georgia/i },
        { num: "07", id: "bodoni-barlow", displayRegex: /Bodoni/i, sansRegex: /Barlow Condensed/i },
        { num: "08", id: "quicksand-crimson", displayRegex: /Quicksand/i, sansRegex: /Crimson/i },
      ];

      for (const exp of expected) {
        const item = CURATED_FONT_PAIRINGS.find((p) => p.number === exp.num);
        assert.ok(item, `Pairing ${exp.num} must exist`);
        assert.equal(item.id, exp.id, `Pairing ${exp.num} ID mismatch`);
        assert.match(item.display, exp.displayRegex, `Pairing ${exp.num} display font mismatch`);
        assert.match(item.sans, exp.sansRegex, `Pairing ${exp.num} sans font mismatch`);
      }
    });

    it("verifies all 8 curated pairings are present within FONT_THEMES without collisions", () => {
      const allIds = new Set<string>();
      for (const t of FONT_THEMES) {
        assert.ok(!allIds.has(t.id), `Duplicate ID in FONT_THEMES: ${t.id}`);
        allIds.add(t.id);
      }
      for (const p of CURATED_FONT_PAIRINGS) {
        assert.ok(allIds.has(p.id), `FONT_THEMES missing curated pairing: ${p.id}`);
      }
    });
  });

  describe("Invariant 2: CSS Font Stacks & Reliable System Fallbacks", () => {
    it("validates CSS syntax and quote-wrapping for multi-word family names", () => {
      for (const p of CURATED_FONT_PAIRINGS) {
        const displayTokens = parseFontStack(p.display);
        const sansTokens = parseFontStack(p.sans);

        assert.ok(displayTokens.length >= 2, `Pairing ${p.number} display stack must have at least 2 families`);
        assert.ok(sansTokens.length >= 2, `Pairing ${p.number} sans stack must have at least 2 families`);

        // Check each token
        for (const token of [...displayTokens, ...sansTokens]) {
          const raw = token.trim();
          const clean = stripQuotes(raw);

          // If family contains spaces, it MUST be wrapped in quotes
          if (clean.includes(" ")) {
            assert.ok(
              (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")),
              `Multi-word font family "${raw}" in pairing ${p.number} must be quoted`,
            );
          }
        }
      }
    });

    it("ensures every display font stack terminates with a valid generic or reliable system fallback", () => {
      for (const p of CURATED_FONT_PAIRINGS) {
        const tokens = parseFontStack(p.display);
        const lastToken = stripQuotes(tokens[tokens.length - 1]).toLowerCase();

        // Must end in a generic family keyword or known system font
        const isValidTerminal = GENERIC_CSS_FAMILIES.has(lastToken) || SYSTEM_FALLBACK_FONTS.has(lastToken);
        assert.ok(
          isValidTerminal,
          `Pairing ${p.number} display stack terminates with non-standard fallback: "${lastToken}"`,
        );

        // Check for presence of at least one reliable fallback in the stack
        const hasFallback = tokens.some((t) => {
          const clean = stripQuotes(t).toLowerCase();
          return GENERIC_CSS_FAMILIES.has(clean) || SYSTEM_FALLBACK_FONTS.has(clean);
        });
        assert.ok(hasFallback, `Pairing ${p.number} display stack lacks a recognized reliable fallback`);
      }
    });

    it("ensures every sans font stack terminates with a valid generic or reliable system fallback", () => {
      for (const p of CURATED_FONT_PAIRINGS) {
        const tokens = parseFontStack(p.sans);
        const lastToken = stripQuotes(tokens[tokens.length - 1]).toLowerCase();

        const isValidTerminal = GENERIC_CSS_FAMILIES.has(lastToken) || SYSTEM_FALLBACK_FONTS.has(lastToken);
        assert.ok(
          isValidTerminal,
          `Pairing ${p.number} sans stack terminates with non-standard fallback: "${lastToken}"`,
        );

        // Check for presence of at least one reliable fallback in the stack
        const hasFallback = tokens.some((t) => {
          const clean = stripQuotes(t).toLowerCase();
          return GENERIC_CSS_FAMILIES.has(clean) || SYSTEM_FALLBACK_FONTS.has(clean);
        });
        assert.ok(hasFallback, `Pairing ${p.number} sans stack lacks a recognized reliable fallback`);
      }
    });
  });

  describe("Invariant 3: Google Fonts Query Strings & URL Validation", () => {
    it("ensures every curated pairing has a valid Google Fonts URL pointing to fonts.googleapis.com/css2", () => {
      for (const p of CURATED_FONT_PAIRINGS) {
        assert.ok(p.googleFontsUrl, `Pairing ${p.number} must have googleFontsUrl`);
        const url = new URL(p.googleFontsUrl);
        assert.equal(url.protocol, "https:", `Pairing ${p.number} URL must use HTTPS`);
        assert.equal(url.host, "fonts.googleapis.com", `Pairing ${p.number} URL must host fonts.googleapis.com`);
        assert.equal(url.pathname, "/css2", `Pairing ${p.number} URL pathname must be /css2`);
        assert.equal(url.searchParams.get("display"), "swap", `Pairing ${p.number} must specify display=swap`);
      }
    });

    it("verifies query parameters include web-hosted display and body font families", () => {
      for (const p of CURATED_FONT_PAIRINGS) {
        const url = new URL(p.googleFontsUrl!);
        const families = url.searchParams.getAll("family").map(extractGoogleFontFamilyName);

        const primaryDisplay = stripQuotes(parseFontStack(p.display)[0]);
        const primarySans = stripQuotes(parseFontStack(p.sans)[0]);

        // Check display family presence in query
        const displayMatch = families.some(
          (f) => f.toLowerCase() === primaryDisplay.toLowerCase() || primaryDisplay.toLowerCase().includes(f.toLowerCase()),
        );
        assert.ok(
          displayMatch,
          `Pairing ${p.number} (${p.id}) googleFontsUrl missing display family "${primaryDisplay}". Families: ${JSON.stringify(families)}`,
        );

        // Check sans family presence in query (unless primary sans is a native OS font like Georgia)
        const isNativeSystemFont = SYSTEM_FALLBACK_FONTS.has(primarySans.toLowerCase());
        if (!isNativeSystemFont) {
          const sansMatch = families.some(
            (f) => f.toLowerCase() === primarySans.toLowerCase() || primarySans.toLowerCase().includes(f.toLowerCase()),
          );
          assert.ok(
            sansMatch,
            `Pairing ${p.number} (${p.id}) googleFontsUrl missing sans family "${primarySans}". Families: ${JSON.stringify(families)}`,
          );
        } else {
          // If native system font (e.g. Georgia in Pairing 06), document that external web font fetch is bypassed by design
          assert.equal(p.number, "06", "Only pairing 06 uses native system serif (Georgia) as primary body typeface");
        }
      }
    });

    it("verifies live Google Fonts API availability for all 8 curated URLs (HTTP 200)", async () => {
      for (const p of CURATED_FONT_PAIRINGS) {
        const res = await fetch(p.googleFontsUrl!);
        assert.equal(
          res.status,
          200,
          `Google Fonts URL for pairing ${p.number} (${p.id}) returned HTTP ${res.status} instead of 200`,
        );
        const contentType = res.headers.get("content-type") ?? "";
        assert.ok(contentType.includes("text/css"), `Pairing ${p.number} response must be text/css`);
      }
    });

    it("verifies live Google Fonts API availability for CURATED_PREVIEW_FONTS_URL (HTTP 200)", async () => {
      const res = await fetch(CURATED_PREVIEW_FONTS_URL);
      assert.equal(res.status, 200, `Preview fonts pack returned HTTP ${res.status}`);
      const css = await res.text();
      assert.ok(css.includes("@font-face"), "Preview pack stylesheet must contain @font-face declarations");
    });
  });

  describe("Invariant 4: Reset Cleanliness & Zero Style Residue", () => {
    it("verifies applyFontTheme('default') leaves NO residue on documentElement.style", () => {
      const { doc, styleStore } = createMockDOM();
      (globalThis as any).document = doc;

      try {
        for (const p of CURATED_FONT_PAIRINGS) {
          // Apply font theme
          applyFontTheme(p.id as FontTheme);
          assert.equal(styleStore.get("--font-display"), p.display);
          assert.equal(styleStore.get("--font-sans"), p.sans);

          // Reset to default
          applyFontTheme("default");

          // Assert zero residual font variables
          assert.equal(
            styleStore.has("--font-display"),
            false,
            `--font-display remained in style store after resetting pairing ${p.number}`,
          );
          assert.equal(
            styleStore.has("--font-sans"),
            false,
            `--font-sans remained in style store after resetting pairing ${p.number}`,
          );
          assert.equal(doc.documentElement.style.getPropertyValue("--font-display"), "");
          assert.equal(doc.documentElement.style.getPropertyValue("--font-sans"), "");
          assert.equal(styleStore.size, 0, `styleStore had leftover properties: ${JSON.stringify([...styleStore.entries()])}`);
        }
      } finally {
        delete (globalThis as any).document;
      }
    });

    it("verifies resetFontTheme() leaves NO residue on documentElement.style", () => {
      const { doc, styleStore } = createMockDOM();
      (globalThis as any).document = doc;

      try {
        for (const p of CURATED_FONT_PAIRINGS) {
          applyFontTheme(p.id as FontTheme);
          assert.ok(styleStore.size >= 2);

          resetFontTheme();

          assert.equal(styleStore.has("--font-display"), false);
          assert.equal(styleStore.has("--font-sans"), false);
          assert.equal(doc.documentElement.style.getPropertyValue("--font-display"), "");
          assert.equal(doc.documentElement.style.getPropertyValue("--font-sans"), "");
          assert.equal(styleStore.size, 0);
        }
      } finally {
        delete (globalThis as any).document;
      }
    });

    it("verifies dynamic link element is completely removed from head on reset", () => {
      const { doc, headElements } = createMockDOM();
      (globalThis as any).document = doc;

      try {
        for (const p of CURATED_FONT_PAIRINGS) {
          applyFontTheme(p.id as FontTheme);
          assert.ok(headElements.has(DYNAMIC_FONT_LINK_ID), `Link element missing for ${p.id}`);

          resetFontTheme();
          assert.equal(
            headElements.has(DYNAMIC_FONT_LINK_ID),
            false,
            `Dynamic font link element leaked after reset of ${p.id}`,
          );
        }
      } finally {
        delete (globalThis as any).document;
      }
    });

    it("verifies pre-existing non-font style properties are preserved across font theme resets", () => {
      const { doc, styleStore } = createMockDOM();
      (globalThis as any).document = doc;

      try {
        // User sets custom theme properties
        doc.documentElement.style.setProperty("--color-accent", "#d946ef");
        doc.documentElement.style.setProperty("--color-base", "#09090b");
        doc.documentElement.style.setProperty("color-scheme", "dark");

        assert.equal(styleStore.size, 3);

        // Apply a curated font pairing
        applyFontTheme("bodoni-barlow");
        assert.equal(styleStore.size, 5); // 3 existing + 2 font vars
        assert.equal(styleStore.get("--color-accent"), "#d946ef");

        // Reset font theme
        resetFontTheme();

        // Non-font properties must remain untouched!
        assert.equal(styleStore.size, 3, "Only the 2 font properties should be removed");
        assert.equal(styleStore.get("--color-accent"), "#d946ef");
        assert.equal(styleStore.get("--color-base"), "#09090b");
        assert.equal(styleStore.get("color-scheme"), "dark");
        assert.equal(styleStore.has("--font-display"), false);
        assert.equal(styleStore.has("--font-sans"), false);
      } finally {
        delete (globalThis as any).document;
      }
    });

    it("stress-tests rapid theme switching and reset under 100 alternating cycles", () => {
      const { doc, styleStore, headChildren } = createMockDOM();
      (globalThis as any).document = doc;

      try {
        for (let cycle = 0; cycle < 100; cycle++) {
          const pairing = CURATED_FONT_PAIRINGS[cycle % CURATED_FONT_PAIRINGS.length];
          applyFontTheme(pairing.id as FontTheme);

          // Head must never have more than 1 dynamic font link element
          const links = headChildren.filter((c) => c.id === DYNAMIC_FONT_LINK_ID);
          assert.equal(links.length, 1, `Leaked link elements at cycle ${cycle}`);

          if (cycle % 7 === 0) {
            resetFontTheme();
            assert.equal(styleStore.has("--font-display"), false);
            assert.equal(styleStore.has("--font-sans"), false);
            assert.equal(headChildren.filter((c) => c.id === DYNAMIC_FONT_LINK_ID).length, 0);
          }
        }

        // Final reset
        applyFontTheme("default");
        assert.equal(styleStore.has("--font-display"), false);
        assert.equal(styleStore.has("--font-sans"), false);
        assert.equal(headChildren.filter((c) => c.id === DYNAMIC_FONT_LINK_ID).length, 0);
      } finally {
        delete (globalThis as any).document;
      }
    });
  });

  describe("Invariant 5: Edge Cases, Nullability & SSR Resilience", () => {
    it("handles null, undefined, empty string, and corrupted objects without crashing", () => {
      const { doc, styleStore, headElements } = createMockDOM();
      (globalThis as any).document = doc;

      try {
        // Set a font first
        applyFontTheme("playfair-montserrat");
        assert.ok(styleStore.has("--font-display"));

        // Passing null should trigger clean reset
        applyFontTheme(null);
        assert.equal(styleStore.has("--font-display"), false);
        assert.equal(headElements.has(DYNAMIC_FONT_LINK_ID), false);

        // Passing undefined should trigger clean reset
        applyFontTheme("bloom-avenir");
        assert.ok(styleStore.has("--font-display"));
        applyFontTheme(undefined);
        assert.equal(styleStore.has("--font-display"), false);

        // Passing invalid string should trigger clean reset
        applyFontTheme("bloom-avenir");
        assert.ok(styleStore.has("--font-display"));
        applyFontTheme("non-existent-theme-xyz" as any);
        assert.equal(styleStore.has("--font-display"), false);
      } finally {
        delete (globalThis as any).document;
      }
    });

    it("runs gracefully in true SSR environment where document is undefined", () => {
      assert.equal(typeof (globalThis as any).document, "undefined");
      assert.doesNotThrow(() => {
        for (const p of CURATED_FONT_PAIRINGS) {
          applyFontTheme(p.id as FontTheme);
        }
        applyFontTheme("default");
        applyFontTheme(null);
        resetFontTheme();
        loadFontPreviewStylesheet();
      });
    });

    it("verifies preview pack stylesheet injection is strictly idempotent", () => {
      const { doc, headElements, headChildren } = createMockDOM();
      (globalThis as any).document = doc;

      try {
        for (let i = 0; i < 10; i++) {
          loadFontPreviewStylesheet();
        }
        const previewLinks = headChildren.filter((c) => c.id === PREVIEW_PACK_LINK_ID);
        assert.equal(previewLinks.length, 1, "Must append preview pack exactly once regardless of call frequency");
        assert.equal(headElements.get(PREVIEW_PACK_LINK_ID)?.href, CURATED_PREVIEW_FONTS_URL);
      } finally {
        delete (globalThis as any).document;
      }
    });
  });
});
