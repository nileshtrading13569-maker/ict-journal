import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  BUTTON_THEMES,
  DEFAULT_BUTTON_THEME,
  BUTTON_THEME_STORAGE_KEY,
  getButtonTheme,
  applyButtonTheme,
  saveButtonTheme,
  type ButtonThemeId,
} from "./button-themes.ts";

describe("Button Themes: Liquid & Chrome", () => {
  const store = new Map<string, string>();
  const attributes = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    attributes.clear();
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, String(v)),
        removeItem: (k: string) => store.delete(k),
      },
    };
    (globalThis as any).document = {
      documentElement: {
        setAttribute: (k: string, v: string) => attributes.set(k, v),
      },
    };
  });

  it("contains all liquid button styles: theme, black, white, gold, amethyst", () => {
    const liquidThemes = BUTTON_THEMES.filter((b) => b.group === "liquid").map((b) => b.id);
    assert.deepEqual(liquidThemes, [
      "liquid-theme",
      "liquid-black",
      "liquid-white",
      "liquid-gold",
      "liquid-amethyst",
    ]);
  });

  it("contains all chrome button styles: theme, black chrome, matte chrome, white chrome", () => {
    const chromeThemes = BUTTON_THEMES.filter((b) => b.group === "chrome").map((b) => b.id);
    assert.deepEqual(chromeThemes, [
      "chrome-theme",
      "chrome-black",
      "chrome-matte",
      "chrome-white",
    ]);
  });

  it("saves and loads button theme from storage and updates documentElement", () => {
    assert.equal(getButtonTheme(), DEFAULT_BUTTON_THEME);

    saveButtonTheme("liquid-black");
    assert.equal(getButtonTheme(), "liquid-black");
    assert.equal(attributes.get("data-button-style"), "liquid-black");

    saveButtonTheme("chrome-black");
    assert.equal(getButtonTheme(), "chrome-black");
    assert.equal(attributes.get("data-button-style"), "chrome-black");
  });

  it("falls back to default button theme for unknown or invalid stored value", () => {
    store.set(BUTTON_THEME_STORAGE_KEY, "invalid-theme");
    assert.equal(getButtonTheme(), DEFAULT_BUTTON_THEME);

    store.set(BUTTON_THEME_STORAGE_KEY, "");
    assert.equal(getButtonTheme(), DEFAULT_BUTTON_THEME);
  });

  it("safely handles applyButtonTheme in SSR environment where document is undefined", () => {
    (globalThis as any).document = undefined;
    assert.doesNotThrow(() => {
      applyButtonTheme("liquid-gold");
      applyButtonTheme("chrome-white");
    });
  });

  it("verifies Gold and Amethyst luxury badges match spec", () => {
    const gold = BUTTON_THEMES.find((b) => b.id === "liquid-gold");
    assert.equal(gold?.badge, "Prestige 🔒");

    const amethyst = BUTTON_THEMES.find((b) => b.id === "liquid-amethyst");
    assert.equal(amethyst?.badge, "Apex 🔒");
  });
});
