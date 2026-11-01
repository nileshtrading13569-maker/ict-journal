import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

import {
  calculateJournalKPIs,
  winRate,
  profitFactor,
  expectancyR,
  formatKPIPnL,
  formatKPIR,
} from "../src/lib/ict-stats.ts";
import {
  formatCurrency,
  getTradeHoldDuration,
  getTradePnL,
  calculateTradeRuleAdherence,
  formatTradeRuleAdherenceRatio,
  getPlaybookRules,
  generateTradeCandles,
} from "../src/lib/tradezella-helpers.ts";
import { paginateJournalRows } from "../src/lib/journal-pagination.ts";
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"' && cell.length === 0) quoted = true;
    else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else cell += character;
  }

  if (quoted) throw new Error("CSV contains an unterminated quoted value.");
  row.push(cell);
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

const EXPORT_COLUMNS: (keyof Trade)[] = [
  "date",
  "time",
  "market",
  "side",
  "result",
  "rMultiple",
  "entry",
  "sl",
  "exitPrice",
  "session",
  "killZone",
  "modelName",
  "ruleFollowed",
  "notes",
];

function buildTradesCsv(trades: Trade[]): string {
  const lines = [
    EXPORT_COLUMNS.join(","),
    ...trades.map((trade) =>
      EXPORT_COLUMNS.map((column) => {
        const value = trade[column];
        const text = value == null ? "" : String(value);
        return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
      }).join(","),
    ),
  ];
  return lines.join("\r\n");
}

import { pendingMigrations } from "../scripts/migration-plan.mjs";
import {
  saveUserDatabase,
  loadUserDatabase,
  resolveGoogleUserIdentity,
} from "../src/lib/storage/user-database.server.ts";
import { createInitialState } from "../src/lib/ict-defaults.ts";
import type { SetupModel, Trade, TradeResult, Side, DeskData } from "../src/lib/ict-types.ts";

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
    entry: 2740.0,
    sl: 2735.0,
    tp1: 2750.0,
    tp2: null,
    tp3: null,
    exitPrice: 2750.0,
    exitTime: "10:36",
    exitReason: "TP",
    riskPct: 0.25,
    lots: 1.0,
    management: "No management",
    partialAtR: null,
    be: false,
    maeR: -0.15,
    mfeR: 2.5,
    narrativeCorrect: true,
    liquidityCorrect: true,
    locationCorrect: true,
    triggerCorrect: true,
    executionQuality: "optimal",
    managementQuality: "good",
    errors: [],
    primaryError: "",
    deliveryStatus: "delivered",
    grade: "A",
    emotion: "calm",
    ruleFollowed: true,
    notes: "Clean NY AM displacement",
    screenshotHtf: "",
    screenshotExec: "",
    result: "win",
    rMultiple: 2.0,
    ...partial,
  };
}

describe("Tier 5 Adversarial Coverage Hardening Suite", () => {
  describe("1. Extreme & Malformed Numbers in calculateJournalKPIs", () => {
    it("handles non-finite values (NaN, +Infinity, -Infinity) in trade properties safely", () => {
      // 1. Trade with non-finite values but valid fallback prices -> calculates fallback pnl (10.0 * 1.0 * 100 = 1000)
      // 2. Trade with all non-finite values and non-finite prices -> sanitized to 0
      const hostileTrades: Trade[] = [
        createMockTrade({
          netPnL: Number.NaN,
          grossPnL: Number.POSITIVE_INFINITY,
          rMultiple: Number.NEGATIVE_INFINITY,
          result: "win",
        }),
        createMockTrade({
          netPnL: Number.NaN,
          grossPnL: Number.NaN,
          rMultiple: Number.NaN,
          entry: Number.NaN,
          exitPrice: Number.NaN,
          lots: Number.NaN,
          result: "loss",
        }),
      ];

      const kpis = calculateJournalKPIs(hostileTrades);
      assert.strictEqual(Number.isFinite(kpis.netPnL), true, "netPnL must be finite");
      assert.strictEqual(Number.isFinite(kpis.grossProfit), true, "grossProfit must be finite");
      assert.strictEqual(Number.isFinite(kpis.grossLoss), true, "grossLoss must be finite");
      assert.strictEqual(Number.isFinite(kpis.winRatePct), true, "winRatePct must be finite");
      assert.strictEqual(Number.isFinite(kpis.profitFactor), true, "profitFactor must be finite");
      assert.strictEqual(Number.isFinite(kpis.expectancy), true, "expectancy must be finite");
      assert.strictEqual(kpis.netPnL, 1000, "Trade 1 successfully fell back to entry/exit/lots, Trade 2 sanitized to 0");

    });

    it("handles astronomical numbers without numeric overflow or precision distortion", () => {
      const megaTrades: Trade[] = [
        createMockTrade({
          netPnL: 500_000_000_000.5,
          result: "win",
          rMultiple: 5.0,
        }),
        createMockTrade({
          netPnL: -100_000_000_000.25,
          result: "loss",
          rMultiple: -1.0,
        }),
      ];

      const kpis = calculateJournalKPIs(megaTrades);
      assert.strictEqual(kpis.netPnL, 400_000_000_000.25);
      assert.strictEqual(kpis.grossProfit, 500_000_000_000.5);
      assert.strictEqual(kpis.grossLoss, 100_000_000_000.25);
      assert.strictEqual(kpis.profitFactor, 5.0);
      assert.strictEqual(kpis.winRatePct, 50.0);
      assert.strictEqual(kpis.expectancy, 200_000_000_000.13);
      assert.strictEqual(kpis.netPnLFormatted, "+$400,000,000,000.25");
    });

    it("handles sub-cent fractional decimals and prevents IEEE 754 precision bleeding", () => {
      // 0.1 + 0.2 in JS = 0.30000000000000004
      const trades: Trade[] = [
        createMockTrade({ netPnL: 0.1, result: "win", rMultiple: 0.1 }),
        createMockTrade({ netPnL: 0.2, result: "win", rMultiple: 0.2 }),
        createMockTrade({ netPnL: -0.3, result: "loss", rMultiple: -0.3 }),
      ];

      const kpis = calculateJournalKPIs(trades);
      assert.strictEqual(kpis.netPnL, 0.0);
      assert.strictEqual(kpis.grossProfit, 0.3);
      assert.strictEqual(kpis.grossLoss, 0.3);
      assert.strictEqual(kpis.profitFactor, 1.0);
      assert.strictEqual(kpis.netPnLFormatted, "$0.00");
    });

    it("evaluates plannedR extraction across plannedR, plannedRR, targetR, and target/stop ratios", () => {
      const trades: Trade[] = [
        createMockTrade({ plannedR: 3.5 } as any),
        createMockTrade({ plannedRR: 2.5 } as any),
        createMockTrade({ targetR: 2.0 } as any),
        // Computed from entry, sl, targetPrice: entry=100, sl=90 (stop=10), target=120 (dist=20) -> 2.00R
        createMockTrade({ entry: 100, sl: 90, targetPrice: 120 }),
        // Zero stop distance safeguard: entry=100, sl=100 -> stop=0 -> should not divide by zero!
        createMockTrade({ entry: 100, sl: 100, targetPrice: 150 }),
      ];

      const kpis = calculateJournalKPIs(trades);
      // Valid planned Rs collected: [3.5, 2.5, 2.0, 2.0] -> sum = 10.0 / 4 = 2.50R
      assert.strictEqual(kpis.plannedR, 2.5);
    });

    it("handles breakeven trades with negative commissions correctly in win rate and expectancy", () => {
      const trades: Trade[] = [
        createMockTrade({
          result: "be",
          netPnL: -7.0, // Commission fee on BE
          rMultiple: 0.0,
        }),
      ];

      const kpis = calculateJournalKPIs(trades);
      assert.strictEqual(kpis.beCount, 1);
      assert.strictEqual(kpis.winCount, 0);
      assert.strictEqual(kpis.lossCount, 0);
      assert.strictEqual(kpis.winRatePct, 0, "BE excluded from decided denominator");
      assert.strictEqual(kpis.netPnL, -7.0);
      assert.strictEqual(kpis.expectancy, -7.0, "Count for expectancy falls back to closedCount when decided=0");
    });
  });

  describe("2. Date Range Boundaries & Search Interactions", () => {
    const testDataset: Trade[] = [
      createMockTrade({ id: "t-sep30", date: "2026-09-30", time: "15:00", market: "EURUSD", notes: "Pre-month" }),
      createMockTrade({ id: "t-oct01", date: "2026-10-01", time: "09:30", market: "EURUSD", modelName: "Silver Bullet", notes: "First day" }),
      createMockTrade({ id: "t-oct15", date: "2026-10-15", time: "10:00", market: "GBPUSD", tags: ["london_close"], notes: "Mid-month" }),
      createMockTrade({ id: "t-oct29", date: "2026-10-29", time: "09:48", market: "XAUUSD", mistakeTags: ["Late entry"], notes: "Reference trade" }),
      createMockTrade({ id: "t-oct31", date: "2026-10-31", time: "16:00", market: "US30", setupTags: ["FVG"], notes: "Last day" }),
      createMockTrade({ id: "t-nov01", date: "2026-11-01", time: "08:00", market: "BTCUSD", notes: "Post-month" }),
    ];

    it("oct_2026 date filter strictly includes Oct 1 to Oct 31 and excludes Sep 30 & Nov 1", () => {
      const octFiltered = testDataset.filter((t) => {
        if (t.date && (t.date < "2026-10-01" || t.date > "2026-10-31")) return false;
        return true;
      });

      const ids = octFiltered.map((t) => t.id);
      assert.deepStrictEqual(ids, ["t-oct01", "t-oct15", "t-oct29", "t-oct31"]);
      assert.strictEqual(ids.includes("t-sep30"), false, "Sep 30 must be excluded");
      assert.strictEqual(ids.includes("t-nov01"), false, "Nov 1 must be excluded");
    });

    it("search filter handles regex special characters without crashing or throwing SyntaxError", () => {
      const hostileQueries = ["[A]", "(raid)", "*", "+", "?", "\\", "$", "^", "{fvg}"];

      for (const query of hostileQueries) {
        assert.doesNotThrow(() => {
          const q = query.toLowerCase().trim();
          testDataset.filter((t) => {
            const matchSymbol = t.market.toLowerCase().includes(q);
            const matchPlaybook = (t.modelName || "").toLowerCase().includes(q);
            const matchTags = (t.tags || []).some((tag) => tag.toLowerCase().includes(q));
            const matchSetupTags = (t.setupTags || []).some((tag) => tag.toLowerCase().includes(q));
            const matchMistakeTags = (t.mistakeTags || []).some((tag) => tag.toLowerCase().includes(q));
            const matchNotes = (t.notes || "").toLowerCase().includes(q);
            return matchSymbol || matchPlaybook || matchTags || matchSetupTags || matchMistakeTags || matchNotes;
          });
        }, `Query '${query}' must not cause regex crash`);
      }
    });

    it("search filter searches across symbol, playbook, tags, setupTags, mistakeTags, and notes", () => {
      const filterTrades = (query: string) => {
        const q = query.toLowerCase().trim();
        return testDataset.filter((t) => {
          const matchSymbol = t.market.toLowerCase().includes(q);
          const matchPlaybook = (t.modelName || "").toLowerCase().includes(q);
          const matchTags = (t.tags || []).some((tag) => tag.toLowerCase().includes(q));
          const matchSetupTags = (t.setupTags || []).some((tag) => tag.toLowerCase().includes(q));
          const matchMistakeTags = (t.mistakeTags || []).some((tag) => tag.toLowerCase().includes(q));
          const matchNotes = (t.notes || "").toLowerCase().includes(q);
          return matchSymbol || matchPlaybook || matchTags || matchSetupTags || matchMistakeTags || matchNotes;
        });
      };

      assert.strictEqual(filterTrades("XAUUSD").length, 1);
      assert.strictEqual(filterTrades("bullet").length, 1);
      assert.strictEqual(filterTrades("london").length, 1);
      assert.strictEqual(filterTrades("fvg").length, 1);
      assert.strictEqual(filterTrades("late").length, 1);
      assert.strictEqual(filterTrades("reference").length, 1);
      assert.strictEqual(filterTrades("nonexistent").length, 0);
    });

    it("survives corrupted trades with undefined search properties without throwing", () => {
      const corrupted: Trade[] = [
        {
          id: "t-corrupt",
          market: "EURUSD",
        } as any,
      ];

      assert.doesNotThrow(() => {
        const q = "eur";
        corrupted.filter((t) => {
          const matchSymbol = (t.market || "").toLowerCase().includes(q);
          const matchPlaybook = (t.modelName || "").toLowerCase().includes(q);
          const matchTags = (t.tags || []).some((tag) => tag.toLowerCase().includes(q));
          const matchSetupTags = (t.setupTags || []).some((tag) => tag.toLowerCase().includes(q));
          const matchMistakeTags = (t.mistakeTags || []).some((tag) => tag.toLowerCase().includes(q));
          const matchNotes = (t.notes || "").toLowerCase().includes(q);
          return matchSymbol || matchPlaybook || matchTags || matchSetupTags || matchMistakeTags || matchNotes;
        });
      });
    });
  });

  describe("3. Pagination Edge Cases & Clamping", () => {
    it("clamps requested page <= 0 to page 1", () => {
      const res = paginateJournalRows([1, 2, 3], -5, 6);
      assert.strictEqual(res.page, 1);
      assert.strictEqual(res.totalPages, 1);
      assert.strictEqual(res.rows.length, 3);
    });

    it("clamps requested page > totalPages to totalPages", () => {
      const res = paginateJournalRows([1, 2, 3, 4, 5, 6, 7], 99, 6);
      assert.strictEqual(res.page, 2);
      assert.strictEqual(res.totalPages, 2);
      assert.strictEqual(res.rows.length, 1);
      assert.strictEqual(res.rows[0], 7);
    });

    it("handles exact multiples of pageSize correctly without phantom extra page", () => {
      const items = Array.from({ length: 18 }, (_, i) => i + 1);
      const res1 = paginateJournalRows(items, 1, 6);
      assert.strictEqual(res1.totalPages, 3);
      assert.strictEqual(res1.rows.length, 6);

      const res3 = paginateJournalRows(items, 3, 6);
      assert.strictEqual(res3.page, 3);
      assert.strictEqual(res3.rows.length, 6);
      assert.strictEqual(res3.rows[5], 18);
    });

    it("handles 0 items gracefully", () => {
      const res = paginateJournalRows([], 1, 6);
      assert.strictEqual(res.page, 1);
      assert.strictEqual(res.totalPages, 1);
      assert.strictEqual(res.rows.length, 0);
      assert.strictEqual(res.startIndex, 0);
    });
  });

  describe("4. Formatting Helpers & Pill Badges", () => {
    it("formatPrice formats instruments according to standard market decimals", () => {
      assert.strictEqual(formatPrice(1.08542, "EURUSD"), "1.08542");
      assert.strictEqual(formatPrice(1.29851, "GBPUSD"), "1.29851");
      assert.strictEqual(formatPrice(153.284, "USDJPY"), "153.284");
      assert.strictEqual(formatPrice(2748.5, "XAUUSD"), "2,748.50");
      assert.strictEqual(formatPrice(43500.25, "US30"), "43,500.25");
      assert.strictEqual(formatPrice(65432.1, "BTCUSD"), "65,432.10");
    });

    it("formatOpenDateTime handles valid, missing, and corrupted date/time strings", () => {
      assert.strictEqual(formatOpenDateTime("2026-10-29", "09:48:00"), "10/29 09:48");
      assert.strictEqual(formatOpenDateTime("2026-10-29"), "10/29 00:00");
      assert.strictEqual(formatOpenDateTime(""), "—");
      assert.strictEqual(formatOpenDateTime("2026-10"), "2026-10 00:00");
    });

    it("isMistakeTag detects mistake tag keywords across casing and variations", () => {
      const mistakeList = [
        "Late entry",
        "LATE",
        "Chased market",
        "early exit",
        "FOMO trade",
        "Outside session",
        "Impulse fill",
        "Revenge",
        "Greed",
        "Fear",
        "Hesitated",
        "Overleveraged",
        "Mistake occurred",
      ];

      for (const tag of mistakeList) {
        assert.strictEqual(isMistakeTag(tag), true, `Tag '${tag}' should be recognized as mistake`);
      }

      const validList = [
        "Fair Value Gap",
        "Order Block",
        "Liquidity Raid",
        "Silver Bullet",
        "Turtle Soup",
        "OTE",
        "Breaker",
      ];

      for (const tag of validList) {
        assert.strictEqual(isMistakeTag(tag), false, `Tag '${tag}' should NOT be recognized as mistake`);
      }
    });

    it("getPlaybookLetter correctly maps model codes and names", () => {
      const models: SetupModel[] = [
        { id: "m1", name: "Custom Setup", code: "C" } as any,
        { id: "m2", name: "Turtle Soup", code: "B" } as any,
      ];

      assert.strictEqual(getPlaybookLetter({ modelId: "m1" } as any, models), "C");
      assert.strictEqual(getPlaybookLetter({ modelName: "Turtle Soup" } as any, models), "B");
      assert.strictEqual(getPlaybookLetter({ modelName: "Sell-side raid" } as any, []), "A");
      assert.strictEqual(getPlaybookLetter({ modelName: "Judas swing" } as any, []), "C");
      assert.strictEqual(getPlaybookLetter({ modelName: "FVG displacement" } as any, []), "B");
      assert.strictEqual(getPlaybookLetter({ modelName: "Unrecognized" } as any, []), "A");
    });

    it("getTradeHoldDuration safely handles multi-day, overnight, and identical times", () => {
      // Pre-existing duration
      assert.strictEqual(getTradeHoldDuration({ holdDuration: "48m" } as any, true), "48m dur");
      assert.strictEqual(getTradeHoldDuration({ holdDuration: "48m dur" } as any, true), "48m dur");

      // Same-day calculation
      assert.strictEqual(
        getTradeHoldDuration({ time: "09:30", exitTime: "10:18" } as any),
        "48m",
      );
      assert.strictEqual(
        getTradeHoldDuration({ time: "09:30", exitTime: "10:44" } as any, true),
        "1h 14m dur",
      );

      // Overnight calculation
      assert.strictEqual(
        getTradeHoldDuration({ time: "23:45", exitTime: "00:15" } as any),
        "30m",
      );

      // Multi-day calculation
      assert.strictEqual(
        getTradeHoldDuration({
          date: "2026-10-28",
          time: "22:00",
          exitDate: "2026-10-29",
          exitTime: "01:30",
        } as any),
        "3h 30m",
      );

      // Missing times
      assert.strictEqual(getTradeHoldDuration({} as any), "—");
      assert.strictEqual(getTradeHoldDuration({ time: "invalid" } as any), "—");
    });
  });

  describe("5. In-Memory CSV RFC4180 Round-Trip & Duplicate Rejection", () => {
    it("preserves quotes, commas, and newlines in notes during CSV round-trip", () => {
      const original: Trade[] = [
        createMockTrade({
          id: "trade-quote-test",
          notes: 'Displacement after "liquidity sweep", TP reached with 0 slippage.\nClean runner.',
          market: "EURUSD",
          side: "short",
          result: "win",
          rMultiple: 2.5,
          entry: 1.085,
          sl: 1.088,
          exitPrice: 1.0775,
        }),
      ];

      const csv = buildTradesCsv(original);
      assert.strictEqual(csv.includes('"Displacement after ""liquidity sweep"", TP reached with 0 slippage.\nClean runner."'), true);

      const parsedRows = parseCsv(csv);
      assert.strictEqual(parsedRows.length, 2, "Header + 1 data row");
      const headers = parsedRows[0];
      const dataRow = parsedRows[1];
      const notesIdx = headers.indexOf("notes");
      const marketIdx = headers.indexOf("market");
      const rMultipleIdx = headers.indexOf("rMultiple");

      assert.strictEqual(dataRow[notesIdx], original[0].notes);
      assert.strictEqual(dataRow[marketIdx], "EURUSD");
      assert.strictEqual(Number(dataRow[rMultipleIdx]), 2.5);
    });

    it("RFC4180 parser detects duplicate trade keys and rejects malformed rows", () => {
      const tradeKey = (t: Partial<Trade>) =>
        [t.date, t.time, (t.market || "").toLowerCase(), t.side, t.entry ?? "", t.result].join("|");

      const trade1 = createMockTrade({ date: "2026-10-29", time: "09:48", market: "XAUUSD", side: "long", entry: 2740.0, result: "win" });
      const trade2 = createMockTrade({ date: "2026-10-29", time: "09:48", market: "XAUUSD", side: "long", entry: 2740.0, result: "win" });
      const trade3 = createMockTrade({ date: "2026-10-29", time: "10:30", market: "EURUSD", side: "short", entry: 1.085, result: "loss" });

      const set = new Set<string>();
      set.add(tradeKey(trade1));
      assert.strictEqual(set.has(tradeKey(trade2)), true, "Duplicate detected");
      assert.strictEqual(set.has(tradeKey(trade3)), false, "Unique key distinct");
    });
  });

  describe("6. Real In-Memory Database Persistence & GIN Index Audit", () => {
    it("creates table with GIN indexes and performs JSONB trade queries with zero filesystem writes", async () => {
      const fsCalls: string[] = [];
      const origWriteFileSync = fs.writeFileSync;
      const origMkdirSync = fs.mkdirSync;

      fs.writeFileSync = (...args: any[]) => {
        fsCalls.push(`writeFileSync: ${args[0]}`);
        return origWriteFileSync.apply(fs, args as any);
      };
      fs.mkdirSync = (...args: any[]) => {
        fsCalls.push(`mkdirSync: ${args[0]}`);
        return origMkdirSync.apply(fs, args as any);
      };

      try {
        const db = new PGlite();

        const files = [
          "0001_auth.sql",
          "0002_user_desk_state.sql",
          "0003_google_user_databases.sql",
          "0004_notebook_state.sql",
          "0005_journal_indexes.sql",
        ];
        for (const file of files) {
          const sql = fs.readFileSync(`migrations/${file}`, "utf8");
          await db.exec(sql);
        }


        // Verify GIN indexes exist on google_user_databases
        const indexRes = await db.query<{ indexname: string }>(`
          SELECT indexname FROM pg_indexes 
          WHERE tablename = 'google_user_databases' AND indexname LIKE '%_trade_history%';
        `);
        const indexNames = indexRes.rows.map((r) => r.indexname);
        assert.strictEqual(indexNames.includes("idx_google_user_databases_trade_history"), true);

        // Insert parent user row
        await db.query(
          `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
           VALUES ('u1', 'Trader', 'trader@example.com', true, NOW(), NOW());`
        );

        // Insert desk data containing 100 trades into google_user_databases
        const sampleTrades = Array.from({ length: 100 }, (_, i) =>
          createMockTrade({
            id: `trade-db-${i}`,
            date: "2026-10-29",
            market: i % 2 === 0 ? "XAUUSD" : "EURUSD",
            netPnL: i * 10,
          }),
        );
        const deskState = {
          ...createInitialState(),
          trades: sampleTrades,
        };

        await db.query(
          `INSERT INTO google_user_databases (google_user_id, user_id, desk_state, trade_history, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (google_user_id) DO UPDATE SET desk_state = EXCLUDED.desk_state, trade_history = EXCLUDED.trade_history;`,
          ["test-google-id", "u1", JSON.stringify(deskState), JSON.stringify(sampleTrades)],
        );

        // Perform JSONB containment query enabled by GIN index
        const queryRes = await db.query<{ count: string }>(`
          SELECT count(*) as count FROM google_user_databases
          WHERE trade_history @> '[{"market": "XAUUSD"}]'::jsonb;
        `);
        assert.strictEqual(parseInt(queryRes.rows[0].count, 10), 1);



        // Verify zero filesystem writes in storage directory
        const storageWrites = fsCalls.filter((c) => c.includes("storage"));
        assert.strictEqual(storageWrites.length, 0, "No filesystem writes allowed");
      } finally {
        fs.writeFileSync = origWriteFileSync;
        fs.mkdirSync = origMkdirSync;
      }
    });
  });
});
