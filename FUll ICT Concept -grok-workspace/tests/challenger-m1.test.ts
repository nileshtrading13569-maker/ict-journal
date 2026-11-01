import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  getTradeHoldDuration,
  calculateTradeRuleAdherence,
  formatTradeRuleAdherenceRatio,
  getPlaybookRules,
} from "../src/lib/tradezella-helpers.ts";
import type { PlaybookStructuredRule, SetupModel, Trade } from "../src/lib/ict-types.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function mockTrade(partial: Partial<Trade>): Trade {
  return {
    id: `trade-challenge-${Math.random().toString(36).slice(2, 9)}`,
    date: "2026-10-15",
    time: "09:30",
    market: "NQ",
    side: "long",
    modelId: "m1",
    modelName: "ICT Silver Bullet",
    weeklyBias: "bullish",
    dailyBias: "bullish",
    drawOnLiquidity: "BSL",
    location: "discount",
    dealingRange: { high: 21000, low: 20900 },
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
    entry: 20950,
    sl: 20930,
    tp1: 20990,
    tp2: null,
    tp3: null,
    exitPrice: 20990,
    exitTime: "10:15",
    exitReason: "TP",
    riskPct: 0.25,
    lots: 1.0,
    management: "Partial taken",
    partialAtR: null,
    be: false,
    maeR: -0.2,
    mfeR: 2.2,
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
    notes: "Empirical verification test trade",
    screenshotHtf: "",
    screenshotExec: "",
    result: "win",
    rMultiple: 2.0,
    ...partial,
  };
}

describe("Empirical Challenge Suite — Milestone 1", () => {
  // =========================================================================
  // CHALLENGE 1: getTradeHoldDuration
  // =========================================================================
  describe("Challenge 1: getTradeHoldDuration Empirical Stress Tests", () => {
    it("handles trades spanning across midnight without explicit exitDate (next day wrap)", () => {
      // 23:45 to 00:15 -> exactly 30 minutes
      const t1 = mockTrade({ time: "23:45", exitTime: "00:15", holdDuration: undefined });
      assert.equal(getTradeHoldDuration(t1), "30m");
      assert.equal(getTradeHoldDuration(t1, true), "30m dur");

      // 22:30 to 01:15 -> 2 hours 45 minutes
      const t2 = mockTrade({ time: "22:30", exitTime: "01:15", holdDuration: undefined });
      assert.equal(getTradeHoldDuration(t2), "2h 45m");
      assert.equal(getTradeHoldDuration(t2, true), "2h 45m dur");

      // 23:59 to 00:00 -> 1 minute wrap
      const t3 = mockTrade({ time: "23:59", exitTime: "00:00", holdDuration: undefined });
      assert.equal(getTradeHoldDuration(t3), "1m");

      // 23:00 to 01:00 -> exact 2 hours
      const t4 = mockTrade({ time: "23:00", exitTime: "01:00", holdDuration: undefined });
      assert.equal(getTradeHoldDuration(t4), "2h");
    });

    it("handles trades spanning across multiple days with date and exitDate", () => {
      // Spanning overnight with dates: 2026-10-15 23:30 to 2026-10-16 00:30 (1 hour)
      const t1 = mockTrade({
        date: "2026-10-15",
        time: "23:30",
        exitDate: "2026-10-16",
        exitTime: "00:30",
        holdDuration: undefined,
      });
      assert.equal(getTradeHoldDuration(t1), "1h");
      assert.equal(getTradeHoldDuration(t1, true), "1h dur");

      // Multi-day swing trade: 2026-10-10 10:00 to 2026-10-12 12:30 (50 hours 30 mins)
      const t2 = mockTrade({
        date: "2026-10-10",
        time: "10:00",
        exitDate: "2026-10-12",
        exitTime: "12:30",
        holdDuration: undefined,
      });
      assert.equal(getTradeHoldDuration(t2), "50h 30m");
      assert.equal(getTradeHoldDuration(t2, true), "50h 30m dur");

      // Multi-day exact days: 2026-10-10 09:30 to 2026-10-13 09:30 (72 hours)
      const t3 = mockTrade({
        date: "2026-10-10",
        time: "09:30",
        exitDate: "2026-10-13",
        exitTime: "09:30",
        holdDuration: undefined,
      });
      assert.equal(getTradeHoldDuration(t3), "72h");
    });

    it("handles trades with identical open and close time (0m)", () => {
      // 09:30 to 09:30 -> 0m
      const t1 = mockTrade({ time: "09:30", exitTime: "09:30", holdDuration: undefined });
      assert.equal(getTradeHoldDuration(t1), "0m");
      assert.equal(getTradeHoldDuration(t1, true), "0m dur");

      // Midnight identical: 00:00 to 00:00 -> 0m
      const t2 = mockTrade({ time: "00:00", exitTime: "00:00", holdDuration: undefined });
      assert.equal(getTradeHoldDuration(t2), "0m");
      assert.equal(getTradeHoldDuration(t2, true), "0m dur");

      // Same date and time: 2026-10-15 14:00 to 2026-10-15 14:00 -> 0m
      const t3 = mockTrade({
        date: "2026-10-15",
        time: "14:00",
        exitDate: "2026-10-15",
        exitTime: "14:00",
        holdDuration: undefined,
      });
      assert.equal(getTradeHoldDuration(t3), "0m");
      assert.equal(getTradeHoldDuration(t3, true), "0m dur");

      // Pre-existing holdDuration '0m'
      const t4 = mockTrade({ holdDuration: "0m" });
      assert.equal(getTradeHoldDuration(t4), "0m");
      assert.equal(getTradeHoldDuration(t4, true), "0m dur");
    });

    it("evaluates invalid and malformed timestamp formats and identifies colon-less string behavior", () => {
      // Missing time or exitTime cleanly returns em-dash
      assert.equal(getTradeHoldDuration(mockTrade({ time: "", exitTime: "" })), "—");
      assert.equal(getTradeHoldDuration(mockTrade({ time: "10:00", exitTime: "" })), "—");
      assert.equal(getTradeHoldDuration(mockTrade({ time: "", exitTime: "10:30" })), "—");
      assert.equal(getTradeHoldDuration(mockTrade({ time: undefined, exitTime: undefined })), "—");

      // Malformed non-numeric timestamps cleanly return em-dash
      assert.equal(getTradeHoldDuration(mockTrade({ time: "invalid", exitTime: "10:00" })), "—");
      assert.equal(getTradeHoldDuration(mockTrade({ time: "10:00", exitTime: "invalid" })), "—");
      assert.equal(getTradeHoldDuration(mockTrade({ time: "abc:def", exitTime: "10:00" })), "—");

      // Invalid dates fallback to valid times
      const tDateFallback = mockTrade({
        date: "not-a-date",
        exitDate: "also-not-a-date",
        time: "10:00",
        exitTime: "10:45",
        holdDuration: undefined,
      });
      assert.equal(getTradeHoldDuration(tDateFallback), "45m");

      // Exit date earlier than entry date falls back to time calculation
      const tInvertedDates = mockTrade({
        date: "2026-10-16",
        exitDate: "2026-10-15",
        time: "10:00",
        exitTime: "10:50",
        holdDuration: undefined,
      });
      assert.equal(getTradeHoldDuration(tInvertedDates), "50m");

      // EMPIRICAL BUG FINDING: When timestamp lacks a colon (e.g. "10", "11"),
      // split(":") returns 1 element, leaving em/xm as undefined.
      // Because Number.isNaN(undefined) is false in JS, the NaN check is bypassed,
      // resulting in "NaNh".
      const durationWithNoColon = getTradeHoldDuration(mockTrade({ time: "10", exitTime: "11" }));
      assert.equal(
        durationWithNoColon,
        "NaNh",
        "Empirical proof: time '10' and exitTime '11' produces 'NaNh' due to Number.isNaN(undefined) === false"
      );
    });
  });

  // =========================================================================
  // CHALLENGE 2: calculateTradeRuleAdherence
  // =========================================================================
  describe("Challenge 2: calculateTradeRuleAdherence Empirical Stress Tests", () => {
    it("handles setup models with 0 custom rules (rulesList: [])", () => {
      const emptyModel: SetupModel = {
        id: "empty-rules-model",
        code: "ERM",
        name: "Empty Rules Model",
        market: "NQ",
        timeframe: "5m",
        htfNarrative: "HTF narrative",
        liquidityCondition: "Liquidity raid",
        pdArray: "FVG",
        trigger: "MSS",
        invalidation: "Anchor high",
        target: "BSL",
        requiredTiming: "NY AM",
        validWhen: [],
        invalidWhen: [],
        active: true,
        rulesList: [], // 0 custom rules
      };

      // getPlaybookRules synthesizes 10 standard ICT confluences across 5 phases when rulesList is empty
      const rules = getPlaybookRules(emptyModel);
      assert.equal(rules.length, 10, "Synthesizes 10 standard rules for model without custom rules");

      // Trade with ruleFollowed: true
      const tFollowed = mockTrade({ ruleFollowed: true, ruleChecklist: {} });
      const adherenceFollowed = calculateTradeRuleAdherence(tFollowed, emptyModel);
      assert.equal(typeof adherenceFollowed.adherencePct, "number");
      assert.ok(!Number.isNaN(adherenceFollowed.adherencePct));
      assert.equal(adherenceFollowed.total, 10);
      assert.equal(adherenceFollowed.followed, 9);
      assert.equal(adherenceFollowed.ratio, "9/10");
      assert.equal(adherenceFollowed.adherencePct, 90);
      assert.equal(String(adherenceFollowed), "9/10");

      // Trade with ruleFollowed: false
      const tNotFollowed = mockTrade({ ruleFollowed: false, ruleChecklist: {} });
      const adherenceNotFollowed = calculateTradeRuleAdherence(tNotFollowed, emptyModel);
      assert.equal(adherenceNotFollowed.total, 10);
      assert.equal(adherenceNotFollowed.followed, 4); // 40% of 10
      assert.equal(adherenceNotFollowed.ratio, "4/10");
      assert.equal(adherenceNotFollowed.adherencePct, 40);
    });

    it("strictly prevents rules passed > total rules invariant violation", () => {
      // Model with only 3 structured rules
      const customRules: PlaybookStructuredRule[] = [
        { id: "r1", category: "context", text: "Rule 1", isMandatory: true },
        { id: "r2", category: "trigger", text: "Rule 2", isMandatory: true },
        { id: "r3", category: "entry_risk", text: "Rule 3", isMandatory: false },
      ];
      const modelWith3: SetupModel = {
        id: "three-rule-model",
        code: "TRM",
        name: "Three Rule Model",
        market: "NQ",
        timeframe: "5m",
        htfNarrative: "",
        liquidityCondition: "",
        pdArray: "",
        trigger: "",
        invalidation: "",
        target: "",
        requiredTiming: "",
        validWhen: [],
        invalidWhen: [],
        active: true,
        rulesList: customRules,
      };

      // Trade has 10 rules checked true in its checklist (more than model rules)
      const overloadedChecklist: Record<string, boolean> = {
        r1: true,
        r2: true,
        r3: true,
        r4: true,
        r5: true,
        r6: true,
        r7: true,
        r8: true,
        r9: true,
        r10: true,
      };
      const tOverloaded = mockTrade({ ruleChecklist: overloadedChecklist });

      const adherence = calculateTradeRuleAdherence(tOverloaded, modelWith3);
      // Invariant: followed must NEVER exceed total
      assert.ok(adherence.followed <= adherence.total, `followed (${adherence.followed}) must be <= total (${adherence.total})`);
      assert.equal(adherence.total, 3, "Total must match the model rules count");
      assert.equal(adherence.followed, 3, "Only the 3 model rules should be counted");
      assert.equal(adherence.ratio, "3/3");
      assert.equal(adherence.adherencePct, 100);

      // Invariant check on fallback without model
      const tNoModel = mockTrade({ ruleChecklist: { a: true, b: true, c: false } });
      const adherenceNoModel = calculateTradeRuleAdherence(tNoModel);
      assert.ok(adherenceNoModel.followed <= adherenceNoModel.total);
      assert.equal(adherenceNoModel.followed, 2);
      assert.equal(adherenceNoModel.total, 3);
      assert.equal(adherenceNoModel.ratio, "2/3");
      assert.equal(adherenceNoModel.adherencePct, 67);
    });

    it("robustly handles missing, empty, or non-standard rulesAssessment objects", () => {
      // 1. rulesAssessment is undefined -> gracefully falls back to trade.ruleFollowed default
      const tNoAssessment = mockTrade({ rulesAssessment: undefined, ruleChecklist: undefined, ruleFollowed: true });
      const adhDefaultTrue = calculateTradeRuleAdherence(tNoAssessment);
      assert.equal(adhDefaultTrue.ratio, "9/10");
      assert.equal(adhDefaultTrue.adherencePct, 90);

      const tNoAssessmentFalse = mockTrade({ rulesAssessment: undefined, ruleChecklist: undefined, ruleFollowed: false });
      const adhDefaultFalse = calculateTradeRuleAdherence(tNoAssessmentFalse);
      assert.equal(adhDefaultFalse.ratio, "5/10");
      assert.equal(adhDefaultFalse.adherencePct, 50);

      // 2. rulesAssessment is an empty object {}
      const tEmptyAssessment = mockTrade({ rulesAssessment: {}, ruleFollowed: true });
      const adhEmpty = calculateTradeRuleAdherence(tEmptyAssessment);
      assert.equal(adhEmpty.ratio, "9/10");

      // 3. rulesAssessment has only 'not' (0 passed)
      const tAllNot = mockTrade({
        rulesAssessment: {
          r1: "not",
          r2: "not",
          r3: "not",
        },
      });
      const adhAllNot = calculateTradeRuleAdherence(tAllNot);
      assert.equal(adhAllNot.followed, 0);
      assert.equal(adhAllNot.total, 3);
      assert.equal(adhAllNot.ratio, "0/3");
      assert.equal(adhAllNot.adherencePct, 0);

      // 4. rulesAssessment has non-standard values (e.g. unknown strings)
      const tNonStandard = mockTrade({
        rulesAssessment: {
          r1: "unknown_value" as any,
          r2: "partially" as any,
        },
      });
      const adhNonStandard = calculateTradeRuleAdherence(tNonStandard);
      assert.ok(!Number.isNaN(adhNonStandard.adherencePct));
      assert.equal(adhNonStandard.followed, 0);
      assert.equal(adhNonStandard.total, 2);
      assert.equal(adhNonStandard.ratio, "0/2");
      assert.equal(adhNonStandard.adherencePct, 0);
    });
  });

  // =========================================================================
  // CHALLENGE 3: SQL Migration 0005_journal_indexes.sql Idempotence & PG16
  // =========================================================================
  describe("Challenge 3: SQL Migration 0005_journal_indexes.sql Empirical Verification", () => {
    it("empirically verifies migration idempotence by running repeatedly on Postgres / PGLite", async () => {
      const migrationDir = join(__dirname, "..", "migrations");
      const m0001 = readFileSync(join(migrationDir, "0001_auth.sql"), "utf-8");
      const m0002 = readFileSync(join(migrationDir, "0002_user_desk_state.sql"), "utf-8");
      const m0003 = readFileSync(join(migrationDir, "0003_google_user_databases.sql"), "utf-8");
      const m0004 = readFileSync(join(migrationDir, "0004_notebook_state.sql"), "utf-8");
      const m0005 = readFileSync(join(migrationDir, "0005_journal_indexes.sql"), "utf-8");

      // Initialize fresh Postgres engine
      const pg = new PGlite();
      await pg.waitReady;

      // Apply base migrations 0001 - 0004
      await pg.exec(m0001);
      await pg.exec(m0002);
      await pg.exec(m0003);
      await pg.exec(m0004);

      // Pass 1: Apply 0005_journal_indexes.sql for the first time
      await assert.doesNotReject(async () => {
        await pg.exec(m0005);
      }, "Pass 1 of 0005_journal_indexes.sql must succeed");

      // Pass 2: IDEMPOTENCE TEST — Apply 0005_journal_indexes.sql a SECOND time
      await assert.doesNotReject(async () => {
        await pg.exec(m0005);
      }, "Pass 2 of 0005_journal_indexes.sql (idempotence) must NOT error on existing indexes");

      // Pass 3: IDEMPOTENCE TEST — Apply 0005_journal_indexes.sql a THIRD time
      await assert.doesNotReject(async () => {
        await pg.exec(m0005);
      }, "Pass 3 of 0005_journal_indexes.sql must continue to succeed without conflict");

      // Verify that the indexes exist in pg_indexes
      const indexRows = await pg.query<{ indexname: string; indexdef: string }>(
        `SELECT indexname, indexdef FROM pg_indexes 
         WHERE tablename IN ('google_user_databases', 'user_desk_state') 
         ORDER BY indexname;`
      );
      const indexNames = indexRows.rows.map((r) => r.indexname);

      assert.ok(
        indexNames.includes("idx_google_user_databases_trade_history"),
        "idx_google_user_databases_trade_history must exist in pg_indexes"
      );
      assert.ok(
        indexNames.includes("idx_google_user_databases_desk_state"),
        "idx_google_user_databases_desk_state must exist in pg_indexes"
      );
      assert.ok(
        indexNames.includes("idx_user_desk_state_updated_at"),
        "idx_user_desk_state_updated_at must exist in pg_indexes"
      );

      // Verify GIN index method in index definitions
      const tradeHistoryDef = indexRows.rows.find((r) => r.indexname === "idx_google_user_databases_trade_history")?.indexdef;
      const deskStateDef = indexRows.rows.find((r) => r.indexname === "idx_google_user_databases_desk_state")?.indexdef;
      assert.ok(tradeHistoryDef?.toLowerCase().includes("using gin"), "trade_history index must use GIN");
      assert.ok(deskStateDef?.toLowerCase().includes("using gin"), "desk_state index must use GIN");

      // Verify Postgres 16 / Neon JSONB Query Functionality with GIN Index
      await pg.exec(`
        INSERT INTO "user" ("id", "name", "email", "emailVerified") 
        VALUES ('test-user-1', 'Trader Joe', 'trader@propdesk.com', true);

        INSERT INTO google_user_databases (google_user_id, user_id, trade_history, desk_state)
        VALUES (
          'gid-12345',
          'test-user-1',
          '[{"id": "trade-1", "symbol": "NQ", "netPnL": 520.50}, {"id": "trade-2", "symbol": "ES", "netPnL": -150.00}]'::jsonb,
          '{"activeTheme": "royal-luxury", "autoSync": true}'::jsonb
        );

        INSERT INTO user_desk_state (user_id, state)
        VALUES ('test-user-1', '{"version": 1}'::jsonb);
      `);

      // Test JSONB containment query (utilizing GIN index in Postgres)
      const jsonContainmentRes = await pg.query<{ google_user_id: string }>(
        `SELECT google_user_id FROM google_user_databases 
         WHERE trade_history @> '[{"symbol": "NQ"}]'::jsonb;`
      );
      assert.equal(jsonContainmentRes.rows.length, 1);
      assert.equal(jsonContainmentRes.rows[0].google_user_id, "gid-12345");

      // Test desk_state JSONB containment query
      const deskStateRes = await pg.query<{ google_user_id: string }>(
        `SELECT google_user_id FROM google_user_databases 
         WHERE desk_state @> '{"autoSync": true}'::jsonb;`
      );
      assert.equal(deskStateRes.rows.length, 1);
      assert.equal(deskStateRes.rows[0].google_user_id, "gid-12345");

      // Test user_desk_state updated_at ordering (utilizing btree index)
      const updatedRes = await pg.query<{ user_id: string }>(
        `SELECT user_id FROM user_desk_state ORDER BY updated_at DESC LIMIT 1;`
      );
      assert.equal(updatedRes.rows.length, 1);
      assert.equal(updatedRes.rows[0].user_id, "test-user-1");

      await pg.close();
    });
  });
});
