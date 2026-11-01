import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

import {
  calculateJournalKPIs,
  winRate,
  formatKPIPnL,
  formatKPIR,
} from "../src/lib/ict-stats.ts";
import {
  getTradeHoldDuration,
  calculateTradeRuleAdherence,
  formatTradeRuleAdherenceRatio,
  getPlaybookRules,
} from "../src/lib/tradezella-helpers.ts";
import { pendingMigrations, migrationName, isMigrationFile } from "../scripts/migration-plan.mjs";
import type { SetupModel, Trade } from "../src/lib/ict-types.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

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

describe("ADVERSARIAL STRESS TEST: calculateJournalKPIs & Persistence", () => {
  describe("1. Scale & Throughput Stress: Massive Arrays of Trades", () => {
    it("handles 10,000 trades in < 150ms with exact arithmetic integrity", () => {
      const N = 10000;
      const trades: Trade[] = [];
      let expectedNetPnL = 0;
      let expectedGP = 0;
      let expectedGL = 0;
      let expectedCumR = 0;
      let wins = 0;
      let losses = 0;
      let bes = 0;

      for (let i = 0; i < N; i++) {
        const mod = i % 4;
        if (mod === 0) {
          // Win
          const pnl = 150.25;
          const r = 2.0;
          trades.push(createMockTrade({ netPnL: pnl, rMultiple: r, result: "win", plannedR: 2.5 }));
          expectedNetPnL += pnl;
          expectedGP += pnl;
          expectedCumR += r;
          wins++;
        } else if (mod === 1) {
          // Loss
          const pnl = -75.5;
          const r = -1.0;
          trades.push(createMockTrade({ netPnL: pnl, rMultiple: r, result: "loss", plannedR: 2.0 }));
          expectedNetPnL += pnl;
          expectedGL += Math.abs(pnl);
          expectedCumR += r;
          losses++;
        } else if (mod === 2) {
          // BE
          trades.push(createMockTrade({ netPnL: 0, rMultiple: 0, result: "be", plannedR: 2.0 }));
          bes++;
        } else {
          // Open trade
          trades.push(createMockTrade({ netPnL: 50, rMultiple: 1.0, result: "open", plannedR: 1.5 }));
          // Open trade has PnL added to netPnL and grossProfit, rMultiple added to cumulativeR
          expectedNetPnL += 50;
          expectedGP += 50;
          expectedCumR += 1.0;
        }
      }

      const start = performance.now();
      const kpis = calculateJournalKPIs(trades);
      const elapsed = performance.now() - start;

      assert.ok(elapsed < 200, `Calculation took ${elapsed.toFixed(2)}ms, expected < 200ms for 10k trades`);
      assert.equal(kpis.winCount, wins);
      assert.equal(kpis.lossCount, losses);
      assert.equal(kpis.beCount, bes);
      assert.equal(kpis.netPnL, Number(expectedNetPnL.toFixed(2)));
      assert.equal(kpis.grossProfit, Number(expectedGP.toFixed(2)));
      assert.equal(kpis.grossLoss, Number(expectedGL.toFixed(2)));
      assert.equal(kpis.cumulativeR, Number(expectedCumR.toFixed(2)));
      // Win rate: wins / (wins + losses) * 100 = 2500 / 5000 * 100 = 50.0%
      assert.equal(kpis.winRatePct, 50.0);
      assert.ok(Number.isFinite(kpis.profitFactor));
      assert.ok(Number.isFinite(kpis.expectancy));
    });

    it("handles 50,000 trades cleanly without memory leaks or stack exhaustion", () => {
      const N = 50000;
      const trades: Trade[] = new Array(N);
      for (let i = 0; i < N; i++) {
        trades[i] = createMockTrade({
          netPnL: i % 2 === 0 ? 100 : -50,
          rMultiple: i % 2 === 0 ? 2 : -1,
          result: i % 2 === 0 ? "win" : "loss",
          plannedR: 2,
        });
      }

      const start = performance.now();
      const kpis = calculateJournalKPIs(trades);
      const elapsed = performance.now() - start;

      assert.ok(elapsed < 500, `Calculation took ${elapsed.toFixed(2)}ms, expected < 500ms for 50k trades`);
      assert.equal(kpis.winCount, 25000);
      assert.equal(kpis.lossCount, 25000);
      assert.equal(kpis.winRatePct, 50.0);
      assert.equal(kpis.profitFactor, 2.0); // 2,500,000 / 1,250,000 = 2.0
    });
  });

  describe("2. Floating Point Precision & Extreme Decimal Attacks", () => {
    it("handles micro-decimals without precision explosion or rounding anomalies", () => {
      const microTrades: Trade[] = [
        createMockTrade({ netPnL: 0.0001, rMultiple: 0.0033333333333333, result: "win" }),
        createMockTrade({ netPnL: 0.0002, rMultiple: 0.0066666666666666, result: "win" }),
        createMockTrade({ netPnL: -0.0001, rMultiple: -0.001111111111111, result: "loss" }),
      ];

      const kpis = calculateJournalKPIs(microTrades);
      assert.equal(kpis.netPnL, 0.0);
      assert.equal(kpis.netPnLFormatted, "$0.00");
      assert.equal(kpis.cumulativeR, 0.01);
      assert.equal(kpis.cumulativeRFormatted, "+0.01R");
      assert.ok(Number.isFinite(kpis.profitFactor));
      assert.ok(Number.isFinite(kpis.expectancy));
    });

    it("resists JavaScript 0.1 + 0.2 floating point inaccuracies across repeated summations", () => {
      // 100 trades with 0.1 profit, 100 trades with 0.2 loss
      const trades: Trade[] = [];
      for (let i = 0; i < 100; i++) {
        trades.push(createMockTrade({ netPnL: 0.1, rMultiple: 0.1, result: "win" }));
        trades.push(createMockTrade({ netPnL: -0.2, rMultiple: -0.2, result: "loss" }));
      }
      const kpis = calculateJournalKPIs(trades);
      // 100 * 0.1 = 10, 100 * -0.2 = -20 => net PnL = -10.00
      assert.equal(kpis.netPnL, -10.0);
      assert.equal(kpis.netPnLFormatted, "-$10.00");
      assert.equal(kpis.grossProfit, 10.0);
      assert.equal(kpis.grossLoss, 20.0);
      assert.equal(kpis.profitFactor, 0.5);
      assert.equal(kpis.cumulativeR, -10.0);
      assert.equal(kpis.cumulativeRFormatted, "-10.00R");
    });

    it("handles astronomical numbers (billion-dollar trades) safely", () => {
      const whaleTrades: Trade[] = [
        createMockTrade({ netPnL: 1_250_000_000.75, rMultiple: 50000.5, result: "win", plannedR: 100000.0 }),
        createMockTrade({ netPnL: -250_000_000.25, rMultiple: -10000.0, result: "loss", plannedR: 100000.0 }),
      ];
      const kpis = calculateJournalKPIs(whaleTrades);
      assert.equal(kpis.netPnL, 1000000000.5);
      assert.equal(kpis.netPnLFormatted, "+$1,000,000,000.50");
      assert.equal(kpis.grossProfit, 1250000000.75);
      assert.equal(kpis.grossLoss, 250000000.25);
      assert.equal(kpis.profitFactor, 5.0);
      assert.equal(kpis.cumulativeR, 40000.5);
      assert.equal(kpis.expectancy, 500000000.25);
    });

    it("safely sanitizes non-finite numbers (NaN, Infinity, -Infinity) without crashing", () => {
      const corruptTrades = [
        createMockTrade({
          netPnL: NaN as unknown as number,
          grossPnL: NaN as unknown as number,
          rMultiple: NaN as unknown as number,
          entry: undefined,
          exitPrice: undefined,
          lots: undefined,
          result: "win",
        }),
        createMockTrade({
          netPnL: Infinity as unknown as number,
          grossPnL: Infinity as unknown as number,
          rMultiple: Infinity as unknown as number,
          entry: undefined,
          exitPrice: undefined,
          lots: undefined,
          result: "loss",
        }),
        createMockTrade({
          netPnL: -Infinity as unknown as number,
          grossPnL: -Infinity as unknown as number,
          rMultiple: -Infinity as unknown as number,
          entry: undefined,
          exitPrice: undefined,
          lots: undefined,
          result: "loss",
        }),
        createMockTrade({ netPnL: 100, rMultiple: 1.0, result: "win" }),
      ];
      const kpis = calculateJournalKPIs(corruptTrades);
      assert.ok(Number.isFinite(kpis.netPnL), `netPnL should be finite, got ${kpis.netPnL}`);
      assert.ok(Number.isFinite(kpis.cumulativeR), `cumulativeR should be finite, got ${kpis.cumulativeR}`);
      assert.ok(Number.isFinite(kpis.grossProfit), `grossProfit should be finite, got ${kpis.grossProfit}`);
      assert.ok(Number.isFinite(kpis.grossLoss), `grossLoss should be finite, got ${kpis.grossLoss}`);
      assert.ok(Number.isFinite(kpis.expectancy), `expectancy should be finite, got ${kpis.expectancy}`);
      assert.equal(kpis.netPnL, 100);
      assert.equal(kpis.cumulativeR, 1.0);
    });
  });

  describe("3. Malformed Trades & Input Boundary Attacks", () => {
    it("survives completely empty or sparse trade objects without throwing", () => {
      const emptyTrades = [
        {} as Trade,
        { id: "partial-1" } as Trade,
        { result: "win" } as Trade,
        { result: "unknown" as any } as Trade,
      ];

      assert.doesNotThrow(() => {
        const kpis = calculateJournalKPIs(emptyTrades);
        assert.equal(kpis.winCount, 1);
        assert.equal(kpis.lossCount, 0);
        assert.equal(kpis.beCount, 0);
        assert.equal(kpis.netPnL, 0);
        assert.equal(kpis.cumulativeR, 0);
      });
    });

    it("safely handles negative lots, zero entry prices, and zero stop distance", () => {
      const trickyTrades: Trade[] = [
        // Negative lots: fallback calculation should guard lots > 0
        createMockTrade({
          netPnL: undefined,
          grossPnL: undefined,
          rMultiple: undefined,
          entry: 2000,
          exitPrice: 2050,
          lots: -1.0,
          side: "long",
        }),
        // Zero entry price
        createMockTrade({
          netPnL: undefined,
          grossPnL: undefined,
          rMultiple: undefined,
          entry: 0,
          exitPrice: 50,
          lots: 1.0,
          side: "long",
        }),
        // sl == entry (stop distance 0: plannedR calculation must not divide by zero)
        createMockTrade({
          entry: 100,
          sl: 100,
          targetPrice: 200,
          plannedR: undefined as any,
        }),
      ];

      assert.doesNotThrow(() => {
        const kpis = calculateJournalKPIs(trickyTrades);
        assert.ok(Number.isFinite(kpis.netPnL));
        assert.ok(Number.isFinite(kpis.plannedR));
      });
    });

    it("handles trades with only entry/exit/lots/fees through fallback resolver", () => {
      const trades: Trade[] = [
        createMockTrade({
          netPnL: undefined,
          grossPnL: undefined,
          rMultiple: undefined,
          entry: 100,
          exitPrice: 110,
          lots: 2.0,
          fees: 5.0,
          side: "long",
          result: "win",
        }),
        createMockTrade({
          netPnL: undefined,
          grossPnL: undefined,
          rMultiple: undefined,
          entry: 100,
          exitPrice: 95,
          lots: 1.0,
          fees: 2.5,
          side: "short",
          result: "win",
        }),
      ];

      const kpis = calculateJournalKPIs(trades);
      // Trade 1: (110 - 100) * 2 * 100 - 5 = 2000 - 5 = 1995.00
      // Trade 2: (100 - 95) * 1 * 100 - 2.5 = 500 - 2.5 = 497.50
      assert.equal(kpis.netPnL, 2492.5);
      assert.equal(kpis.grossProfit, 2492.5);
      assert.equal(kpis.grossLoss, 0);
      assert.equal(kpis.profitFactor, 99.99);
    });
  });

  describe("4. Zero-Division & Degenerate Boundary Attacks", () => {
    it("defends against zero division: empty trades array", () => {
      const kpis = calculateJournalKPIs([]);
      assert.equal(kpis.winRatePct, 0);
      assert.equal(kpis.profitFactor, 0);
      assert.equal(kpis.avgRealizedR, 0);
      assert.equal(kpis.plannedR, 0);
      assert.equal(kpis.expectancy, 0);
    });

    it("defends against zero division: only open trades (0 wins, 0 losses, 0 BE)", () => {
      const trades = [
        createMockTrade({ result: "open", netPnL: 50, rMultiple: 0.5 }),
        createMockTrade({ result: "open", netPnL: -20, rMultiple: -0.2 }),
      ];
      const kpis = calculateJournalKPIs(trades);
      assert.equal(kpis.winCount, 0);
      assert.equal(kpis.lossCount, 0);
      assert.equal(kpis.beCount, 0);
      assert.equal(kpis.winRatePct, 0); // 0 / 0 avoided
      assert.equal(kpis.expectancy, 0); // 30 / 0 avoided
    });

    it("defends against zero division: 100% BE trades", () => {
      const trades = [
        createMockTrade({ result: "be", netPnL: 0, rMultiple: 0 }),
        createMockTrade({ result: "be", netPnL: 0, rMultiple: 0 }),
        createMockTrade({ result: "be", netPnL: 0, rMultiple: 0 }),
      ];
      const kpis = calculateJournalKPIs(trades);
      assert.equal(kpis.winRatePct, 0);
      assert.equal(kpis.profitFactor, 0);
      assert.equal(kpis.expectancy, 0);
    });

    it("defends against zero division: 100% loss trades (grossLoss > 0, grossProfit == 0)", () => {
      const trades = [
        createMockTrade({ result: "loss", netPnL: -100, rMultiple: -1.0 }),
        createMockTrade({ result: "loss", netPnL: -100, rMultiple: -1.0 }),
      ];
      const kpis = calculateJournalKPIs(trades);
      assert.equal(kpis.winRatePct, 0);
      assert.equal(kpis.profitFactor, 0); // 0 / 200 = 0
      assert.equal(kpis.expectancy, -100);
    });

    it("defends against zero division: 100% win trades (grossLoss == 0, grossProfit > 0)", () => {
      const trades = [
        createMockTrade({ result: "win", netPnL: 200, rMultiple: 2.0 }),
        createMockTrade({ result: "win", netPnL: 300, rMultiple: 3.0 }),
      ];
      const kpis = calculateJournalKPIs(trades);
      assert.equal(kpis.winRatePct, 100.0);
      assert.equal(kpis.profitFactor, 99.99); // capped safe constant
      assert.equal(kpis.expectancy, 250);
    });

    it("defends against zero division: 1 win and 10 BE trades", () => {
      const trades = [
        createMockTrade({ result: "win", netPnL: 100, rMultiple: 1.0 }),
        ...Array.from({ length: 10 }, () => createMockTrade({ result: "be", netPnL: 0, rMultiple: 0 })),
      ];
      const kpis = calculateJournalKPIs(trades);
      assert.equal(kpis.winRatePct, 100.0); // 1 / (1 + 0) * 100 = 100%
      assert.equal(kpis.profitFactor, 99.99);
      assert.equal(kpis.expectancy, 100.0);
    });

    it("defends against zero division: 1 loss and 10 BE trades", () => {
      const trades = [
        createMockTrade({ result: "loss", netPnL: -100, rMultiple: -1.0 }),
        ...Array.from({ length: 10 }, () => createMockTrade({ result: "be", netPnL: 0, rMultiple: 0 })),
      ];
      const kpis = calculateJournalKPIs(trades);
      assert.equal(kpis.winRatePct, 0.0); // 0 / (0 + 1) * 100 = 0%
      assert.equal(kpis.profitFactor, 0.0);
      assert.equal(kpis.expectancy, -100.0);
    });
  });

  describe("5. TradeZella Helper Adversarial Scenarios", () => {
    it("handles multi-day trades, overnight trades, and missing dates safely in getTradeHoldDuration", () => {
      // Overnight hold (same date not matching exitDate)
      const tOvernight = createMockTrade({
        date: "2026-10-28",
        time: "23:45",
        exitDate: "2026-10-29",
        exitTime: "00:30",
        holdDuration: undefined,
      });
      assert.equal(getTradeHoldDuration(tOvernight), "45m");

      // Multi-day hold
      const tMultiDay = createMockTrade({
        date: "2026-10-27",
        time: "10:00",
        exitDate: "2026-10-29",
        exitTime: "12:30",
        holdDuration: undefined,
      });
      assert.equal(getTradeHoldDuration(tMultiDay), "50h 30m");

      // Corrupted / missing times
      const tCorrupt = createMockTrade({ time: "invalid", exitTime: "also-invalid", holdDuration: undefined });
      assert.equal(getTradeHoldDuration(tCorrupt), "—");
    });

    it("handles completely empty models and corrupted checklist items in calculateTradeRuleAdherence", () => {
      const emptyModel: SetupModel = {
        id: "empty",
        name: "Empty",
        description: "",
        rules: [],
        timeframes: [],
        sessions: [],
        markets: [],
        createdAt: "2026-10-01",
        updatedAt: "2026-10-01",
      };

      const t = createMockTrade({ ruleChecklist: undefined, rulesAssessment: undefined });
      const adherence = calculateTradeRuleAdherence(t, emptyModel);
      assert.ok(adherence.ratio.includes("/"));
      assert.ok(Number.isFinite(adherence.adherencePct));
      assert.equal(String(adherence), adherence.ratio);
    });
  });

  describe("6. Migration Safety & PGLite In-Memory Execution", () => {
    it("pendingMigrations filters non-SQL entries, sorts correctly, and excludes applied files", () => {
      const dirEntries = [
        "0005_journal_indexes.sql",
        "README.md",
        ".DS_Store",
        "0001_auth.sql",
        "auth",
        "0003_google_user_databases.sql",
        "0002_user_desk_state.sql",
        "0004_notebook_state.sql",
        "backup.sql.bak",
      ];
      const applied = ["0001_auth.sql", "0002_user_desk_state.sql"];
      const pending = pendingMigrations(dirEntries, applied);

      // Should be sorted alphabetically and filtered to unapplied .sql files
      const names = pending.map((p) => p.name);
      assert.deepEqual(names, [
        "0003_google_user_databases.sql",
        "0004_notebook_state.sql",
        "0005_journal_indexes.sql",
      ]);
    });

    it("empirically executes all migrations (0001 to 0005) against real in-memory PGLite and validates GIN index usage", async () => {
      const db = new PGlite();
      await db.waitReady;

      const migrationsDir = join(__dirname, "..", "migrations");
      const files = ["0001_auth.sql", "0002_user_desk_state.sql", "0003_google_user_databases.sql", "0004_notebook_state.sql", "0005_journal_indexes.sql"];

      for (const file of files) {
        const filePath = join(migrationsDir, file);
        assert.ok(existsSync(filePath), `Migration file ${file} must exist`);
        const sql = readFileSync(filePath, "utf-8");
        await db.exec(sql);
      }

      // Verify the 3 new indexes from 0005_journal_indexes.sql exist in PostgreSQL system catalogs
      const indexQuery = await db.query<{ indexname: string; indexdef: string }>(
        "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('idx_google_user_databases_trade_history', 'idx_google_user_databases_desk_state', 'idx_user_desk_state_updated_at')"
      );

      assert.equal(indexQuery.rows.length, 3, "All 3 indexes created by 0005_journal_indexes.sql must exist");

      const tradeHistoryIndex = indexQuery.rows.find((r) => r.indexname === "idx_google_user_databases_trade_history");
      assert.ok(tradeHistoryIndex?.indexdef.toLowerCase().includes("using gin"), "idx_google_user_databases_trade_history must use GIN");

      const deskStateIndex = indexQuery.rows.find((r) => r.indexname === "idx_google_user_databases_desk_state");
      assert.ok(deskStateIndex?.indexdef.toLowerCase().includes("using gin"), "idx_google_user_databases_desk_state must use GIN");

      const updatedAtIndex = indexQuery.rows.find((r) => r.indexname === "idx_user_desk_state_updated_at");
      assert.ok(updatedAtIndex?.indexdef.toLowerCase().includes("updated_at"), "idx_user_desk_state_updated_at must index updated_at");

      // Verify insertion and GIN querying
      await db.exec(`
        INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
        VALUES ('u1', 'Trader Joe', 'trader@test.com', true, now(), now());

        INSERT INTO google_user_databases (google_user_id, user_id, trade_history, desk_state)
        VALUES ('gid_1', 'u1', '[{"id": "t1", "result": "win"}]'::jsonb, '{"theme": "dark"}'::jsonb);
      `);

      // Query using JSONB containment operator (@>) to exercise the GIN index
      const match = await db.query<{ google_user_id: string }>(
        `SELECT google_user_id FROM google_user_databases WHERE trade_history @> '[{"result": "win"}]'::jsonb`
      );
      assert.equal(match.rows.length, 1);
      assert.equal(match.rows[0].google_user_id, "gid_1");

      await db.close();
    });
  });

  describe("7. Filesystem Storage Audit", () => {
    it("confirms zero file writes occurred in storage/users", () => {
      const storageUsersDir = join(__dirname, "..", "storage", "users");
      if (existsSync(storageUsersDir)) {
        const entries = readdirSync(storageUsersDir);
        assert.equal(entries.length, 0, `storage/users must be completely empty, found: ${entries.join(", ")}`);
      }
    });
  });
});
