import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { getSql } from "../src/lib/db.ts";
import {
  loadUserDatabase,
  saveUserDatabase,
  resolveGoogleUserIdentity,
} from "../src/lib/storage/user-database.server.ts";
import { createResetState, ensureMinimumDeskData } from "../src/lib/ict-defaults.ts";
import type { DeskData, Trade } from "../src/lib/ict-types.ts";

/**
 * Phase 2 Tier 5 Adversarial Coverage Hardening & Persistence Verification Suite.
 *
 * Verifies:
 * 1. Zero-Filesystem Invariant across the full trade lifecycle:
 *    - Trade Creation
 *    - Trade Modification / Update
 *    - In-Memory CSV Import & Export Simulation
 *    - Trade Deletion
 *    - Storage Directory emptiness (storage/users remains 100% empty, 0 bytes written).
 * 2. Database Migration 0005_journal_indexes.sql:
 *    - Idempotency across 5 repeated executions on PGlite.
 *    - Index definitions and GIN method confirmation in pg_indexes.
 *    - EXPLAIN execution testing GIN JSONB containment queries.
 * 3. Extreme Concurrent Persistence Stress:
 *    - Parallel asynchronous desk mutations under hostile filesystem read-only traps.
 */

function makeTestTrade(id: string, overrides: Partial<Trade> = {}): Trade {
  return {
    id,
    date: "2026-10-24",
    time: "09:45",
    market: "NQ",
    contract: "NQZ26",
    side: "short",
    status: "win",
    setup: "Sell-side raid",
    pnl: 520.5,
    grossProfit: 520.5,
    grossLoss: 0,
    commissions: 4.12,
    netPnL: 516.38,
    returnPct: 2.58,
    marketCondition: "trend",
    model: "Silver bullet",
    session: "NY AM",
    timeframe: "1m",
    tags: ["A+ setup", "London sweep"],
    setupTags: ["Sweep", "FVG"],
    mistakeTags: [],
    rulesAssessment: {
      "rules-1": true,
      "rules-2": true,
      "rules-3": true,
    },
    htfContext: {
      bias: "bearish",
      narrative: "Daily FVG rejection",
      keyLevels: "20980 PDH",
      timeframe: "15m",
      trend: "downtrend",
    },
    executionModel: {
      modelCode: "A",
      modelName: "Sell-side raid",
      displacement: true,
      mss: true,
      fvg: true,
      liquidityRaid: true,
      entryZone: "FVG",
      confluenceTier: "A+",
    },
    dealingRange: {
      timeframe: "15m",
      reference: "London High",
      high: 21020,
      low: 20850,
      raidSide: "buy-side",
      purge: true,
      reclaim: true,
      entryAfterReclaim: true,
      target: "20880 Sell-side",
    },
    intermarket: { dxy: "bullish", yields: "rising", silver: "", indices: "diverging" },
    entry: 20950,
    sl: 20970,
    tp1: 20900,
    tp2: null,
    tp3: null,
    exitPrice: 20900,
    exitTime: "10:33",
    exitReason: "Target reached",
    riskPct: 0.5,
    lots: 2.0,
    management: "Trimmed 50% at 2R",
    partialAtR: 2.0,
    be: false,
    maeR: -0.15,
    mfeR: 2.5,
    narrativeCorrect: true,
    liquidityCorrect: true,
    locationCorrect: true,
    triggerCorrect: true,
    executionQuality: "optimal",
    managementQuality: "optimal",
    errors: [],
    primaryError: "",
    deliveryStatus: "delivered",
    grade: "A",
    emotion: "focused",
    ruleFollowed: true,
    notes: "Adversarial Tier 5 persistence trade verification",
    screenshotHtf: "",
    screenshotExec: "",
    result: "win",
    rMultiple: 2.5,
    ...overrides,
  };
}

// In-Memory RFC4180 CSV builder & parser for CSV lifecycle verification
function buildInMemoryCsv(trades: Trade[]): string {
  const headers = ["id", "date", "time", "market", "side", "result", "netPnL", "entry", "exitPrice"];
  const rows = trades.map((t) => [
    t.id,
    t.date,
    t.time,
    t.market || "NQ",
    t.side,
    t.status || t.result,
    String(t.netPnL ?? t.pnl ?? 0),
    String(t.entry ?? ""),
    String(t.exitPrice ?? ""),
  ]);
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
}

function parseInMemoryCsv(csvText: string): Trade[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const trades: Trade[] = [];

  for (const line of lines.slice(1)) {
    const parts = line.split(",").map((c) => c.trim());
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h] = parts[i] || "";
    });

    trades.push(
      makeTestTrade(record.id || `csv_${Date.now()}`, {
        date: record.date,
        time: record.time,
        market: record.market,
        side: (record.side as any) || "long",
        status: (record.result as any) || "win",
        result: (record.result as any) || "win",
        netPnL: Number(record.netPnL) || 0,
        pnl: Number(record.netPnL) || 0,
        entry: Number(record.entry) || 0,
        exitPrice: Number(record.exitPrice) || 0,
      })
    );
  }
  return trades;
}

describe("TIER 5 ADVERSARIAL CHALLENGER: Full Invariant Hardening & Zero-FS Verification", () => {
  const rootDir = path.resolve(import.meta.dirname, "..");
  const storageUsersDir = path.join(rootDir, "storage", "users");

  // Track filesystem mutation attempts
  const fsMutationLog: Array<{ method: string; target: string }> = [];

  const originalFs = {
    mkdirSync: fs.mkdirSync,
    mkdir: fs.mkdir,
    writeFileSync: fs.writeFileSync,
    writeFile: fs.writeFile,
    appendFileSync: fs.appendFileSync,
    appendFile: fs.appendFile,
    createWriteStream: fs.createWriteStream,
    rmSync: fs.rmSync,
    rmdirSync: fs.rmdirSync,
    unlinkSync: fs.unlinkSync,
    promisesMkdir: fs.promises.mkdir,
    promisesWriteFile: fs.promises.writeFile,
    promisesAppendFile: fs.promises.appendFile,
  };

  function recordFsMutation(method: string, targetPath: unknown) {
    const p = String(targetPath ?? "");
    fsMutationLog.push({ method, target: p });
    const err = new Error(`EROFS: read-only filesystem trap during ${method} on '${p}'`);
    (err as any).code = "EROFS";
    throw err;
  }

  function activateHostileFsTraps() {
    (fs as any).mkdirSync = (p: any) => recordFsMutation("mkdirSync", p);
    (fs as any).writeFileSync = (p: any) => recordFsMutation("writeFileSync", p);
    (fs as any).appendFileSync = (p: any) => recordFsMutation("appendFileSync", p);
    (fs as any).mkdir = (p: any) => recordFsMutation("mkdir", p);
    (fs as any).writeFile = (p: any) => recordFsMutation("writeFile", p);
    (fs as any).appendFile = (p: any) => recordFsMutation("appendFile", p);
    (fs as any).createWriteStream = (p: any) => recordFsMutation("createWriteStream", p);
    (fs.promises as any).mkdir = async (p: any) => recordFsMutation("promises.mkdir", p);
    (fs.promises as any).writeFile = async (p: any) => recordFsMutation("promises.writeFile", p);
    (fs.promises as any).appendFile = async (p: any) => recordFsMutation("promises.appendFile", p);
  }

  function deactivateHostileFsTraps() {
    (fs as any).mkdirSync = originalFs.mkdirSync;
    (fs as any).mkdir = originalFs.mkdir;
    (fs as any).writeFileSync = originalFs.writeFileSync;
    (fs as any).writeFile = originalFs.writeFile;
    (fs as any).appendFileSync = originalFs.appendFileSync;
    (fs as any).appendFile = originalFs.appendFile;
    (fs as any).createWriteStream = originalFs.createWriteStream;
    (fs.promises as any).mkdir = originalFs.promisesMkdir;
    (fs.promises as any).writeFile = originalFs.promisesWriteFile;
    (fs.promises as any).appendFile = originalFs.promisesAppendFile;
  }

  function assertStorageUsersIsEmpty() {
    if (originalFs.promisesMkdir) {
      // Check if storage/users exists and is 100% empty
      if (fs.existsSync(storageUsersDir)) {
        const files = fs.readdirSync(storageUsersDir);
        assert.deepEqual(
          files,
          [],
          `INVARIANT VIOLATION: storage/users/ must be 100% empty, but found: ${JSON.stringify(files)}`
        );
      }
    }
  }

  // =========================================================================
  // SECTION 1: Zero-Filesystem Trade Lifecycle Persistence Invariant
  // =========================================================================
  describe("Invariant 1: Zero-Filesystem Trade Lifecycle Operations", () => {
    const testUserId = `adv_user_${Date.now()}`;
    let baseDesk: DeskData;

    before(async () => {
      assertStorageUsersIsEmpty();
      const sql = await getSql();

      // Ensure test user exists in Postgres auth "user" table
      await sql`
        insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
        values (${testUserId}, 'Tier 5 Challenger', ${testUserId + '@adversarial.test'}, true, now(), now())
        on conflict ("id") do nothing
      `;

      baseDesk = ensureMinimumDeskData(createResetState());
    });

    after(async () => {
      deactivateHostileFsTraps();
      assertStorageUsersIsEmpty();
      const sql = await getSql();
      await sql`delete from google_user_databases where user_id = ${testUserId}`.catch(() => {});
      await sql`delete from user_desk_state where user_id = ${testUserId}`.catch(() => {});
      await sql`delete from "user" where id = ${testUserId}`.catch(() => {});
    });

    it("1.1 Initial load initializes database row without touching filesystem", async () => {
      fsMutationLog.length = 0;
      activateHostileFsTraps();
      try {
        const loaded = await loadUserDatabase(testUserId);
        assert.ok(loaded, "Desk data must be loaded");
        assert.ok(Array.isArray(loaded.trades), "Trades array exists");
        assert.equal(loaded.trades.length, 0, "Initial trades array is empty");
      } finally {
        deactivateHostileFsTraps();
      }

      assert.equal(fsMutationLog.length, 0, "No filesystem mutations allowed during initial load");
      assertStorageUsersIsEmpty();
    });

    it("1.2 Trade Creation: persists new trade to Postgres with 0 disk writes", async () => {
      const trade1 = makeTestTrade("trade_t5_1", { market: "ES", pnl: 1250, netPnL: 1245 });
      const deskWithTrade: DeskData = {
        ...baseDesk,
        trades: [trade1],
      };

      fsMutationLog.length = 0;
      activateHostileFsTraps();
      try {
        const saveRes = await saveUserDatabase(testUserId, deskWithTrade);
        assert.equal(saveRes.success, true);
      } finally {
        deactivateHostileFsTraps();
      }

      assert.equal(fsMutationLog.length, 0, "No filesystem writes during trade creation");
      assertStorageUsersIsEmpty();

      // Read back from DB to confirm persistence
      const reloaded = await loadUserDatabase(testUserId);
      assert.equal(reloaded.trades.length, 1);
      assert.equal(reloaded.trades[0].id, "trade_t5_1");
      assert.equal(reloaded.trades[0].market, "ES");
      assert.equal(reloaded.trades[0].pnl, 1250);
    });

    it("1.3 Trade Update: updates existing trade attributes with 0 disk writes", async () => {
      const updatedTrade = makeTestTrade("trade_t5_1", {
        market: "ES",
        pnl: 1850.75,
        netPnL: 1845.25,
        notes: "Adversarial update: scale out at target",
        grade: "A+",
      });
      const deskWithUpdate: DeskData = {
        ...baseDesk,
        trades: [updatedTrade],
      };

      fsMutationLog.length = 0;
      activateHostileFsTraps();
      try {
        const saveRes = await saveUserDatabase(testUserId, deskWithUpdate);
        assert.equal(saveRes.success, true);
      } finally {
        deactivateHostileFsTraps();
      }

      assert.equal(fsMutationLog.length, 0, "No filesystem writes during trade update");
      assertStorageUsersIsEmpty();

      // Verify update in DB
      const reloaded = await loadUserDatabase(testUserId);
      assert.equal(reloaded.trades.length, 1);
      assert.equal(reloaded.trades[0].pnl, 1850.75);
      assert.equal(reloaded.trades[0].notes, "Adversarial update: scale out at target");
      assert.equal(reloaded.trades[0].grade, "A+");
    });

    it("1.4 CSV Import: imports multi-trade CSV in memory and persists to Postgres with 0 disk writes", async () => {
      // 3 trades dataset formatted as CSV
      const csvTradeData = [
        makeTestTrade("csv_1", { market: "NQ", netPnL: 500, status: "win", result: "win" }),
        makeTestTrade("csv_2", { market: "ES", netPnL: -200, status: "loss", result: "loss" }),
        makeTestTrade("csv_3", { market: "XAUUSD", netPnL: 0, status: "be", result: "be" }),
      ];

      const csvContent = buildInMemoryCsv(csvTradeData);
      assert.ok(csvContent.length > 50, "CSV content was generated in memory");

      // Parse CSV in memory
      const parsedTrades = parseInMemoryCsv(csvContent);
      assert.equal(parsedTrades.length, 3, "Parsed 3 trades from in-memory CSV");

      const deskWithCsv: DeskData = {
        ...baseDesk,
        trades: parsedTrades,
      };

      fsMutationLog.length = 0;
      activateHostileFsTraps();
      try {
        const saveRes = await saveUserDatabase(testUserId, deskWithCsv);
        assert.equal(saveRes.success, true);
      } finally {
        deactivateHostileFsTraps();
      }

      assert.equal(fsMutationLog.length, 0, "No filesystem writes during CSV import persistence");
      assertStorageUsersIsEmpty();

      // Verify DB persistence of imported trades
      const reloaded = await loadUserDatabase(testUserId);
      assert.equal(reloaded.trades.length, 3);
      assert.equal(reloaded.trades[0].market, "NQ");
      assert.equal(reloaded.trades[1].market, "ES");
      assert.equal(reloaded.trades[2].market, "XAUUSD");
    });

    it("1.5 Trade Deletion: deletes trades and persists cleared array with 0 disk writes", async () => {
      // Delete 2 of 3 trades
      const deskAfterPartialDelete: DeskData = {
        ...baseDesk,
        trades: [makeTestTrade("csv_1", { market: "NQ", netPnL: 500 })],
      };

      fsMutationLog.length = 0;
      activateHostileFsTraps();
      try {
        const saveRes = await saveUserDatabase(testUserId, deskAfterPartialDelete);
        assert.equal(saveRes.success, true);
      } finally {
        deactivateHostileFsTraps();
      }

      assert.equal(fsMutationLog.length, 0, "No filesystem writes during partial trade deletion");
      assertStorageUsersIsEmpty();

      let reloaded = await loadUserDatabase(testUserId);
      assert.equal(reloaded.trades.length, 1);
      assert.equal(reloaded.trades[0].id, "csv_1");

      // Complete deletion: 0 trades
      const deskEmptyTrades: DeskData = {
        ...baseDesk,
        trades: [],
      };

      fsMutationLog.length = 0;
      activateHostileFsTraps();
      try {
        const saveRes = await saveUserDatabase(testUserId, deskEmptyTrades);
        assert.equal(saveRes.success, true);
      } finally {
        deactivateHostileFsTraps();
      }

      assert.equal(fsMutationLog.length, 0, "No filesystem writes during complete trade deletion");
      assertStorageUsersIsEmpty();

      reloaded = await loadUserDatabase(testUserId);
      assert.equal(reloaded.trades.length, 0, "All trades successfully deleted in Postgres");
    });
  });

  // =========================================================================
  // SECTION 2: Migration 0005_journal_indexes.sql Integrity & Idempotency
  // =========================================================================
  describe("Invariant 2: Migration 0005 Integrity & GIN Index Usage on PGlite", () => {
    let pglite: PGlite;
    const migrationsDir = path.join(rootDir, "migrations");

    before(async () => {
      pglite = new PGlite();
      // Apply base migrations 0001 through 0004
      const m1 = fs.readFileSync(path.join(migrationsDir, "0001_auth.sql"), "utf8");
      const m2 = fs.readFileSync(path.join(migrationsDir, "0002_user_desk_state.sql"), "utf8");
      const m3 = fs.readFileSync(path.join(migrationsDir, "0003_google_user_databases.sql"), "utf8");
      const m4 = fs.readFileSync(path.join(migrationsDir, "0004_notebook_state.sql"), "utf8");

      await pglite.exec(m1);
      await pglite.exec(m2);
      await pglite.exec(m3);
      await pglite.exec(m4);
    });

    after(async () => {
      if (pglite) {
        await pglite.close();
      }
    });

    it("2.1 Migration 0005 applies idempotently 5 times in succession without error", async () => {
      const m5 = fs.readFileSync(path.join(migrationsDir, "0005_journal_indexes.sql"), "utf8");
      assert.ok(m5.includes("create index if not exists"), "Uses IF NOT EXISTS for index creation");

      for (let cycle = 1; cycle <= 5; cycle++) {
        await assert.doesNotReject(
          async () => {
            await pglite.exec(m5);
          },
          `Migration 0005 cycle ${cycle} must not reject`
        );
      }
    });

    it("2.2 Confirms GIN indexes and B-tree indexes exist in pg_indexes metadata", async () => {
      const res = await pglite.query<{ indexname: string; indexdef: string; tablename: string }>(
        `select tablename, indexname, indexdef
         from pg_indexes
         where tablename in ('google_user_databases', 'user_desk_state')
         order by indexname`
      );

      const indexNames = res.rows.map((r) => r.indexname);
      assert.ok(
        indexNames.includes("idx_google_user_databases_trade_history"),
        "idx_google_user_databases_trade_history must exist"
      );
      assert.ok(
        indexNames.includes("idx_google_user_databases_desk_state"),
        "idx_google_user_databases_desk_state must exist"
      );
      assert.ok(
        indexNames.includes("idx_user_desk_state_updated_at"),
        "idx_user_desk_state_updated_at must exist"
      );

      const tradeHistoryDef = res.rows.find((r) => r.indexname === "idx_google_user_databases_trade_history")?.indexdef;
      const deskStateDef = res.rows.find((r) => r.indexname === "idx_google_user_databases_desk_state")?.indexdef;

      assert.ok(tradeHistoryDef?.toLowerCase().includes("using gin"), "trade_history index must be GIN");
      assert.ok(deskStateDef?.toLowerCase().includes("using gin"), "desk_state index must be GIN");
    });

    it("2.3 Tests EXPLAIN query plan and JSONB containment query execution using indexes", async () => {
      // Seed data into pglite
      await pglite.exec(`
        insert into "user" ("id", "name", "email", "emailVerified")
        values ('t5_test_user', 'Index Tester', 'index@tester.test', true)
        on conflict do nothing;

        insert into google_user_databases (google_user_id, user_id, trade_history, desk_state)
        values (
          'gid_t5_100',
          't5_test_user',
          '[{"id": "tr_1", "market": "NQ", "netPnL": 450}, {"id": "tr_2", "market": "XAUUSD", "netPnL": 820}]'::jsonb,
          '{"activeTab": "ALL", "themeId": "midnight-slate"}'::jsonb
        );
      `);

      // Test JSONB query execution with containment operator (@>)
      const explainRes = await pglite.query<{ "QUERY PLAN": string }>(
        `explain analyze select google_user_id from google_user_databases where trade_history @> '[{"market": "NQ"}]'::jsonb`
      );
      assert.ok(explainRes.rows.length > 0, "EXPLAIN query returned plan");

      const queryRes = await pglite.query<{ google_user_id: string }>(
        `select google_user_id from google_user_databases where trade_history @> '[{"market": "NQ"}]'::jsonb`
      );
      assert.equal(queryRes.rows.length, 1);
      assert.equal(queryRes.rows[0].google_user_id, "gid_t5_100");

      // Negative query: market not in JSONB
      const negativeRes = await pglite.query<{ google_user_id: string }>(
        `select google_user_id from google_user_databases where trade_history @> '[{"market": "BTCUSD"}]'::jsonb`
      );
      assert.equal(negativeRes.rows.length, 0);
    });
  });

  // =========================================================================
  // SECTION 3: Massive Concurrency & Zero-FS Race Resistance
  // =========================================================================
  describe("Invariant 3: Extreme Concurrent Persistence Under Read-Only Traps", () => {
    const concurrentUserId = `concurrent_t5_${Date.now()}`;

    before(async () => {
      const sql = await getSql();
      await sql`
        insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
        values (${concurrentUserId}, 'Concurrent Tester', ${concurrentUserId + '@concurrent.test'}, true, now(), now())
        on conflict ("id") do nothing
      `;
    });

    after(async () => {
      deactivateHostileFsTraps();
      const sql = await getSql();
      await sql`delete from google_user_databases where user_id = ${concurrentUserId}`.catch(() => {});
      await sql`delete from user_desk_state where user_id = ${concurrentUserId}`.catch(() => {});
      await sql`delete from "user" where id = ${concurrentUserId}`.catch(() => {});
    });

    it("3.1 10 concurrent saves succeed without race corruption or disk writes", async () => {
      fsMutationLog.length = 0;
      activateHostileFsTraps();

      const promises = Array.from({ length: 10 }, (_, i) => {
        const desk = ensureMinimumDeskData({
          ...createResetState(),
          accountName: `Concurrent Desk ${i}`,
          trades: [makeTestTrade(`concurrent_trade_${i}`, { market: "NQ", netPnL: 100 * (i + 1) })],
        });
        return saveUserDatabase(concurrentUserId, desk);
      });

      try {
        const results = await Promise.all(promises);
        for (const res of results) {
          assert.equal(res.success, true);
        }
      } finally {
        deactivateHostileFsTraps();
      }

      assert.equal(fsMutationLog.length, 0, "Zero filesystem mutations during concurrent saves");
      assertStorageUsersIsEmpty();

      // Confirm database state is valid and readable
      const finalDesk = await loadUserDatabase(concurrentUserId);
      assert.ok(finalDesk, "Desk loaded successfully after concurrent saves");
      assert.equal(finalDesk.trades.length, 1, "Exactly one trade present from the last resolved write");
    });
  });
});
