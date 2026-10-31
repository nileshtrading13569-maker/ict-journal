import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appShellPath = path.resolve(__dirname, "../src/components/layout/app-shell.tsx");
const gatesPath = path.resolve(__dirname, "../src/lib/auth/gates.tsx");

describe("Sidebar Animation and Alignment Invariants", () => {
  const appShellContent = fs.readFileSync(appShellPath, "utf-8");
  const gatesContent = fs.readFileSync(gatesPath, "utf-8");

  it("app-shell sets px-[13px] on desktop aside to mathematically center 40px icon in 68px width", () => {
    // 68px outer width - 2px borders - 26px padding (13px * 2) = 40px exact content
    // Icon center = 1px border + 13px padding + 20px = 34px (exactly 68 / 2)
    assert.match(appShellContent, /px-\[13px\] py-3\.5/);
    assert.match(appShellContent, /w-60.*w-\[68px\]/);
  });

  it("app-shell isolates width transition on aside container avoiding GPU filter churn", () => {
    assert.match(appShellContent, /transition-\[width\] duration-300 ease-\[cubic-bezier\(0\.16,1,0\.3,1\)\] will-change-\[width\]/);
  });

  it("app-shell nav uses negative margins to prevent active indicator clipping while maintaining 34px track", () => {
    // -mx-2 px-2 expands nav clip boundary by 8px on left/right while child links stay anchored
    assert.match(appShellContent, /overflow-y-auto overflow-x-hidden.*-mx-2 px-2/);
    // Active indicator at -left-1 (4px offset) remains 4px inside nav boundary (8px offset) and inside aside
    assert.match(appShellContent, /absolute -left-1 top-1\/2 -translate-y-1\/2 h-5 w-1 rounded-full bg-accent/);
  });

  it("app-shell active indicator transitions smoothly without abrupt DOM unmounting", () => {
    assert.match(appShellContent, /transition-\[opacity,transform\] duration-200 ease-out will-change-\[transform,opacity\]/);
    assert.match(appShellContent, /active \? "opacity-100 scale-y-100" : "opacity-0 scale-y-50"/);
  });

  it("app-shell day status badge uses single-cell CSS Grid overlay without position: absolute swapping", () => {
    assert.match(appShellContent, /grid grid-cols-1 grid-rows-1 h-8 w-full items-center/);
    assert.match(appShellContent, /col-start-1 row-start-1.*Day \{day\}/s);
    assert.match(appShellContent, /col-start-1 row-start-1.*animate-ping/s);
    // Verify neither view dynamically switches to "absolute inset-0"
    assert.doesNotMatch(appShellContent, /pointer-events-none absolute inset-0/);
  });

  it("app-shell nav and control label spans have min-w-0 for unconstrained flex shrink", () => {
    assert.match(appShellContent, /min-w-0 overflow-hidden whitespace-nowrap text-\[13px\]/);
    assert.match(appShellContent, /min-w-0 overflow-hidden whitespace-nowrap text-\[12\.5px\].*Live room/s);
    assert.match(appShellContent, /min-w-0 overflow-hidden whitespace-nowrap text-\[12\.5px\].*Settings/s);
  });

  it("gates UserButton removes discrete justify-center jump and locks avatar to stable track", () => {
    assert.doesNotMatch(gatesContent, /collapsed \? "justify-center" : ""/);
    assert.match(gatesContent, /flex size-10 shrink-0 items-center justify-center/);
    assert.match(gatesContent, /min-w-0 flex-1 overflow-hidden whitespace-nowrap transition-\[max-width,opacity,transform,margin\]/);
  });
});
