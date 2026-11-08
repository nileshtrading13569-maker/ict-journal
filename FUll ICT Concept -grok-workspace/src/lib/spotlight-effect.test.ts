import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { initGlobalSpotlightListener, attachSpotlightToElement, BOX_SPOTLIGHT_SELECTOR } from "./spotlight-effect.ts";

describe("Universal Red Spotlight Engine across all Boxes & UI", () => {
  it("safely handles initGlobalSpotlightListener in SSR without window or document", () => {
    assert.doesNotThrow(() => {
      initGlobalSpotlightListener();
    });
  });

  it("contains selectors for sections, panels, cards, tiles, and buttons while excluding settings and no-spotlight", () => {
    assert.ok(BOX_SPOTLIGHT_SELECTOR.includes("section"));
    assert.ok(BOX_SPOTLIGHT_SELECTOR.includes(".kpi-card"));
    assert.ok(BOX_SPOTLIGHT_SELECTOR.includes(".stat-tile"));
    assert.ok(BOX_SPOTLIGHT_SELECTOR.includes(".spotlight-red"));
    assert.ok(BOX_SPOTLIGHT_SELECTOR.includes("button"));
    assert.ok(BOX_SPOTLIGHT_SELECTOR.includes("data-no-spotlight"));
    assert.ok(BOX_SPOTLIGHT_SELECTOR.includes("data-settings-trigger"));
    assert.ok(BOX_SPOTLIGHT_SELECTOR.includes("data-settings-modal"));
    assert.ok(BOX_SPOTLIGHT_SELECTOR.includes("Open settings"));
  });

  it("safely handles attachSpotlightToElement when element is null", () => {
    assert.doesNotThrow(() => {
      const cleanup = attachSpotlightToElement(null);
      assert.equal(typeof cleanup, "function");
      cleanup();
    });
  });

  it("attaches mouse event listeners and sets relative coordinates on box", () => {
    let mouseX = "";
    let mouseY = "";
    let opacity = "";
    const listeners: Record<string, Function> = {};

    const mockBox = {
      style: {
        setProperty: (key: string, val: string) => {
          if (key === "--mouse-x") mouseX = val;
          if (key === "--mouse-y") mouseY = val;
          if (key === "--spotlight-opacity") opacity = val;
        },
      },
      getBoundingClientRect: () => ({
        left: 100,
        top: 200,
        width: 400,
        height: 300,
      }),
      addEventListener: (evt: string, fn: Function) => {
        listeners[evt] = fn;
      },
      removeEventListener: (evt: string) => {
        delete listeners[evt];
      },
    } as unknown as HTMLElement;

    const cleanup = attachSpotlightToElement(mockBox);
    assert.ok(listeners.mousemove, "mousemove listener registered");
    assert.ok(listeners.mouseleave, "mouseleave listener registered");

    // Simulate mouse moving inside the box at clientX=150, clientY=240
    listeners.mousemove({ clientX: 150, clientY: 240 });
    assert.equal(mouseX, "50px");
    assert.equal(mouseY, "40px");
    assert.equal(opacity, "1");

    // Simulate mouse leaving the box
    listeners.mouseleave();
    assert.equal(opacity, "0");

    cleanup();
    assert.equal(Object.keys(listeners).length, 0);
  });
});
