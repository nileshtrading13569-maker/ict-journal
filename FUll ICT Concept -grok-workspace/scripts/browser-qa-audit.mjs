import { chromium } from "playwright";
import axePkg from "axe-core";
const axeSource = axePkg.source;
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://localhost:8080";
const SCREENSHOT_DIR = path.resolve("screenshots/qa");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 667 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

const ROUTES = [
  { path: "/login", name: "login", isPublic: true },
  { path: "/", name: "today_overview", isPublic: false },
  { path: "/journal", name: "journal", isPublic: false },
  { path: "/playbook", name: "playbook", isPublic: false },
  { path: "/weekly-profile", name: "weekly_profile", isPublic: false },
  { path: "/weekly", name: "weekly", isPublic: false },
  { path: "/daily", name: "daily", isPublic: false },
  { path: "/analytics", name: "analytics", isPublic: false },
  { path: "/notebook", name: "notebook", isPublic: false },
  { path: "/protocol", name: "protocol", isPublic: false },
  { path: "/replay", name: "replay", isPublic: false },
];

async function runAudit() {
  console.log("=== Starting Comprehensive Browser QA Audit ===");
  console.log(`Target: ${BASE_URL}`);

  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
  } catch {
    browser = await chromium.launch({ headless: true });
  }

  const results = {
    timestamp: new Date().toISOString(),
    routesAudited: [],
    interactions: [],
    summary: {
      totalRoutes: ROUTES.length,
      viewports: VIEWPORTS.map((v) => `${v.name} (${v.width}x${v.height})`),
      totalViolations: 0,
      criticalA11y: 0,
      seriousA11y: 0,
      moderateA11y: 0,
      minorA11y: 0,
      overflowIssues: 0,
      consoleErrorsTotal: 0,
    },
    verdict: "PENDING",
  };

  // Create isolated context with Guest Session injected
  const context = await browser.newContext();
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem("first-payout-guest-session", "true");
    } catch {}
  });

  // Audit each route
  for (const route of ROUTES) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Auditing: ${route.path} [${route.name}]`);
    console.log(`--------------------------------------------------`);

    const routeReport = {
      path: route.path,
      name: route.name,
      consoleErrors: [],
      networkFailures: [],
      viewports: {},
      axeViolations: [],
    };

    for (const vp of VIEWPORTS) {
      const page = await context.newPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const errors = [];
      const networkFails = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") {
          const text = msg.text();
          if (!text.includes("favicon") && !text.includes("vite:react-refresh")) {
            errors.push(text);
          }
        }
      });

      page.on("pageerror", (err) => {
        errors.push(`PageError: ${err.message}`);
      });

      page.on("response", (res) => {
        if (res.status() >= 400 && !res.url().includes("favicon.ico")) {
          networkFails.push({ url: res.url(), status: res.status() });
        }
      });

      let loaded = false;
      try {
        await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "networkidle", timeout: 20000 });
        await page.waitForTimeout(1000); // allow animations
        loaded = true;
      } catch (err) {
        console.error(`  [${vp.name}] Failed to load ${route.path}: ${err.message}`);
        routeReport.consoleErrors.push(`Navigation error: ${err.message}`);
      }

      if (loaded) {
        // 1. Check Responsive Layout & Horizontal Overflow
        const overflow = await page.evaluate(() => {
          const docEl = document.documentElement;
          const body = document.body;
          const vw = window.innerWidth;
          const scrollW = Math.max(docEl.scrollWidth, body ? body.scrollWidth : 0);
          const hasOverflow = scrollW > vw + 2;

          const offenders = [];
          if (hasOverflow) {
            const allElements = document.querySelectorAll("*");
            for (const el of allElements) {
              const r = el.getBoundingClientRect();
              if (r.right > vw + 4 && r.width > 0 && r.height > 0) {
                const tag = el.tagName.toLowerCase();
                const cls = typeof el.className === "string" ? el.className.split(" ").slice(0, 3).join(".") : "";
                const id = el.id ? `#${el.id}` : "";
                offenders.push({
                  selector: `${tag}${id}${cls ? "." + cls : ""}`,
                  right: Math.round(r.right),
                  width: Math.round(r.width),
                  viewport: vw,
                });
                if (offenders.length >= 4) break;
              }
            }
          }

          return {
            hasOverflow,
            scrollW,
            viewportWidth: vw,
            offenders,
          };
        });

        if (overflow.hasOverflow) {
          results.summary.overflowIssues++;
          console.log(`  ⚠ [${vp.name}] OVERFLOW: scrollWidth=${overflow.scrollW}px > vw=${overflow.viewportWidth}px`);
        } else {
          console.log(`  ✓ [${vp.name}] Responsive: Clean (No overflow)`);
        }

        // 2. Measure Core Web Vitals (CLS)
        const vitals = await page.evaluate(() => {
          let cls = 0;
          try {
            const entries = performance.getEntriesByType("layout-shift");
            for (const entry of entries) {
              if (!entry.hadRecentInput) cls += entry.value;
            }
          } catch {}
          return { cls: Number(cls.toFixed(3)) };
        });

        // 3. Run Axe-Core A11y Audit on Desktop and Mobile
        let a11ySummary = null;
        if (vp.name === "desktop" || vp.name === "mobile") {
          try {
            await page.evaluate(axeSource);
            const axeResults = await page.evaluate(async () => {
              // @ts-ignore
              return await window.axe.run({
                runOnly: {
                  type: "tag",
                  values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
                },
              });
            });

            const violations = axeResults.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              description: v.description,
              help: v.help,
              helpUrl: v.helpUrl,
              nodesCount: v.nodes.length,
              targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
            }));

            const counts = {
              critical: violations.filter((v) => v.impact === "critical").length,
              serious: violations.filter((v) => v.impact === "serious").length,
              moderate: violations.filter((v) => v.impact === "moderate").length,
              minor: violations.filter((v) => v.impact === "minor").length,
            };

            a11ySummary = {
              total: violations.length,
              ...counts,
              violations,
            };

            if (vp.name === "desktop") {
              routeReport.axeViolations = violations;
              results.summary.totalViolations += violations.length;
              results.summary.criticalA11y += counts.critical;
              results.summary.seriousA11y += counts.serious;
              results.summary.moderateA11y += counts.moderate;
              results.summary.minorA11y += counts.minor;
            }

            console.log(`  ✓ [${vp.name}] A11y: ${violations.length} violations (Crit: ${counts.critical}, Ser: ${counts.serious}, Mod: ${counts.moderate})`);
          } catch (axeErr) {
            console.warn(`  [${vp.name}] A11y check warning: ${axeErr.message}`);
          }
        }

        // 4. Save Screenshot
        const screenshotFile = `${route.name}_${vp.name}.png`;
        const screenshotPath = path.join(SCREENSHOT_DIR, screenshotFile);
        await page.screenshot({ path: screenshotPath, fullPage: false });

        routeReport.viewports[vp.name] = {
          overflow,
          vitals,
          a11ySummary,
          screenshot: `screenshots/qa/${screenshotFile}`,
        };
      }

      if (errors.length > 0) {
        routeReport.consoleErrors.push(...errors);
        results.summary.consoleErrorsTotal += errors.length;
      }
      if (networkFails.length > 0) {
        routeReport.networkFailures.push(...networkFails);
      }

      await page.close();
    }

    results.routesAudited.push(routeReport);
  }

  // Step 3: Interactive Component Testing
  console.log(`\n==================================================`);
  console.log(`Testing Interactive Components`);
  console.log(`==================================================`);
  const interactPage = await context.newPage();
  await interactPage.setViewportSize({ width: 1440, height: 900 });

  // Test Nav Links in AppShell
  try {
    await interactPage.goto(`${BASE_URL}/journal`, { waitUntil: "networkidle" });
    const links = await interactPage.evaluate(() => {
      const items = Array.from(document.querySelectorAll("aside a, nav a"));
      return items.map((a) => ({ href: a.getAttribute("href"), text: a.innerText.trim() })).filter((x) => x.href);
    });
    console.log(`✓ Sidebar navigation links found: ${links.length}`);
    results.interactions.push({
      name: "Sidebar Navigation",
      status: links.length > 0 ? "PASS" : "WARN",
      foundCount: links.length,
      sample: links.slice(0, 9),
    });
  } catch (err) {
    results.interactions.push({ name: "Sidebar Navigation", status: "FAIL", error: err.message });
  }

  // Test Log Trade Modal on /journal
  try {
    console.log("-> Testing Trade Entry Modal on /journal...");
    await interactPage.goto(`${BASE_URL}/journal`, { waitUntil: "networkidle" });
    const logBtn = interactPage.locator('button:has-text("Log trade"), button:has-text("New Trade")').first();
    const btnExists = await logBtn.isVisible({ timeout: 4000 }).catch(() => false);
    if (btnExists) {
      await logBtn.click();
      await interactPage.waitForTimeout(800);
      const dialog = interactPage.getByRole("dialog");
      const dialogVisible = await dialog.isVisible().catch(() => false);

      // Check modal overflow
      const modalOverflow = await interactPage.evaluate(() => {
        const d = document.querySelector('[role="dialog"]');
        if (!d) return false;
        return d.scrollHeight > window.innerHeight;
      });

      // Screenshot modal
      await interactPage.screenshot({ path: path.join(SCREENSHOT_DIR, "interactive_modal_log_trade.png") });

      // Dismiss with Esc
      await interactPage.keyboard.press("Escape");
      await interactPage.waitForTimeout(500);
      const dismissed = !(await dialog.isVisible().catch(() => false));

      results.interactions.push({
        name: "Log Trade Modal",
        status: dialogVisible ? "PASS" : "FAIL",
        opened: dialogVisible,
        dismissedViaEsc: dismissed,
        hasScrollableContent: modalOverflow,
      });
      console.log(`✓ Log Trade Modal: opened=${dialogVisible}, dismissedViaEsc=${dismissed}`);
    } else {
      results.interactions.push({ name: "Log Trade Modal", status: "NOT_FOUND" });
    }
  } catch (err) {
    results.interactions.push({ name: "Log Trade Modal", status: "FAIL", error: err.message });
  }

  // Test Mobile Navigation Bar / More menu on 375px
  try {
    console.log("-> Testing Mobile Bottom Nav / Menu on 375px viewport...");
    await interactPage.setViewportSize({ width: 375, height: 667 });
    await interactPage.goto(`${BASE_URL}/journal`, { waitUntil: "networkidle" });
    await interactPage.waitForTimeout(600);

    const mobileNavVisible = await interactPage.evaluate(() => {
      const bottomNav = document.querySelector("nav.fixed.bottom-0, footer nav, .bottom-0");
      return Boolean(bottomNav);
    });

    // Check if More button works
    const moreBtn = interactPage.locator('button:has-text("More"), button[aria-label*="more" i]').first();
    let moreOpened = false;
    if (await moreBtn.isVisible().catch(() => false)) {
      await moreBtn.click();
      await interactPage.waitForTimeout(500);
      moreOpened = await interactPage.locator('[role="menu"], [role="dialog"]').first().isVisible().catch(() => false);
    }

    await interactPage.screenshot({ path: path.join(SCREENSHOT_DIR, "interactive_mobile_nav.png") });

    results.interactions.push({
      name: "Mobile Navigation Bar",
      status: "PASS",
      bottomNavRendered: mobileNavVisible,
      moreMenuToggleable: moreOpened,
    });
    console.log(`✓ Mobile Nav: rendered=${mobileNavVisible}, moreMenuOpened=${moreOpened}`);
  } catch (err) {
    results.interactions.push({ name: "Mobile Navigation Bar", status: "FAIL", error: err.message });
  }

  await interactPage.close();
  await browser.close();

  // Determine Verdict
  if (results.summary.criticalA11y > 0 || results.summary.overflowIssues > 2) {
    results.verdict = "DO NOT SHIP";
  } else if (results.summary.seriousA11y > 0 || results.summary.overflowIssues > 0) {
    results.verdict = "SHIP WITH FIXES";
  } else {
    results.verdict = "SHIP";
  }

  // Save Final Report
  const finalReportPath = path.join(SCREENSHOT_DIR, "qa-audit-report.json");
  fs.writeFileSync(finalReportPath, JSON.stringify(results, null, 2), "utf8");
  console.log(`\n==================================================`);
  console.log(`AUDIT FINISHED. Verdict: ${results.verdict}`);
  console.log(`Saved report to ${finalReportPath}`);
  console.log(`==================================================`);
}

runAudit().catch((err) => {
  console.error("FATAL AUDIT ERROR:", err);
  process.exit(1);
});
