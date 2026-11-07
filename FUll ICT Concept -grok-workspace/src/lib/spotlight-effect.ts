// Universal Red Pointer Spotlight & Border Glow Engine
// Provides GPU-accelerated cursor tracking across every box, card, panel, and button in the app.

let isListenerActive = false;
let activeElements = new Set<HTMLElement>();

export const BOX_SPOTLIGHT_SELECTOR = [
  '.spotlight-red',
  '.btn-spotlight-red',
  '[data-spotlight="red"]',
  'button:not([data-no-spotlight]):not(.no-spotlight)',
  'section',
  'article',
  'div[class*="rounded-"][class*="border"]:not(.fixed):not([class*="fixed"])',
  'div[class*="rounded"][class*="border"]:not(.fixed):not([class*="fixed"])',
  'div[class*="rounded-2xl"]:not(.fixed):not([class*="fixed"])',
  'div[class*="rounded-xl"]:not(.fixed):not([class*="fixed"])',
  'div[class*="rounded-lg"]:not(.fixed):not([class*="fixed"])',
  'div[class*="rounded-md"]:not(.fixed):not([class*="fixed"])',
  'li[class*="rounded-"][class*="border"]',
  'li[class*="rounded"][class*="border"]',
  '.kpi-card',
  '.stat-tile',
  '[class*="bg-card"][class*="border"]',
  '[class*="bg-surface"][class*="border"]',
].join(', ');

export function initGlobalSpotlightListener(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (isListenerActive) return;

  const onPointerMove = (e: PointerEvent) => {
    const newActive = new Set<HTMLElement>();
    let el = e.target as HTMLElement | null;

    // Walk up the DOM tree from mouse position to capture both inner controls and outer box/card containers
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.matches && el.matches(BOX_SPOTLIGHT_SELECTOR)) {
        newActive.add(el);

        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (el.style && typeof el.style.setProperty === "function") {
          el.style.setProperty("--mouse-x", `${x}px`);
          el.style.setProperty("--mouse-y", `${y}px`);
          el.style.setProperty("--spotlight-opacity", "1");
        }
      }
      el = el.parentElement;
    }

    // Smoothly fade out elements that the mouse has left
    for (const prev of activeElements) {
      if (!newActive.has(prev)) {
        if (prev.style && typeof prev.style.setProperty === "function") {
          prev.style.setProperty("--spotlight-opacity", "0");
        }
      }
    }

    activeElements = newActive;
  };

  const onPointerLeave = () => {
    for (const el of activeElements) {
      if (el.style && typeof el.style.setProperty === "function") {
        el.style.setProperty("--spotlight-opacity", "0");
      }
    }
    activeElements.clear();
  };

  document.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("pointerleave", onPointerLeave, { passive: true });
  window.addEventListener("blur", onPointerLeave, { passive: true });

  isListenerActive = true;
}

export function attachSpotlightToElement(el: HTMLElement | null): () => void {
  if (!el) return () => {};

  const onMove = (e: MouseEvent) => {
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (el.style && typeof el.style.setProperty === "function") {
      el.style.setProperty("--mouse-x", `${x}px`);
      el.style.setProperty("--mouse-y", `${y}px`);
      el.style.setProperty("--spotlight-opacity", "1");
    }
  };

  const onLeave = () => {
    if (el.style && typeof el.style.setProperty === "function") {
      el.style.setProperty("--spotlight-opacity", "0");
    }
  };

  el.addEventListener("mousemove", onMove, { passive: true });
  el.addEventListener("mouseleave", onLeave, { passive: true });

  return () => {
    el.removeEventListener("mousemove", onMove);
    el.removeEventListener("mouseleave", onLeave);
  };
}
