import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  SOUND_PROFILES,
  getClickSoundEnabled,
  setClickSoundEnabled,
  getTypingSoundEnabled,
  setTypingSoundEnabled,
  getSoundProfile,
  setSoundProfile,
  previewSwitchSound,
  playClickSound,
  playTypingSound,
  type SoundProfile,
} from "./sound-fx.ts";

describe("Sound FX & Mechanical Switch Synthesis", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    // Setup mock window with localStorage
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, String(v)),
        removeItem: (k: string) => store.delete(k),
      },
    };
  });

  it("includes all 4 mechanical switch profiles: Blue, Brown, Red, Liquid", () => {
    const ids = SOUND_PROFILES.map((p) => p.id);
    assert.deepEqual(ids, ["blue", "brown", "red", "liquid"]);

    const blue = SOUND_PROFILES.find((p) => p.id === "blue");
    assert.equal(blue?.type, "Clicky");
    assert.equal(blue?.colorDot, "#3b82f6");

    const brown = SOUND_PROFILES.find((p) => p.id === "brown");
    assert.equal(brown?.type, "Tactile");

    const red = SOUND_PROFILES.find((p) => p.id === "red");
    assert.equal(red?.type, "Smooth");

    const liquid = SOUND_PROFILES.find((p) => p.id === "liquid");
    assert.equal(liquid?.type, "Crisp");
  });

  it("persists click sound toggle state in localStorage", () => {
    assert.equal(getClickSoundEnabled(), false);
    setClickSoundEnabled(true);
    assert.equal(getClickSoundEnabled(), true);
    setClickSoundEnabled(false);
    assert.equal(getClickSoundEnabled(), false);
  });

  it("persists typing sound toggle state in localStorage", () => {
    assert.equal(getTypingSoundEnabled(), false);
    setTypingSoundEnabled(true);
    assert.equal(getTypingSoundEnabled(), true);
    setTypingSoundEnabled(false);
    assert.equal(getTypingSoundEnabled(), false);
  });

  it("persists switch profile selection in localStorage", () => {
    assert.equal(getSoundProfile(), "liquid");
    setSoundProfile("blue");
    assert.equal(getSoundProfile(), "blue");
    setSoundProfile("brown");
    assert.equal(getSoundProfile(), "brown");
    setSoundProfile("red");
    assert.equal(getSoundProfile(), "red");
  });

  it("falls back to liquid switch profile for unknown or corrupted stored value", () => {
    store.set("first-payout-sound-profile-v1", "alien-switch");
    assert.equal(getSoundProfile(), "liquid");
    store.set("first-payout-sound-profile-v1", "");
    assert.equal(getSoundProfile(), "liquid");
  });

  it("safely handles preview and sound execution in SSR environment without window", () => {
    (globalThis as any).window = undefined;
    assert.doesNotThrow(() => {
      assert.equal(getClickSoundEnabled(), false);
      assert.equal(getTypingSoundEnabled(), false);
      assert.equal(getSoundProfile(), "liquid");
      setClickSoundEnabled(true);
      setTypingSoundEnabled(true);
      setSoundProfile("blue");
      previewSwitchSound("liquid");
      playClickSound();
      playTypingSound();
    });
  });

  it("safely handles preview and sound execution in headless environment without crashing", () => {
    // Web Audio API is undefined in standard Node.js without polyfills; verify graceful no-op
    assert.doesNotThrow(() => {
      previewSwitchSound("blue");
      previewSwitchSound("brown");
      previewSwitchSound("red");
      previewSwitchSound("liquid");
      playClickSound();
      playTypingSound();
    });
  });
});
