import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { calculateJournalKPIs, winRate, formatKPIPnL, formatKPIR } from "../src/lib/ict-stats.ts";
import {
  getTradeHoldDuration,
  calculateTradeRuleAdherence,
  formatTradeRuleAdherenceRatio,
  getPlaybookRules,
} from "../src/lib/tradezella-helpers.ts";
import { pendingMigrations } from "../scripts/migration-plan.mjs";
import type { SetupModel, Trade } from "../src/lib/ict-types.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function createMockTrade(partial: Partial<Trade>): Trade {
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

describe("Journal Business Logic & KPI Analytics Engine", () => {
  it("calculates journal KPIs matching reference screenshot (7W, 4L, 1BE yielding Net PnL +$1,198.25, Win Rate 63.6%, Profit Factor 3.42, Expectancy +$108.93)", () => {
    // 7 Winning Trades (Gross Profit = $1,693.39)
    const wins: Trade[] = [
      createMockTrade({
        netPnL: 303.25,
        rMultiple: 2.44,
        result: "win",
        plannedR: 2.35,
        time: "09:48",
        exitTime: "10:36",
      }),
      createMockTrade({
        netPnL: 275.5,
        rMultiple: 2.22,
        result: "win",
        plannedR: 2.35,
        time: "10:00",
        exitTime: "11:14",
      }),
      createMockTrade({
        netPnL: 250.0,
        rMultiple: 2.0,
        result: "win",
        plannedR: 2.35,
      }),
      createMockTrade({
        netPnL: 220.0,
        rMultiple: 1.76,
        result: "win",
        plannedR: 2.35,
      }),
      createMockTrade({
        netPnL: 240.0,
        rMultiple: 1.92,
        result: "win",
        plannedR: 2.35,
      }),
      createMockTrade({
        netPnL: 210.0,
        rMultiple: 1.68,
        result: "win",
        plannedR: 2.35,
      }),
      createMockTrade({
        netPnL: 194.64,
        rMultiple: 1.56,
        result: "win",
        plannedR: 2.35,
      }),
    ];

    // 4 Losing Trades (Gross Loss = $495.14)
    const losses: Trade[] = [
      createMockTrade({
        netPnL: -124.97,
        rMultiple: -1.0,
        result: "loss",
        plannedR: 2.35,
      }),
      createMockTrade({
        netPnL: -120.0,
        rMultiple: -1.0,
        result: "loss",
        plannedR: 2.35,
      }),
      createMockTrade({
        netPnL: -125.0,
        rMultiple: -1.0,
        result: "loss",
        plannedR: 2.35,
      }),
      createMockTrade({
        netPnL: -125.17,
        rMultiple: -1.0,
        result: "loss",
        plannedR: 2.35,
      }),
    ];

    // 1 Breakeven Trade
    const beTrades: Trade[] = [
      createMockTrade({
        netPnL: 0.0,
        rMultiple: 0.0,
        result: "be",
        plannedR: 2.35,
      }),
    ];

    const sampleTrades = [...wins, ...losses, ...beTrades];
    const kpis = calculateJournalKPIs(sampleTrades);

    // 1. Counts
    assert.equal(kpis.winCount, 7, "Win count must be 7");
    assert.equal(kpis.lossCount, 4, "Loss count must be 4");
    assert.equal(kpis.beCount, 1, "BE count must be 1");

    // 2. Net PnL & Formatted
    assert.equal(kpis.netPnL, 1198.25, "Net PnL must be +$1,198.25");
    assert.equal(kpis.netPnLFormatted, "+$1,198.25");

    // 3. Prop Win Rate: 7 / (7 + 4) = 63.636...% -> 63.6%
    assert.equal(kpis.winRatePct, 63.6, "Win rate must be 63.6% excluding BE");

    // 4. Gross Profit & Loss
    assert.equal(kpis.grossProfit, 1693.39);
    assert.equal(kpis.grossLoss, 495.14);

    // 5. Profit Factor: 1693.39 / 495.14 = 3.42
    assert.equal(kpis.profitFactor, 3.42, "Profit Factor must be 3.42");

    // 6. Cumulative R
    assert.equal(kpis.cumulativeR, 9.58, "Cumulative R must be +9.58R");
    assert.equal(kpis.cumulativeRFormatted, "+9.58R");

    // 7. Expectancy: $1,198.25 / 11 = +$108.93
    assert.equal(kpis.expectancy, 108.93, "Expectancy must be +$108.93 per execution");

    // 8. Planned R
    assert.equal(kpis.plannedR, 2.35, "Planned R must be 2.35");
  });

  describe("KPI Edge Cases", () => {
    it("handles 0 trades gracefully", () => {
      const kpis = calculateJournalKPIs([]);
      assert.equal(kpis.netPnL, 0);
      assert.equal(kpis.netPnLFormatted, "$0.00");
      assert.equal(kpis.cumulativeR, 0);
      assert.equal(kpis.cumulativeRFormatted, "0.00R");
      assert.equal(kpis.winCount, 0);
      assert.equal(kpis.lossCount, 0);
      assert.equal(kpis.beCount, 0);
      assert.equal(kpis.winRatePct, 0);
      assert.equal(kpis.profitFactor, 0);
      assert.equal(kpis.grossProfit, 0);
      assert.equal(kpis.grossLoss, 0);
      assert.equal(kpis.avgRealizedR, 0);
      assert.equal(kpis.plannedR, 0);
      assert.equal(kpis.expectancy, 0);
    });

    it("handles only winning trades (profit factor capped at 99.99, win rate 100%)", () => {
      const wins = [
        createMockTrade({ netPnL: 300, rMultiple: 2.0, result: "win", plannedR: 2.5 }),
        createMockTrade({ netPnL: 300, rMultiple: 2.0, result: "win", plannedR: 2.5 }),
      ];
      const kpis = calculateJournalKPIs(wins);
      assert.equal(kpis.winCount, 2);
      assert.equal(kpis.lossCount, 0);
      assert.equal(kpis.beCount, 0);
      assert.equal(kpis.winRatePct, 100);
      assert.equal(kpis.grossLoss, 0);
      assert.equal(kpis.profitFactor, 99.99);
      assert.equal(kpis.expectancy, 300);
      assert.equal(kpis.avgRealizedR, 2.0);
    });

    it("handles only losing trades (win rate 0%, profit factor 0)", () => {
      const losses = [
        createMockTrade({ netPnL: -150, rMultiple: -1.0, result: "loss" }),
        createMockTrade({ netPnL: -150, rMultiple: -1.0, result: "loss" }),
      ];
      const kpis = calculateJournalKPIs(losses);
      assert.equal(kpis.winCount, 0);
      assert.equal(kpis.lossCount, 2);
      assert.equal(kpis.beCount, 0);
      assert.equal(kpis.winRatePct, 0);
      assert.equal(kpis.profitFactor, 0);
      assert.equal(kpis.grossProfit, 0);
      assert.equal(kpis.grossLoss, 300);
      assert.equal(kpis.expectancy, -150);
      assert.equal(kpis.netPnLFormatted, "-$300.00");
    });

    it("handles only breakeven trades (win rate 0%, profit factor 0)", () => {
      const bes = [
        createMockTrade({ netPnL: 0, rMultiple: 0, result: "be" }),
        createMockTrade({ netPnL: 0, rMultiple: 0, result: "be" }),
      ];
      const kpis = calculateJournalKPIs(bes);
      assert.equal(kpis.winCount, 0);
      assert.equal(kpis.lossCount, 0);
      assert.equal(kpis.beCount, 2);
      assert.equal(kpis.winRatePct, 0);
      assert.equal(kpis.profitFactor, 0);
      assert.equal(kpis.expectancy, 0);
    });

    it("handles net negative PnL with negative formatting and fractional profit factor", () => {
      const trades = [
        createMockTrade({ netPnL: 100, rMultiple: 1.0, result: "win" }),
        createMockTrade({ netPnL: -220, rMultiple: -2.0, result: "loss" }),
      ];
      const kpis = calculateJournalKPIs(trades);
      assert.equal(kpis.netPnL, -120);
      assert.equal(kpis.netPnLFormatted, "-$120.00");
      assert.equal(kpis.profitFactor, 0.45); // 100 / 220 = 0.4545... -> 0.45
      assert.equal(kpis.expectancy, -60);
    });

    it("ensures backwards compatibility of winRate function with optional excludeBE flag", () => {
      const trades = [
        createMockTrade({ result: "win" }),
        createMockTrade({ result: "loss" }),
        createMockTrade({ result: "be" }),
      ];
      // Default: 1 win out of 3 closed = 33.333%
      const wrDefault = winRate(trades);
      assert.ok(Math.abs(wrDefault - 33.333) < 0.1);

      // excludeBE: 1 win out of 2 decided = 50%
      const wrProp = winRate(trades, true);
      assert.equal(wrProp, 50);
    });
  });

  describe("TradeZella Helpers (Duration & Rule Adherence)", () => {
    it("formats trade holding durations cleanly as minutes, hours, or with dur suffix", () => {
      // 48 minutes hold
      const t1 = createMockTrade({ time: "09:48", exitTime: "10:36", holdDuration: undefined });
      assert.equal(getTradeHoldDuration(t1), "48m");
      assert.equal(getTradeHoldDuration(t1, true), "48m dur");

      // 1 hour 14 minutes hold
      const t2 = createMockTrade({ time: "09:00", exitTime: "10:14", holdDuration: undefined });
      assert.equal(getTradeHoldDuration(t2), "1h 14m");
      assert.equal(getTradeHoldDuration(t2, true), "1h 14m dur");

      // Exact hours
      const t3 = createMockTrade({ time: "09:00", exitTime: "11:00", holdDuration: undefined });
      assert.equal(getTradeHoldDuration(t3), "2h");

      // Preserves pre-existing holdDuration
      const t4 = createMockTrade({ holdDuration: "48m dur" });
      assert.equal(getTradeHoldDuration(t4), "48m dur");

      // Missing time
      const t5 = createMockTrade({ time: "", exitTime: "" });
      assert.equal(getTradeHoldDuration(t5), "—");
    });

    it("formats rule adherence fraction as ratio (e.g. 9/10, 8/8)", () => {
      const t1 = createMockTrade({ ruleFollowed: true });
      const adherence1 = calculateTradeRuleAdherence(t1);
      assert.equal(adherence1.ratio, "9/10");
      assert.equal(adherence1.formatted, "9/10");
      assert.equal(String(adherence1), "9/10");
      assert.equal(formatTradeRuleAdherenceRatio(t1), "9/10");
      assert.ok(adherence1.adherencePct >= 80);

      // Model with custom rules checklist
      const mockModel: SetupModel = {
        id: "test-model",
        name: "Test Setup",
        description: "Test",
        rules: ["Rule 1", "Rule 2", "Rule 3", "Rule 4", "Rule 5", "Rule 6", "Rule 7", "Rule 8"],
        timeframes: ["5m"],
        sessions: ["NY AM"],
        markets: ["XAUUSD"],
        createdAt: "2026-10-01",
        updatedAt: "2026-10-01",
      };
      const rules = getPlaybookRules(mockModel);
      assert.ok(rules.length >= 8);

      // Build checklist where all rules are followed
      const checklistAll: Record<string, boolean> = {};
      rules.forEach((r) => {
        checklistAll[r.id] = true;
      });
      const tAll = createMockTrade({ ruleChecklist: checklistAll });
      const adherenceAll = calculateTradeRuleAdherence(tAll, mockModel);
      assert.equal(adherenceAll.followed, rules.length);
      assert.equal(adherenceAll.total, rules.length);
      assert.equal(adherenceAll.ratio, `${rules.length}/${rules.length}`);
      assert.equal(adherenceAll.adherencePct, 100);

      // Trade with rulesAssessment
      const tAssessed = createMockTrade({
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
      const adherenceAssessed = calculateTradeRuleAdherence(tAssessed);
      assert.equal(adherenceAssessed.ratio, "9/10");
      assert.equal(adherenceAssessed.followed, 9);
      assert.equal(adherenceAssessed.total, 10);
      assert.equal(adherenceAssessed.adherencePct, 90);
    });
  });

  describe("Neon Postgres Migration 0005_journal_indexes.sql", () => {
    it("migration file exists and contains valid GIN indexes for trade_history and desk_state", () => {
      const migrationPath = join(__dirname, "..", "migrations", "0005_journal_indexes.sql");
      assert.ok(existsSync(migrationPath), "Migration 0005_journal_indexes.sql must exist");

      const sql = readFileSync(migrationPath, "utf-8");
      assert.ok(
        sql.includes("idx_google_user_databases_trade_history"),
        "Must create index on google_user_databases(trade_history)",
      );
      assert.ok(
        sql.includes("idx_google_user_databases_desk_state"),
        "Must create index on google_user_databases(desk_state)",
      );
      assert.ok(
        sql.includes("idx_user_desk_state_updated_at"),
        "Must create index on user_desk_state(updated_at)",
      );
      assert.ok(sql.includes("using gin"), "Must use GIN index for JSONB columns");
    });

    it("migration is discovered by scripts/migration-plan.mjs", () => {
      const allMigrations = [
        "0001_auth.sql",
        "0002_user_desk_state.sql",
        "0003_google_user_databases.sql",
        "0004_notebook_state.sql",
        "0005_journal_indexes.sql",
      ];
      const applied = ["0001_auth.sql", "0002_user_desk_state.sql", "0003_google_user_databases.sql", "0004_notebook_state.sql"];
      const pending = pendingMigrations(allMigrations, applied);

      assert.equal(pending.length, 1);
      assert.equal(pending[0].name, "0005_journal_indexes.sql");
    });
  });
});
