// Universal Red Pointer Spotlight & Border Glow Engine
// Provides GPU-accelerated cursor tracking across buttons, cards, and UI surfaces.

let isListenerActive = false;
let currentTarget: HTMLElement | null = null;

export function initGlobalSpotlightListener(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (isListenerActive) return;

  // Verify pointer device supports hover
  const canHover = window.matchMedia("(hover: hover)").matches;
  if (!canHover) return;

  const selector = '.spotlight-red, .btn-spotlight-red, [data-spotlight="red"], button:not([data-no-spotlight]):not(.no-spotlight), .kpi-card-glow, .stat-tile-glow';

  const onPointerMove = (e: PointerEvent) => {
    const target = (e.target as HTMLElement | null)?.closest(selector) as HTMLElement | null;

    if (target !== currentTarget) {
      if (currentTarget) {
        currentTarget.style.setProperty("--spotlight-opacity", "0");
      }
      currentTarget = target;
    }

    if (currentTarget) {
      const rect = currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      currentTarget.style.setProperty("--mouse-x", `${x}px`);
      currentTarget.style.setProperty("--mouse-y", `${y}px`);
      currentTarget.style.setProperty("--spotlight-opacity", "1");
    }
  };

  const onPointerLeave = () => {
    if (currentTarget) {
      currentTarget.style.setProperty("--spotlight-opacity", "0");
      currentTarget = null;
    }
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
    el.style.setProperty("--mouse-x", `${x}px`);
    el.style.setProperty("--mouse-y", `${y}px`);
    el.style.setProperty("--spotlight-opacity", "1");
  };

  const onLeave = () => {
    el.style.setProperty("--spotlight-opacity", "0");
  };

  el.addEventListener("mousemove", onMove, { passive: true });
  el.addEventListener("mouseleave", onLeave, { passive: true });

  return () => {
    el.removeEventListener("mousemove", onMove);
    el.removeEventListener("mouseleave", onLeave);
  };
}
