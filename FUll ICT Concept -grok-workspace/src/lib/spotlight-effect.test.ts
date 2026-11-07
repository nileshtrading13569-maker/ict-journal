import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { initGlobalSpotlightListener, attachSpotlightToElement } from "./spotlight-effect.ts";

describe("Universal Red Spotlight Engine", () => {
  it("safely handles initGlobalSpotlightListener in SSR without window or document", () => {
    assert.doesNotThrow(() => {
      initGlobalSpotlightListener();
    });
  });

  it("safely handles attachSpotlightToElement when element is null", () => {
    assert.doesNotThrow(() => {
      const cleanup = attachSpotlightToElement(null);
      assert.equal(typeof cleanup, "function");
      cleanup();
    });
  });

  it("attaches mouse event listeners and sets properties when element is provided", () => {
    let mouseX = "";
    let mouseY = "";
    let opacity = "";
    const listeners: Record<string, Function> = {};

    const mockElement = {
      style: {
        setProperty: (key: string, val: string) => {
          if (key === "--mouse-x") mouseX = val;
          if (key === "--mouse-y") mouseY = val;
          if (key === "--spotlight-opacity") opacity = val;
        },
      },
      getBoundingClientRect: () => ({
        left: 50,
        top: 100,
        width: 200,
        height: 50,
      }),
      addEventListener: (evt: string, fn: Function) => {
        listeners[evt] = fn;
      },
      removeEventListener: (evt: string) => {
        delete listeners[evt];
      },
    } as unknown as HTMLElement;

    const cleanup = attachSpotlightToElement(mockElement);
    assert.ok(listeners.mousemove, "mousemove listener registered");
    assert.ok(listeners.mouseleave, "mouseleave listener registered");

    // Simulate mouse move
    listeners.mousemove({ clientX: 75, clientY: 120 });
    assert.equal(mouseX, "25px");
    assert.equal(mouseY, "20px");
    assert.equal(opacity, "1");

    // Simulate mouse leave
    listeners.mouseleave();
    assert.equal(opacity, "0");

    cleanup();
    assert.equal(Object.keys(listeners).length, 0);
  });
});
