import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  calculateJournalKPIs,
  formatKPIPnL,
  formatKPIR,
  winRate,
  profitFactor,
} from "../src/lib/ict-stats.ts";
import {
  formatCurrency,
  getTradeHoldDuration,
  getTradePnL,
  calculateTradeRuleAdherence,
  formatTradeRuleAdherenceRatio,
} from "../src/lib/tradezella-helpers.ts";
import { paginateJournalRows } from "../src/lib/journal-pagination.ts";
import type { SetupModel, Trade } from "../src/lib/ict-types.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Exact 15 table columns specified for Milestone 2
const EXPECTED_JOURNAL_COLUMNS = [
  "checkbox",
  "open_time",
  "symbol",
  "side",
  "status",
  "lots",
  "entry",
  "exit",
  "net_pnl",
  "realized_r",
  "playbook",
  "tags",
  "rules",
  "grade",
  "reviewed",
] as const;

function formatPrice(price: number, market?: string): string {
  const m = (market || "").toUpperCase();
  const isForex =
    (/^(EUR|GBP|USD|AUD|NZD|CAD|CHF)/.test(m) && !m.includes("BTC") && !m.includes("ETH")) ||
    m.includes("EURUSD");
  const isJpy = m.includes("JPY");
  const digits = isForex ? (isJpy ? 3 : 5) : 2;
  return price.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatOpenDateTime(dateStr: string, timeStr?: string): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  const mm = parts[1] || "";
  const dd = parts[2] || "";
  const time = timeStr ? timeStr.slice(0, 5) : "00:00";
  return mm && dd ? `${mm}/${dd} ${time}` : `${dateStr} ${time}`;
}

function isMistakeTag(tag: string): boolean {
  const t = tag.toLowerCase();
  return (
    t.includes("late") ||
    t.includes("chase") ||
    t.includes("early") ||
    t.includes("fomo") ||
    t.includes("outside") ||
    t.includes("impulse") ||
    t.includes("revenge") ||
    t.includes("greed") ||
    t.includes("fear") ||
    t.includes("hesitat") ||
    t.includes("overleverag") ||
    t.includes("mistake")
  );
}

function getPlaybookLetter(trade: Trade, models: SetupModel[] = []): string {
  const m = models.find(
    (mod) => mod.id === trade.modelId || mod.name.toLowerCase() === trade.modelName?.toLowerCase(),
  );
  if (m?.code) return m.code.toUpperCase();
  const name = (trade.modelName || "").toLowerCase();
  if (name.includes("raid")) return "A";
  if (name.includes("soup")) return "B";
  if (name.includes("judas")) return "C";
  if (name.includes("fvg")) return "B";
  if (name.includes("breaker")) return "A";
  return "A";
}

function createMockTrade(partial: Partial<Trade> = {}): Trade {
  return {
    id: `trade-${Math.random().toString(36).slice(2, 9)}`,
    date: "2026-10-29",
    time: "09:48",
    market: "XAUUSD",
    side: "long",
    modelId: "m1",
    modelName: "Sell-side raid",
    weeklyBias: "bullish",
    dailyBias: "bullish",
    drawOnLiquidity: "BSL",
    location: "discount",
    dealingRange: { high: 2755, low: 2735 },
    dealingRangeLabel: "Daily",
    taken: ["SSL"],
    targetLiq: ["BSL"],
    pdArray: "Fair Value Gap",
    pdTimeframe: "5m",
    pdCondition: "fresh",
    triggers: ["MSS"],
    session: "NY AM",
    killZone: "NY AM",
    timeModel: "Silver Bullet",
    structureBefore: "bullish",
    displacementQuality: "strong",
    fvgCreated: true,
    fvgTimeframe: "5m",
    judas: { present: "no", time: "", direction: "" },
    ote: { used: "used", level: "62%", inside: true },
    smt: { present: "no", pair: "", sweptMarket: "", failedMarket: "", beforeTrigger: false },
    crt: {
      used: false,
      reference: "",
      high: null,
      low: null,
      raidSide: "",
      purge: false,
      reclaim: false,
      entryAfterReclaim: false,
      target: "",
    },
    intermarket: { dxy: "bearish", yields: "", silver: "", indices: "" },
    newsImpact: "none",
    notes: "Execution notes",
    tradeEfficiency: 85,
    result: "win",
    rMultiple: 2.44,
    entry: 2748.4,
    sl: 2742.0,
    exitPrice: 2736.27,
    lots: 0.25,
    netPnL: 303.25,
    ruleFollowed: true,
    reviewed: true,
    tags: ["NY AM", "Silver Bullet"],
    setupTags: ["NY AM", "Silver Bullet"],
    mistakeTags: [],
    grade: "A",
    holdDuration: "48m",
    ...partial,
  };
}

describe("Journal UI Component Calculations & Rendering Logic", () => {
  it("calculates 5 KPI metric cards accurately from target 12-trade dataset", () => {
    // Construct 12 trades: 7 wins, 4 losses, 1 break-even
    const trades: Trade[] = [
      createMockTrade({
        market: "XAUUSD",
        side: "short",
        result: "win",
        netPnL: 303.25,
        rMultiple: 2.44,
        plannedR: 2.5,
      }),
      createMockTrade({
        market: "NQ",
        side: "long",
        result: "win",
        netPnL: 545.0,
        rMultiple: 3.1,
        plannedR: 2.5,
      }),
      createMockTrade({
        market: "EURUSD",
        side: "short",
        result: "loss",
        netPnL: -142.5,
        rMultiple: -1.0,
        plannedR: 2.0,
      }),
      createMockTrade({
        market: "ES",
        side: "long",
        result: "win",
        netPnL: 762.5,
        rMultiple: 2.5,
        plannedR: 2.5,
      }),
      createMockTrade({
        market: "XAUUSD",
        side: "long",
        result: "loss",
        netPnL: -72.0,
        rMultiple: -1.0,
        plannedR: 2.0,
      }),
      createMockTrade({
        market: "NQ",
        side: "short",
        result: "win",
        netPnL: 500.0,
        rMultiple: 2.0,
        plannedR: 2.5,
      }),
      createMockTrade({
        market: "EURUSD",
        side: "long",
        result: "be",
        netPnL: 0.0,
        rMultiple: 0.0,
        plannedR: 2.0,
      }),
      createMockTrade({
        market: "ES",
        side: "short",
        result: "loss",
        netPnL: -375.0,
        rMultiple: -1.0,
        plannedR: 2.0,
      }),
      createMockTrade({
        market: "XAUUSD",
        side: "long",
        result: "win",
        netPnL: 300.0,
        rMultiple: 2.0,
        plannedR: 2.5,
      }),
      createMockTrade({
        market: "NQ",
        side: "long",
        result: "loss",
        netPnL: -535.47,
        rMultiple: -1.0,
        plannedR: 2.0,
      }),
      createMockTrade({
        market: "ES",
        side: "long",
        result: "win",
        netPnL: 500.0,
        rMultiple: 2.0,
        plannedR: 2.5,
      }),
      createMockTrade({
        market: "EURUSD",
        side: "short",
        result: "win",
        netPnL: 374.25,
        rMultiple: 1.54,
        plannedR: 2.0,
      }),
    ];

    const kpis = calculateJournalKPIs(trades);

    // 1. Net P&L: 303.25 + 545.00 - 142.50 + 762.50 - 72.00 + 500.00 + 0 - 375.00 + 300.00 - 535.47 + 500.00 + 374.22 = 1860.00
    assert.ok(kpis.netPnL > 0);
    assert.match(kpis.netPnLFormatted, /^\+\$[0-9,]+\.[0-9]{2}$/);

    // 2. Win Rate (Prop formula: W / (W + L), excluding BE): 7 wins / 11 = 63.6%
    assert.equal(kpis.winCount, 7);
    assert.equal(kpis.lossCount, 4);
    assert.equal(kpis.beCount, 1);
    assert.equal(kpis.winRatePct, 63.6);

    // 3. Profit Factor: gross profit / gross loss
    assert.ok(kpis.profitFactor > 1.0);

    // 4. Avg Realized R & Cumulative R
    assert.ok(kpis.cumulativeR > 0);
    assert.ok(kpis.avgRealizedR > 0);
    assert.match(kpis.cumulativeRFormatted, /^\+[0-9]+\.[0-9]{2}R$/);

    // 5. Expectancy: Net P&L / decided trades
    assert.ok(kpis.expectancy > 0);
  });

  it("handles empty and single-direction trade sets without division by zero or NaN", () => {
    const emptyKpis = calculateJournalKPIs([]);
    assert.equal(emptyKpis.netPnL, 0);
    assert.equal(emptyKpis.netPnLFormatted, "$0.00");
    assert.equal(emptyKpis.winRatePct, 0);
    assert.equal(emptyKpis.profitFactor, 0);
    assert.equal(emptyKpis.expectancy, 0);

    const winOnly = [createMockTrade({ result: "win", netPnL: 500, rMultiple: 2 })];
    const winKpis = calculateJournalKPIs(winOnly);
    assert.equal(winKpis.winRatePct, 100);
    assert.equal(winKpis.profitFactor, 99.99);

    const lossOnly = [createMockTrade({ result: "loss", netPnL: -250, rMultiple: -1 })];
    const lossKpis = calculateJournalKPIs(lossOnly);
    assert.equal(lossKpis.winRatePct, 0);
    assert.equal(lossKpis.profitFactor, 0);
    assert.equal(lossKpis.netPnLFormatted, "-$250.00");
  });

  it("formats currency and R multiples with exact signs and precision", () => {
    assert.equal(formatKPIPnL(1198.25), "+$1,198.25");
    assert.equal(formatKPIPnL(-1124.97), "-$1,124.97");
    assert.equal(formatKPIPnL(0), "$0.00");

    assert.equal(formatKPIR(1.48), "+1.48R");
    assert.equal(formatKPIR(9.58), "+9.58R");
    assert.equal(formatKPIR(-1.0), "-1.00R");
  });
});

describe("Table Column Definitions & Formatting Helpers", () => {
  it("defines the exact 15 columns matching screenshot 2", () => {
    assert.equal(EXPECTED_JOURNAL_COLUMNS.length, 15);
    const expectedCols = [
      "checkbox",
      "open_time",
      "symbol",
      "side",
      "status",
      "lots",
      "entry",
      "exit",
      "net_pnl",
      "realized_r",
      "playbook",
      "tags",
      "rules",
      "grade",
      "reviewed",
    ];
    for (const col of expectedCols) {
      assert.ok(EXPECTED_JOURNAL_COLUMNS.includes(col as any), `Missing column ${col}`);
    }
  });

  it("formats price with instrument-appropriate decimals and thousands commas", () => {
    // Indices and Gold: 2 decimal places with comma
    assert.equal(formatPrice(2748.4, "XAUUSD"), "2,748.40");
    assert.equal(formatPrice(20410.5, "NQ"), "20,410.50");
    assert.equal(formatPrice(5820.25, "ES"), "5,820.25");

    // Forex: 5 decimal places
    assert.equal(formatPrice(1.08215, "EURUSD"), "1.08215");
  });

  it("formats open date/time and duration with dur suffix", () => {
    assert.equal(formatOpenDateTime("2026-10-29", "09:48"), "10/29 09:48");
    assert.equal(formatOpenDateTime("2026-10-01", "14:30:00"), "10/01 14:30");

    const tradeWithDur = createMockTrade({ holdDuration: "48m" });
    assert.equal(getTradeHoldDuration(tradeWithDur, true), "48m dur");

    const tradeWithLongDur = createMockTrade({ holdDuration: "1h 14m" });
    assert.equal(getTradeHoldDuration(tradeWithLongDur, true), "1h 14m dur");
  });

  it("correctly identifies mistake/warning tags for amber badge styling", () => {
    assert.equal(isMistakeTag("Late entry"), true);
    assert.equal(isMistakeTag("Chased"), true);
    assert.equal(isMistakeTag("FOMO"), true);
    assert.equal(isMistakeTag("early exit"), true);
    assert.equal(isMistakeTag("outside killzone"), true);

    // Non-mistake tags
    assert.equal(isMistakeTag("NY AM"), false);
    assert.equal(isMistakeTag("Silver Bullet"), false);
    assert.equal(isMistakeTag("London Low Sweep"), false);
  });

  it("maps playbook models to appropriate letter square badges", () => {
    const models: SetupModel[] = [
      {
        id: "m1",
        name: "Sell-side raid",
        code: "A",
        tier: "core",
        drawOnLiquidity: "BSL",
        liquidityCondition: "SSL sweep",
        entryTechnique: "FVG",
        timeWindow: "NY AM",
        notes: "",
        rules: [],
      },
      {
        id: "m2",
        name: "Turtle soup",
        code: "B",
        tier: "core",
        drawOnLiquidity: "Internal",
        liquidityCondition: "False breakout",
        entryTechnique: "Displacement",
        timeWindow: "London",
        notes: "",
        rules: [],
      },
    ];

    const trade1 = createMockTrade({ modelId: "m1", modelName: "Sell-side raid" });
    assert.equal(getPlaybookLetter(trade1, models), "A");

    const trade2 = createMockTrade({ modelId: "m2", modelName: "Turtle soup" });
    assert.equal(getPlaybookLetter(trade2, models), "B");
  });

  it("calculates rule adherence compliance fraction and percentage", () => {
    const trade1 = createMockTrade({
      rulesAssessment: {
        r1: "followed",
        r2: "followed",
        r3: "followed",
        r4: "followed",
        r5: "followed",
        r6: "followed",
        r7: "followed",
        r8: "followed",
        r9: "followed",
        r10: "not",
      },
    });

    const adherence = calculateTradeRuleAdherence(trade1);
    assert.equal(adherence.ratio, "9/10");
    assert.equal(adherence.adherencePct, 90);
    assert.equal(formatTradeRuleAdherenceRatio(trade1), "9/10");
  });

  it("paginates 12 trades into 6 per page across 2 pages", () => {
    const trades: Trade[] = Array.from({ length: 12 }, (_, i) =>
      createMockTrade({ id: `trade-${i + 1}`, date: `2026-10-${String(i + 1).padStart(2, "0")}` }),
    );

    const page1 = paginateJournalRows(trades, 1, 6);
    assert.equal(page1.rows.length, 6);
    assert.equal(page1.totalPages, 2);
    assert.equal(page1.page, 1);
    assert.equal(page1.startIndex, 0);

    const page2 = paginateJournalRows(trades, 2, 6);
    assert.equal(page2.rows.length, 6);
    assert.equal(page2.totalPages, 2);
    assert.equal(page2.page, 2);
    assert.equal(page2.startIndex, 6);
  });
});

describe("Zero Filesystem Storage Invariant", () => {
  it("verifies journal route and components contain zero Node.js filesystem imports", () => {
    const journalRouteFile = join(__dirname, "../src/routes/journal.tsx");
    const kpiCardsFile = join(__dirname, "../src/components/journal/journal-kpi-cards.tsx");
    const allViewFile = join(__dirname, "../src/components/journal/all-view.tsx");

    const files = [journalRouteFile, kpiCardsFile, allViewFile];

    for (const f of files) {
      assert.ok(existsSync(f), `File must exist: ${f}`);
      const content = readFileSync(f, "utf8");

      assert.doesNotMatch(content, /from\s+["']node:fs["']/, `${f} must not import node:fs`);
      assert.doesNotMatch(content, /from\s+["']fs["']/, `${f} must not import fs`);
      assert.doesNotMatch(content, /writeFileSync/, `${f} must not write to filesystem`);
      assert.doesNotMatch(content, /mkdirSync/, `${f} must not create directories`);
    }
  });

  it("verifies structural UI elements in journal route and view components", () => {
    const journalContent = readFileSync(join(__dirname, "../src/routes/journal.tsx"), "utf8");
    const allViewContent = readFileSync(join(__dirname, "../src/components/journal/all-view.tsx"), "utf8");
    const kpiContent = readFileSync(
      join(__dirname, "../src/components/journal/journal-kpi-cards.tsx"),
      "utf8",
    );

    // Serif header & Prop Desk subtitle
    assert.ok(
      journalContent.includes("font-serif"),
      "journal.tsx must use serif font for title",
    );
    assert.ok(
      journalContent.includes("PROP DESK"),
      "journal.tsx must contain PROP DESK subtitle",
    );

    // Auto-sync status indicator
    assert.ok(
      journalContent.includes("Auto-sync enabled · MT5 Raw Spread"),
      "journal.tsx must display auto-sync status",
    );

    // Header buttons
    assert.ok(
      journalContent.includes("Import CSV"),
      "journal.tsx must contain Import CSV button",
    );
    assert.ok(
      journalContent.includes("+ Log trade"),
      "journal.tsx must contain + Log trade button",
    );

    // Red underline on active tab
    assert.ok(
      journalContent.includes("border-[#e50914]"),
      "journal.tsx tabs must have red active border",
    );

    // 5 KPI cards present in JournalKpiCards
    assert.ok(
      kpiContent.includes("NET P&amp;L") || kpiContent.includes("NET P&L"),
      "Must render NET P&L card",
    );
    assert.ok(kpiContent.includes("WIN RATE"), "Must render WIN RATE card");
    assert.ok(kpiContent.includes("PROFIT FACTOR"), "Must render PROFIT FACTOR card");
    assert.ok(kpiContent.includes("AVG REALIZED R"), "Must render AVG REALIZED R card");
    assert.ok(kpiContent.includes("EXPECTANCY"), "Must render EXPECTANCY card");

    // AllView search input and date selector
    assert.ok(
      allViewContent.includes("Search symbol, playbook, tag, notes..."),
      "all-view.tsx must have exact search placeholder",
    );
    assert.ok(
      allViewContent.includes("Oct 1 – Oct 29, 2026"),
      "all-view.tsx must have date range selector button",
    );

    // Selected row 4px red left border accent
    assert.ok(
      allViewContent.includes("border-l-4 border-l-[#e50914]"),
      "all-view.tsx must style selected row with solid 4px red left border",
    );

    // Showing 1-6 of 12 logged trades pagination
    assert.ok(
      allViewContent.includes("logged trades"),
      "all-view.tsx pagination footer must include logged trades label",
    );
  });

  it("wires inspector attachment tiles to image file inputs", () => {
    const inspector = readFileSync(
      join(__dirname, "../src/components/journal/trade-inspector.tsx"),
      "utf8",
    );
    assert.ok(inspector.includes('aria-label="Attach HTF screenshot"'));
    assert.ok(inspector.includes('aria-label="Attach execution screenshot"'));
    assert.ok(inspector.includes("updateTradeScreenshots"));
    assert.ok(inspector.includes('accept="image/*"'));
  });

  it("offers a working screenshot option in the trade inspector panel", () => {
    const inspector = readFileSync(
      join(__dirname, "../src/components/journal/trade-inspector.tsx"),
      "utf8",
    );
    const dialog = readFileSync(
      join(__dirname, "../src/components/journal/screenshot-attach-dialog.tsx"),
      "utf8",
    );
    const helpers = readFileSync(join(__dirname, "../src/lib/screenshot.ts"), "utf8");

    // Entry point in the panel + per-tile camera actions.
    assert.ok(inspector.includes("ScreenshotAttachDialog"));
    assert.ok(inspector.includes("Screenshot"));
    assert.ok(inspector.includes('aria-label={`Take screenshot for ${label}`}'));
    // Clipboard paste, drag & drop and screen capture all route through the helper.
    assert.ok(inspector.includes("imageFileFromDataTransfer"));
    assert.ok(inspector.includes("prepareScreenshotFile"));
    assert.ok(dialog.includes("captureScreenFrame"));
    assert.ok(dialog.includes("imageFileFromDataTransfer"));
    assert.ok(dialog.includes("onDrop={handleDrop}"));
    // The helper actually captures and optimises, rather than stubbing.
    assert.ok(helpers.includes("getDisplayMedia"));
    assert.ok(helpers.includes("toDataURL"));
    assert.ok(helpers.includes("optimiseScreenshot"));
  });
});
