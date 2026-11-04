import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FONT_STORAGE_KEY,
  DYNAMIC_FONT_LINK_ID,
  PREVIEW_PACK_LINK_ID,
  CURATED_PREVIEW_FONTS_URL,
  CURATED_FONT_PAIRINGS,
  TERMINAL_FONT_THEMES,
  FONT_THEMES,
  applyFontTheme,
  resetFontTheme,
  loadFontPreviewStylesheet,
  getFontThemeById,
  type FontTheme,
} from "../src/lib/font-themes.ts";

// Helper to create a fully controllable mock DOM environment
function createMockDOMEnvironment() {
  const styles = new Map<string, string>();
  const headElements = new Map<string, any>();
  const headChildren: any[] = [];
  const localStorageStore = new Map<string, string>();

  function createMockElement(tag: string, id: string = "") {
    const el: any = {
      tagName: tag.toUpperCase(),
      id,
      rel: "",
      href: "",
      parentNode: null as any,
      remove: function () {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        } else {
          if (el.id) headElements.delete(el.id);
          const hIdx = headChildren.indexOf(el);
          if (hIdx !== -1) headChildren.splice(hIdx, 1);
        }
      },
    };
    return el;
  }

  const head = {
    children: headChildren,
    appendChild: (el: any) => {
      headChildren.push(el);
      if (el.id) headElements.set(el.id, el);
      el.parentNode = head;
      return el;
    },
    removeChild: (child: any) => {
      const idx = headChildren.indexOf(child);
      if (idx !== -1) headChildren.splice(idx, 1);
      if (child.id) headElements.delete(child.id);
      child.parentNode = null;
      return child;
    },
  };

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
    head,
    getElementById: (id: string) => headElements.get(id) ?? null,
    createElement: (tag: string) => createMockElement(tag),
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
    head,
    styles,
    headElements,
    headChildren,
    localStore,
    localStorageStore,
    createMockElement,
  };
}

describe("Adversarial Stress Test: Typography Engine & Curated Font Pairings", () => {
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Invalid Theme IDs & Boundary Values
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Suite 1: Invalid, Malformed & Hostile Theme IDs", () => {
    it("safely handles null, undefined, empty string, and whitespace without throwing", () => {
      const env = createMockDOMEnvironment();
      (globalThis as any).document = env.doc;

      try {
        const invalidInputs = [null, undefined, "", "   ", "\t\n", "\0"];

        for (const input of invalidInputs) {
          // Pre-populate with a valid font
          applyFontTheme("playfair-montserrat");
          assert.ok(env.headElements.has(DYNAMIC_FONT_LINK_ID), "Should have dynamic link set");
          assert.ok(env.styles.has("--font-display"), "Should have display font set");

          // Apply invalid input
          assert.doesNotThrow(() => {
            applyFontTheme(input as any);
          }, `applyFontTheme(${JSON.stringify(input)}) must not throw`);

          // Assert safe reset
          assert.equal(
            env.headElements.has(DYNAMIC_FONT_LINK_ID),
            false,
            `Dynamic link must be removed when invalid input ${JSON.stringify(input)} is applied`
          );
          assert.equal(
            env.styles.has("--font-display"),
            false,
            `--font-display must be cleared for input ${JSON.stringify(input)}`
          );
          assert.equal(
            env.styles.has("--font-sans"),
            false,
            `--font-sans must be cleared for input ${JSON.stringify(input)}`
          );
        }
      } finally {
        delete (globalThis as any).document;
      }
    });

    it("safely rejects hostile injection strings and random unmapped IDs", () => {
      const env = createMockDOMEnvironment();
      (globalThis as any).document = env.doc;

      try {
        const hostileInputs = [
          "unknown-theme-12345",
          "<script>alert('xss')</script>",
          "'; DROP TABLE fonts; --",
          "../../etc/passwd",
          "__proto__",
          "constructor",
          "toString",
          "valueOf",
          "hasOwnProperty",
          "gibson-gotham; font-family: evil",
          "01", // Number string instead of valid id
          "02",
          "08",
          "A".repeat(10000), // Extreme buffer length
        ];

        for (const hostile of hostileInputs) {
          applyFontTheme("caslon-oswald");
          assert.ok(env.headElements.has(DYNAMIC_FONT_LINK_ID));

          assert.doesNotThrow(() => {
            applyFontTheme(hostile as any);
          }, `Hostile string should not throw: ${hostile.slice(0, 30)}`);

          // Must safely reset to default
          assert.equal(
            env.headElements.has(DYNAMIC_FONT_LINK_ID),
            false,
            `Dynamic link must be absent after hostile input: ${hostile.slice(0, 30)}`
          );
          assert.equal(
            env.styles.has("--font-display"),
            false,
            `--font-display must be cleared after hostile input`
          );
        }
      } finally {
        delete (globalThis as any).document;
      }
    });

    it("safely handles non-string types passed via JavaScript type coercion bypasses", () => {
      const env = createMockDOMEnvironment();
      (globalThis as any).document = env.doc;

      try {
        const nonStringInputs = [
          0,
          1,
          -1,
          NaN,
          Infinity,
          true,
          false,
          {},
          { id: "gibson-gotham" },
          [],
          ["gibson-gotham"],
          () => "playfair-montserrat",
          Symbol("font-symbol"),
        ];

        for (const input of nonStringInputs) {
          applyFontTheme("bodoni-barlow");

          assert.doesNotThrow(() => {
            applyFontTheme(input as any);
          }, `Non-string input should not throw: ${String(input)}`);

          assert.equal(env.headElements.has(DYNAMIC_FONT_LINK_ID), false);
          assert.equal(env.styles.has("--font-display"), false);
        }
      } finally {
        delete (globalThis as any).document;
      }
    });

    it("verifies getFontThemeById returns undefined for all invalid/boundary inputs", () => {
      const invalidKeys = [
        null,
        undefined,
        "",
        "   ",
        "default",
        "DEFAULT",
        "unknown",
        "__proto__",
        "constructor",
        "01",
        123,
        true,
        {},
        [],
        Symbol("test"),
      ];

      for (const key of invalidKeys) {
        assert.doesNotThrow(() => {
          const res = getFontThemeById(key as any);
          assert.equal(
            res,
            undefined,
            `getFontThemeById(${String(key)}) must return undefined`
          );
        });
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Rapid State Transitions & Stress Testing (500+ Transitions)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Suite 2: Rapid State Transitions & Race Resistance", () => {
    it("handles 800 rapid sequential switches across all 8 curated pairings without DOM leaks", () => {
      const env = createMockDOMEnvironment();
      (globalThis as any).document = env.doc;

      try {
        // Pre-insert a base stylesheet to verify it is never touched
        const baseStyle = env.createMockElement("link", "main-app-stylesheet");
        baseStyle.href = "/assets/index.css";
        env.head.appendChild(baseStyle);

        // Perform 100 cycles through all 8 pairings = 800 switches
        const iterations = 100;
        for (let i = 0; i < iterations; i++) {
          for (const pairing of CURATED_FONT_PAIRINGS) {
            applyFontTheme(pairing.id as FontTheme);

            // Invariant 1: Exactly 1 dynamic link in head
            const dynamicLinks = env.headChildren.filter(
              (el) => el.id === DYNAMIC_FONT_LINK_ID
            );
            assert.equal(
              dynamicLinks.length,
              1,
              `Must maintain exactly 1 dynamic link tag (at cycle ${i}, pairing ${pairing.id})`
            );

            // Invariant 2: Link href matches current pairing
            const activeLink = env.headElements.get(DYNAMIC_FONT_LINK_ID);
            assert.equal(activeLink.href, pairing.googleFontsUrl);

            // Invariant 3: CSS variables match current pairing
            assert.equal(env.styles.get("--font-display"), pairing.display);
            assert.equal(env.styles.get("--font-sans"), pairing.sans);

            // Invariant 4: Base stylesheet was never touched
            assert.ok(env.headElements.has("main-app-stylesheet"));
          }
        }

        // Final switch to default
        applyFontTheme("default");
        assert.equal(env.headElements.has(DYNAMIC_FONT_LINK_ID), false);
        assert.equal(env.styles.has("--font-display"), false);
        assert.equal(env.styles.has("--font-sans"), false);
        assert.equal(env.headChildren.length, 1, "Only base stylesheet should remain");
      } finally {
        delete (globalThis as any).document;
      }
    });

    it("stress tests transitions between curated (remote CSS) and terminal (system CSS) fonts", () => {
      const env = createMockDOMEnvironment();
      (globalThis as any).document = env.doc;

      try {
        // Interleave curated pairing with local terminal font 50 times
        for (let i = 0; i < 50; i++) {
          // Switch to curated font (03 Beautiful Bloom / Avenir Next)
          applyFontTheme("bloom-avenir");
          assert.ok(
            env.headElements.has(DYNAMIC_FONT_LINK_ID),
            "Curated font must inject dynamic link"
          );
          assert.ok(env.styles.get("--font-display")?.includes("Birthstone Bounce"));

          // Switch to terminal font (Inter — has no googleFontsUrl)
          applyFontTheme("inter");
          assert.equal(
            env.headElements.has(DYNAMIC_FONT_LINK_ID),
            false,
            "Terminal font must remove external dynamic link"
          );
          assert.equal(
            env.styles.get("--font-display"),
            '"Inter", sans-serif',
            "Terminal font display must be applied"
          );
          assert.equal(
            env.styles.get("--font-sans"),
            '"Inter", -apple-system, sans-serif',
            "Terminal font sans must be applied"
          );
        }
      } finally {
        delete (globalThis as any).document;
      }
    });

    it("survives 500 randomized chaotic transitions including invalid IDs, nulls, and defaults", () => {
      const env = createMockDOMEnvironment();
      (globalThis as any).document = env.doc;

      try {
        const allPossibleChoices = [
          ...CURATED_FONT_PAIRINGS.map((p) => p.id),
          ...TERMINAL_FONT_THEMES.map((t) => t.id),
          "default",
          null,
          undefined,
          "random-garbage-id",
          "",
        ];

        // Seeded pseudorandom generator for deterministic repeatability
        let seed = 42;
        function randomChoice<T>(arr: T[]): T {
          seed = (seed * 9301 + 49297) % 233280;
          const idx = Math.floor((seed / 233280) * arr.length);
          return arr[idx];
        }

        for (let step = 0; step < 500; step++) {
          const choice = randomChoice(allPossibleChoices);
          applyFontTheme(choice as any);

          // Verify global DOM invariant after EVERY step
          const dynamicLinks = env.headChildren.filter(
            (el) => el.id === DYNAMIC_FONT_LINK_ID
          );
          assert.ok(
            dynamicLinks.length <= 1,
            `Step ${step}: At most 1 dynamic link tag allowed, found ${dynamicLinks.length}`
          );

          const matched = FONT_THEMES.find((t) => t.id === choice);
          if (matched) {
            if (matched.googleFontsUrl) {
              assert.equal(dynamicLinks.length, 1);
              assert.equal(dynamicLinks[0].href, matched.googleFontsUrl);
            } else {
              assert.equal(dynamicLinks.length, 0);
            }
            assert.equal(env.styles.get("--font-display"), matched.display);
            assert.equal(env.styles.get("--font-sans"), matched.sans);
          } else {
            // Default or invalid ID -> should be cleanly reset
            assert.equal(dynamicLinks.length, 0);
            assert.equal(env.styles.has("--font-display"), false);
            assert.equal(env.styles.has("--font-sans"), false);
          }
        }
      } finally {
        delete (globalThis as any).document;
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. DOM Link Management & Head Isolation
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Suite 3: DOM Link Management & Coexistence", () => {
    it("never removes or alters preview pack stylesheet during font switches and resets", () => {
      const env = createMockDOMEnvironment();
      (globalThis as any).document = env.doc;

      try {
        // Step 1: Preload preview pack (as happens when settings sheet opens)
        loadFontPreviewStylesheet();
        assert.ok(env.headElements.has(PREVIEW_PACK_LINK_ID));
        assert.equal(
          env.headElements.get(PREVIEW_PACK_LINK_ID).href,
          CURATED_PREVIEW_FONTS_URL
        );

        // Step 2: Switch through several font themes
        applyFontTheme("gibson-gotham");
        applyFontTheme("quicksand-crimson");
        applyFontTheme("caslon-oswald");

        // Verify preview pack was not displaced or mutated
        assert.ok(
          env.headElements.has(PREVIEW_PACK_LINK_ID),
          "Preview pack link must remain in head"
        );
        assert.equal(
          env.headElements.get(PREVIEW_PACK_LINK_ID).href,
          CURATED_PREVIEW_FONTS_URL
        );

        // Step 3: Reset font theme
        resetFontTheme();
        assert.equal(env.headElements.has(DYNAMIC_FONT_LINK_ID), false);
        assert.ok(
          env.headElements.has(PREVIEW_PACK_LINK_ID),
          "Preview pack must survive resetFontTheme"
        );

        // Step 4: Call applyFontTheme('default')
        applyFontTheme("default");
        assert.ok(
          env.headElements.has(PREVIEW_PACK_LINK_ID),
          "Preview pack must survive applyFontTheme('default')"
        );
      } finally {
        delete (globalThis as any).document;
      }
    });

    it("supports legacy DOM where element.remove is undefined but parentNode.removeChild exists", () => {
      const env = createMockDOMEnvironment();

      // Override createElement to produce elements without .remove()
      const originalCreate = env.doc.createElement;
      env.doc.createElement = (tag: string) => {
        const el = originalCreate(tag);
        delete el.remove; // Emulate older browser / partial mock
        return el;
      };

      (globalThis as any).document = env.doc;

      try {
        applyFontTheme("playfair-montserrat");
        assert.ok(env.headElements.has(DYNAMIC_FONT_LINK_ID));

        // Switch to default; should call parentNode.removeChild without error
        assert.doesNotThrow(() => {
          resetFontTheme();
        });
        assert.equal(env.headElements.has(DYNAMIC_FONT_LINK_ID), false);
      } finally {
        delete (globalThis as any).document;
      }
    });

    it("survives hostile DOM where document.head or documentElement is temporarily null", () => {
      const brokenDoc = {
        documentElement: null as any,
        head: null as any,
        getElementById: () => null,
        createElement: () => ({ remove: () => {} }),
      };
      (globalThis as any).document = brokenDoc;

      try {
        assert.doesNotThrow(() => {
          applyFontTheme("playfair-montserrat");
          resetFontTheme();
          loadFontPreviewStylesheet();
        });
      } finally {
        delete (globalThis as any).document;
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. LocalStorage Corruption & Hydration Stress
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Suite 4: LocalStorage Corruption & Hydration Fallback", () => {
    it("safely hydrates across 15 corrupted / unexpected localStorage values", () => {
      const env = createMockDOMEnvironment();
      (globalThis as any).document = env.doc;
      (globalThis as any).window = { localStorage: env.localStore };

      try {
        const corruptedStorageValues = [
          "",
          "null",
          "undefined",
          "[object Object]",
          "NaN",
          "0",
          "1",
          "true",
          "false",
          "{\"theme\": \"playfair\"}",
          "<svg onload=alert(1)>",
          "default",
          "playfair", // missing full id 'playfair-montserrat'
          "gibson",   // missing full id 'gibson-gotham'
          "random-deleted-id-v0",
        ];

        for (const corruptVal of corruptedStorageValues) {
          env.localStore.setItem(FONT_STORAGE_KEY, corruptVal);

          // Simulate hydration logic from desk-provider.tsx & settings-sheet.tsx
          assert.doesNotThrow(() => {
            const raw = env.localStore.getItem(FONT_STORAGE_KEY);
            if (raw && raw !== "default") {
              const matched = FONT_THEMES.find((t) => t.id === raw);
              if (matched) {
                applyFontTheme(matched.id as FontTheme);
              } else {
                applyFontTheme("default");
              }
            } else {
              applyFontTheme("default");
            }
          }, `Hydration should not throw on corrupt value: ${corruptVal}`);

          // Invariant: no dynamic link, no CSS variables should be left lingering
          assert.equal(
            env.headElements.has(DYNAMIC_FONT_LINK_ID),
            false,
            `Dynamic link must not be created for corrupt value: ${corruptVal}`
          );
          assert.equal(
            env.styles.has("--font-display"),
            false,
            `--font-display must be absent for corrupt value: ${corruptVal}`
          );
          assert.equal(
            env.styles.has("--font-sans"),
            false,
            `--font-sans must be absent for corrupt value: ${corruptVal}`
          );
        }
      } finally {
        delete (globalThis as any).document;
        delete (globalThis as any).window;
      }
    });

    it("safely handles localStorage throwing SecurityError or QuotaExceededError", () => {
      const throwingStore = {
        getItem: () => {
          throw new Error("DOMException: SecurityError (Access denied)");
        },
        setItem: () => {
          throw new Error("DOMException: QuotaExceededError");
        },
        removeItem: () => {
          throw new Error("DOMException: SecurityError");
        },
      };

      const env = createMockDOMEnvironment();
      (globalThis as any).document = env.doc;
      (globalThis as any).window = { localStorage: throwingStore };

      try {
        // Emulate settings-sheet.tsx loading with throwing localStorage
        assert.doesNotThrow(() => {
          try {
            const savedFont = (globalThis as any).window.localStorage.getItem(FONT_STORAGE_KEY);
            applyFontTheme(savedFont);
          } catch {
            // Expected catch block in UI components
            applyFontTheme("default");
          }
        });

        // Typography should cleanly remain at default
        assert.equal(env.styles.has("--font-display"), false);
        assert.equal(env.headElements.has(DYNAMIC_FONT_LINK_ID), false);
      } finally {
        delete (globalThis as any).document;
        delete (globalThis as any).window;
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Curated Pairings Contract Verification
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Suite 5: Exact Curated Pairings Contract & CSS Quotation", () => {
    it("verifies all 8 curated pairings have properly quoted font stacks and HTTPS URLs", () => {
      const expectedCatalog = [
        { num: "01", id: "gibson-gotham", keyHead: "Pinyon Script", keyBody: "Montserrat" },
        { num: "02", id: "playfair-montserrat", keyHead: "Playfair Display", keyBody: "Montserrat" },
        { num: "03", id: "bloom-avenir", keyHead: "Birthstone Bounce", keyBody: "Nunito Sans" },
        { num: "04", id: "museo-average", keyHead: "Albert Sans", keyBody: "Average" },
        { num: "05", id: "caslon-oswald", keyHead: "Caslon", keyBody: "Oswald" },
        { num: "06", id: "playlist-georgia", keyHead: "Caveat", keyBody: "Georgia" },
        { num: "07", id: "bodoni-barlow", keyHead: "Bodoni", keyBody: "Barlow Condensed" },
        { num: "08", id: "quicksand-crimson", keyHead: "Quicksand", keyBody: "Crimson" },
      ];

      assert.equal(CURATED_FONT_PAIRINGS.length, 8);

      expectedCatalog.forEach((expected) => {
        const p = CURATED_FONT_PAIRINGS.find((item) => item.number === expected.num);
        assert.ok(p, `Pairing ${expected.num} must exist`);
        assert.equal(p.id, expected.id);
        assert.ok(p.display.includes(expected.keyHead));
        assert.ok(p.sans.includes(expected.keyBody));
        assert.ok(p.googleFontsUrl?.startsWith("https://fonts.googleapis.com/css2?"));
        assert.ok(p.googleFontsUrl?.includes("display=swap"));

        // Verify quotes around multi-word font names in CSS font stacks
        if (expected.keyHead.includes(" ")) {
          assert.ok(
            p.display.includes(`"${expected.keyHead}"`),
            `Display font '${expected.keyHead}' must be double-quoted in CSS stack`
          );
        }
        if (expected.keyBody.includes(" ")) {
          assert.ok(
            p.sans.includes(`"${expected.keyBody}"`),
            `Body font '${expected.keyBody}' must be double-quoted in CSS stack`
          );
        }
      });
    });
  });
});
