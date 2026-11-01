import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs, { existsSync } from "node:fs";
import { join } from "node:path";
import { getSql } from "../db.ts";
import {
  loadUserDatabase,
  saveUserDatabase,
  loadUserNotebook,
  saveUserNotebook,
  resolveGoogleUserIdentity,
} from "./user-database.server.ts";
import { createInitialState, createResetState, defaultPlanFrom } from "../ict-defaults.ts";
import type { DeskData, Trade, LiquidityLevel, DailyPlan, WeeklyNarrative } from "../ict-types.ts";

/**
 * Intercept and spy on all node:fs directory creation and file write methods.
 * Simulates a serverless read-only filesystem (e.g. Vercel on AWS Lambda) by throwing
 * ENOENT if any write/mkdir targets storage/ or /var/task.
 */
function setupFsWriteInterceptor() {
  const calls: Array<{ method: string; path: string }> = [];

  const origMkdirSync = fs.mkdirSync;
  const origWriteFileSync = fs.writeFileSync;
  const origAppendFileSync = fs.appendFileSync;
  const origPromisesMkdir = fs.promises.mkdir;
  const origPromisesWriteFile = fs.promises.writeFile;
  const origPromisesAppendFile = fs.promises.appendFile;

  function intercept(method: string, targetPath: unknown) {
    const pathStr = String(targetPath ?? "");
    calls.push({ method, path: pathStr });
    if (
      pathStr.includes("storage") ||
      pathStr.includes("/var/task") ||
      pathStr.includes("\\var\\task") ||
      pathStr.includes("users")
    ) {
      const err = new Error(`ENOENT: no such file or directory, mkdir '${pathStr}'`);
      (err as any).code = "ENOENT";
      throw err;
    }
  }

  (fs as any).mkdirSync = function (p: any, ...args: any[]) {
    intercept("mkdirSync", p);
    return (origMkdirSync as Function).apply(fs, [p, ...args]);
  };
  (fs as any).writeFileSync = function (p: any, ...args: any[]) {
    intercept("writeFileSync", p);
    return (origWriteFileSync as Function).apply(fs, [p, ...args]);
  };
  (fs as any).appendFileSync = function (p: any, ...args: any[]) {
    intercept("appendFileSync", p);
    return (origAppendFileSync as Function).apply(fs, [p, ...args]);
  };
  (fs.promises as any).mkdir = async function (p: any, ...args: any[]) {
    intercept("promises.mkdir", p);
    return (origPromisesMkdir as Function).apply(fs.promises, [p, ...args]);
  };
  (fs.promises as any).writeFile = async function (p: any, ...args: any[]) {
    intercept("promises.writeFile", p);
    return (origPromisesWriteFile as Function).apply(fs.promises, [p, ...args]);
  };
  (fs.promises as any).appendFile = async function (p: any, ...args: any[]) {
    intercept("promises.appendFile", p);
    return (origPromisesAppendFile as Function).apply(fs.promises, [p, ...args]);
  };

  return {
    calls,
    restore() {
      (fs as any).mkdirSync = origMkdirSync;
      (fs as any).writeFileSync = origWriteFileSync;
      (fs as any).appendFileSync = origAppendFileSync;
      (fs.promises as any).mkdir = origPromisesMkdir;
      (fs.promises as any).writeFile = origPromisesWriteFile;
      (fs.promises as any).appendFile = origPromisesAppendFile;
    },
  };
}

describe("Adversarial & Stress Verification: Pure Postgres Desk Persistence", () => {
  const stamp = Date.now();
  const testUserId = `adv-user-${stamp}`;
  const testGoogleId = `google-sub-adv-${stamp}`;
  const testEmail = `adv.trader.${stamp}@example.com`;

  before(async () => {
    const sql = await getSql();

    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values (${testUserId}, 'Adversarial Trader', ${testEmail}, true, now(), now())
      on conflict ("id") do nothing
    `;
    await sql`
      insert into "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt")
      values (${'acc-adv-' + testUserId}, ${testGoogleId}, 'google', ${testUserId}, now(), now())
      on conflict ("id") do nothing
    `;
  });

  it("Edge Case 1: Cold start for brand-new non-Google account (email-only) with zero filesystem calls", async () => {
    const interceptor = setupFsWriteInterceptor();
    const sql = await getSql();
    const emailOnlyStamp = Date.now() + 500;
    const emailOnlyUserId = `email-only-user-${emailOnlyStamp}`;
    const emailOnlyAddr = `trader.noauth.${emailOnlyStamp}@example.com`;

    try {
      await sql`
        insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
        values (${emailOnlyUserId}, 'Email Trader', ${emailOnlyAddr}, true, now(), now())
        on conflict ("id") do nothing
      `;

      // 1. Resolve identity
      const identity = await resolveGoogleUserIdentity(emailOnlyUserId);
      assert.equal(identity.googleUserId, `account_${emailOnlyUserId}`);
      assert.equal(identity.email, emailOnlyAddr);

      // 2. Load desk state for cold user
      const initialDesk = await loadUserDatabase(emailOnlyUserId);
      assert.ok(initialDesk);
      assert.equal(initialDesk.hasBootstrapped, true);
      assert.ok(Array.isArray(initialDesk.phases));
      assert.ok(Array.isArray(initialDesk.instruments));
      assert.equal(initialDesk.trades.length, 0);

      // 3. Confirm row was created in google_user_databases and user_desk_state
      const dbRows = await sql<{ google_user_id: string }>`
        select google_user_id from google_user_databases where google_user_id = ${`account_${emailOnlyUserId}`}
      `;
      assert.equal(dbRows.length, 1);

      const legacyRows = await sql<{ user_id: string }>`
        select user_id from user_desk_state where user_id = ${emailOnlyUserId}
      `;
      assert.equal(legacyRows.length, 1);

      // 4. Confirm zero filesystem calls
      assert.equal(interceptor.calls.length, 0, "Zero filesystem operations on cold start");
    } finally {
      interceptor.restore();
    }
  });

  it("Edge Case 2: Legacy fallback handles corrupt and sparse user_desk_state records cleanly", async () => {
    const interceptor = setupFsWriteInterceptor();
    const sql = await getSql();
    const sparseStamp = Date.now() + 600;
    const sparseUserId = `sparse-legacy-user-${sparseStamp}`;
    const sparseGoogleId = `google-sparse-sub-${sparseStamp}`;

    try {
      await sql`
        insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
        values (${sparseUserId}, 'Sparse Trader', ${`sparse.${sparseStamp}@example.com`}, true, now(), now())
        on conflict ("id") do nothing
      `;
      await sql`
        insert into "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt")
        values (${'acc-sparse-' + sparseUserId}, ${sparseGoogleId}, 'google', ${sparseUserId}, now(), now())
        on conflict ("id") do nothing
      `;

      // Insert severely sparse/corrupt legacy state (only accountName, no phases, instruments, trades)
      await sql`
        insert into user_desk_state (user_id, state, updated_at)
        values (${sparseUserId}, '{"accountName": "Sparse Restored Desk"}'::jsonb, now())
      `;

      // Load user database - should recover and apply defaults
      const recovered = await loadUserDatabase(sparseUserId);
      assert.equal(recovered.accountName, "Sparse Restored Desk");
      assert.equal(recovered.hasBootstrapped, true);
      assert.ok(Array.isArray(recovered.phases) && recovered.phases.length > 0);
      assert.ok(Array.isArray(recovered.instruments) && recovered.instruments.length > 0);
      assert.ok(Array.isArray(recovered.trades));
      assert.equal(recovered.trades.length, 0);

      // Verify it was migrated to google_user_databases
      const gdbRows = await sql<{ desk_state: any }>`
        select desk_state from google_user_databases where google_user_id = ${sparseGoogleId}
      `;
      assert.equal(gdbRows.length, 1);
      assert.equal(gdbRows[0].desk_state.accountName, "Sparse Restored Desk");

      assert.equal(interceptor.calls.length, 0, "Zero filesystem calls during sparse legacy recovery");
    } finally {
      interceptor.restore();
    }
  });

  it("Edge Case 3: Handles google_user_databases with empty or malformed desk_state", async () => {
    const interceptor = setupFsWriteInterceptor();
    const sql = await getSql();
    const malformedStamp = Date.now() + 700;
    const malformedUserId = `malformed-user-${malformedStamp}`;
    const malformedGoogleId = `google-malformed-sub-${malformedStamp}`;

    try {
      await sql`
        insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
        values (${malformedUserId}, 'Malformed Trader', ${`malformed.${malformedStamp}@example.com`}, true, now(), now())
        on conflict ("id") do nothing
      `;
      await sql`
        insert into "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt")
        values (${'acc-mal-' + malformedUserId}, ${malformedGoogleId}, 'google', ${malformedUserId}, now(), now())
        on conflict ("id") do nothing
      `;

      // Seed row with empty desk_state '{}'::jsonb
      await sql`
        insert into google_user_databases (
          google_user_id,
          user_id,
          email,
          name,
          trade_history,
          map_data,
          screenshots,
          desk_state,
          updated_at
        )
        values (
          ${malformedGoogleId},
          ${malformedUserId},
          'malformed@example.com',
          'Malformed Trader',
          '{}'::jsonb,
          '{}'::jsonb,
          '{}'::jsonb,
          '{}'::jsonb,
          now()
        )
      `;

      // Load user database - should safely populate defaults
      const loaded = await loadUserDatabase(malformedUserId);
      assert.ok(loaded);
      assert.equal(loaded.hasBootstrapped, true);
      assert.ok(Array.isArray(loaded.phases));
      assert.ok(Array.isArray(loaded.trades));
      assert.equal(loaded.trades.length, 0);

      assert.equal(interceptor.calls.length, 0);
    } finally {
      interceptor.restore();
    }
  });

  it("Edge Case 4: Base64 screenshots data integrity, partitioning, and byte-for-byte fidelity", async () => {
    const interceptor = setupFsWriteInterceptor();
    const sql = await getSql();

    // Create high-resolution base64 PNG mockup data
    const rawHtfHeader = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAIAAAB7GkOtAAAACXBIWXMA";
    const sampleHtfPayload = rawHtfHeader + "A".repeat(10000) + "==";
    const rawExecHeader = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/";
    const sampleExecPayload = rawExecHeader + "B".repeat(12000) + "==";

    const baseDesk = await loadUserDatabase(testUserId);

    const testTrade1: Trade = {
      id: "trade-b64-1",
      date: "2026-11-01",
      time: "09:30",
      market: "NQ",
      side: "long",
      modelId: "m1",
      modelName: "Silver Bullet",
      weeklyBias: "bullish",
      dailyBias: "bullish",
      drawOnLiquidity: "PDH",
      location: "discount",
      dealingRange: { high: 21200, low: 21000 },
      dealingRangeLabel: "Daily",
      taken: ["SSL"],
      targetLiq: ["BSL"],
      pdArray: "Fair Value Gap",
      pdTimeframe: "15m",
      pdCondition: "fresh",
      triggers: ["Displacement"],
      session: "NY",
      killZone: "NY AM Kill Zone",
      timeModel: "NY open",
      structureBefore: "bullish",
      displacementQuality: "strong",
      fvgCreated: true,
      fvgTimeframe: "5m",
      judas: { present: "no", direction: "", aligned: false, after: "" },
      ote: { used: "used", swingHigh: 21150, swingLow: 21050, retracement: 21080, inside: true, confluence: true },
      smt: { present: "no", pair: "", sweptMarket: "", failedMarket: "", beforeTrigger: false },
      crt: { used: false, reference: "", high: null, low: null, raidSide: "", purge: false, reclaim: false, entryAfterReclaim: false, target: "" },
      intermarket: { dxy: "bearish", yields: "", silver: "", indices: "" },
      entry: 21090,
      sl: 21060,
      tp1: 21180,
      tp2: null,
      tp3: null,
      exitPrice: 21180,
      exitTime: "10:15",
      exitReason: "TP",
      riskPct: 1,
      lots: 2,
      management: "BE",
      partialAtR: 2,
      be: true,
      maeR: 0.2,
      mfeR: 3.0,
      narrativeCorrect: true,
      liquidityCorrect: true,
      locationCorrect: true,
      triggerCorrect: true,
      executionQuality: "optimal",
      managementQuality: "good",
      errors: [],
      primaryError: "No actual error",
      deliveryStatus: "delivered",
      grade: "A+",
      emotion: "calm",
      ruleFollowed: true,
      notes: "Base64 fidelity test trade with HTF and Exec screenshots",
      screenshotHtf: sampleHtfPayload,
      screenshotExec: sampleExecPayload,
      result: "win",
      rMultiple: 3.0,
    };

    const testTrade2: Trade = {
      ...testTrade1,
      id: "trade-b64-2",
      notes: "Trade with only HTF screenshot",
      screenshotHtf: sampleHtfPayload,
      screenshotExec: "",
    };

    const testTrade3: Trade = {
      ...testTrade1,
      id: "trade-b64-3",
      notes: "Trade with NO screenshots",
      screenshotHtf: "",
      screenshotExec: "",
    };

    const deskWithScreenshots: DeskData = {
      ...baseDesk,
      accountName: "Base64 Screenshot Test Desk",
      trades: [testTrade1, testTrade2, testTrade3],
    };

    try {
      // 1. Save desk state
      const saveRes = await saveUserDatabase(testUserId, deskWithScreenshots);
      assert.deepEqual(saveRes, { success: true });

      // 2. Query Neon Postgres table directly to verify partitioning
      const rows = await sql<{
        screenshots: { tradeScreenshots: Array<{ tradeId: string; screenshotHtf: string; screenshotExec: string }> };
        trade_history: { trades: Trade[] };
        desk_state: DeskData;
      }>`
        select screenshots, trade_history, desk_state
        from google_user_databases
        where google_user_id = ${testGoogleId}
        limit 1
      `;
      assert.equal(rows.length, 1);

      // Verify screenshot partitioning: only trades with screenshots are included
      const partitionScreenshots = rows[0].screenshots.tradeScreenshots;
      assert.equal(partitionScreenshots.length, 2, "Only trade 1 and trade 2 partitioned into screenshots");
      assert.equal(partitionScreenshots[0].tradeId, "trade-b64-1");
      assert.equal(partitionScreenshots[0].screenshotHtf, sampleHtfPayload);
      assert.equal(partitionScreenshots[0].screenshotExec, sampleExecPayload);
      assert.equal(partitionScreenshots[1].tradeId, "trade-b64-2");
      assert.equal(partitionScreenshots[1].screenshotHtf, sampleHtfPayload);
      assert.equal(partitionScreenshots[1].screenshotExec, "");

      // 3. Reload desk state via loadUserDatabase
      const reloaded = await loadUserDatabase(testUserId);
      assert.equal(reloaded.trades.length, 3);
      assert.equal(reloaded.trades[0].screenshotHtf, sampleHtfPayload);
      assert.equal(reloaded.trades[0].screenshotExec, sampleExecPayload);
      assert.equal(reloaded.trades[1].screenshotHtf, sampleHtfPayload);
      assert.equal(reloaded.trades[1].screenshotExec, "");
      assert.equal(reloaded.trades[2].screenshotHtf, "");
      assert.equal(reloaded.trades[2].screenshotExec, "");

      // 4. Zero filesystem calls
      assert.equal(interceptor.calls.length, 0, "Zero filesystem operations occurred while storing screenshots");
    } finally {
      interceptor.restore();
    }
  });

  it("Stress Test 5: High-concurrency saves and load-save races without deadlocks or corruption", async () => {
    const interceptor = setupFsWriteInterceptor();
    const concurrentStamp = Date.now() + 800;
    const cUserId = `concurrent-user-${concurrentStamp}`;
    const cGoogleId = `google-concurrent-sub-${concurrentStamp}`;
    const sql = await getSql();

    try {
      await sql`
        insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
        values (${cUserId}, 'Concurrent Trader', ${`conc.${concurrentStamp}@example.com`}, true, now(), now())
        on conflict ("id") do nothing
      `;
      await sql`
        insert into "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt")
        values (${'acc-conc-' + cUserId}, ${cGoogleId}, 'google', ${cUserId}, now(), now())
        on conflict ("id") do nothing
      `;

      const initial = await loadUserDatabase(cUserId);

      // Launch 15 concurrent saves for the same user simultaneously
      const concurrencyLevel = 15;
      const savePromises = Array.from({ length: concurrencyLevel }, (_, idx) => {
        const deskUpdate: DeskData = {
          ...initial,
          accountName: `Concurrent Update #${idx}`,
          mantra: `Mantra Version ${idx}`,
        };
        return saveUserDatabase(cUserId, deskUpdate);
      });

      const results = await Promise.all(savePromises);
      assert.equal(results.length, concurrencyLevel);
      for (const res of results) {
        assert.deepEqual(res, { success: true });
      }

      // Verify that the table contains exactly 1 row for this user (no duplicate keys)
      const rows = await sql<{ account_name: string; count: number }>`
        select count(*)::int as count
        from google_user_databases
        where google_user_id = ${cGoogleId}
      `;
      assert.equal(rows[0].count, 1, "Exactly one row exists after concurrent upserts");

      const legacyRows = await sql<{ count: number }>`
        select count(*)::int as count
        from user_desk_state
        where user_id = ${cUserId}
      `;
      assert.equal(legacyRows[0].count, 1, "Exactly one row in legacy table after concurrent upserts");

      // Now race concurrent reads and writes
      const racePromises: Promise<any>[] = [];
      for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) {
          racePromises.push(loadUserDatabase(cUserId));
        } else {
          racePromises.push(saveUserDatabase(cUserId, { ...initial, accountName: `Raced Desk ${i}` }));
        }
      }
      const raceResults = await Promise.all(racePromises);
      assert.equal(raceResults.length, 10);

      // Verify final load succeeds
      const finalLoad = await loadUserDatabase(cUserId);
      assert.ok(finalLoad);
      assert.ok(finalLoad.accountName.startsWith("Raced Desk") || finalLoad.accountName.startsWith("Concurrent Update"));

      assert.equal(interceptor.calls.length, 0, "Zero filesystem operations under high concurrency");
    } finally {
      interceptor.restore();
    }
  });

  it("Stress Test 6: Large payload with 50 trades, 30 liquidity levels, 20 daily plans, and unicode content", async () => {
    const interceptor = setupFsWriteInterceptor();
    const largeStamp = Date.now() + 900;
    const largeUserId = `large-user-${largeStamp}`;
    const largeGoogleId = `google-large-sub-${largeStamp}`;
    const sql = await getSql();

    try {
      await sql`
        insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
        values (${largeUserId}, 'Large Trader 🚀', ${`large.${largeStamp}@example.com`}, true, now(), now())
        on conflict ("id") do nothing
      `;
      await sql`
        insert into "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt")
        values (${'acc-large-' + largeUserId}, ${largeGoogleId}, 'google', ${largeUserId}, now(), now())
        on conflict ("id") do nothing
      `;

      const base = await loadUserDatabase(largeUserId);

      // Generate 50 trades
      const trades: Trade[] = Array.from({ length: 50 }, (_, i) => ({
        id: `trade-large-${i}`,
        date: "2026-11-01",
        time: `${String(9 + Math.floor(i / 10)).padStart(2, "0")}:${String((i * 5) % 60).padStart(2, "0")}`,
        market: i % 2 === 0 ? "NQ" : "ES",
        side: i % 2 === 0 ? "long" : "short",
        modelId: "m1",
        modelName: "Silver Bullet",
        weeklyBias: "bullish",
        dailyBias: "bullish",
        drawOnLiquidity: "PDH",
        location: "discount",
        dealingRange: { high: 21500, low: 20500 },
        dealingRangeLabel: "Daily",
        taken: ["SSL"],
        targetLiq: ["BSL"],
        pdArray: "Fair Value Gap",
        pdTimeframe: "15m",
        pdCondition: "fresh",
        triggers: ["Displacement"],
        session: "NY",
        killZone: "NY AM Kill Zone",
        timeModel: "NY open",
        structureBefore: "bullish",
        displacementQuality: "strong",
        fvgCreated: true,
        fvgTimeframe: "5m",
        judas: { present: "no", direction: "", aligned: false, after: "" },
        ote: { used: "used", swingHigh: 21400, swingLow: 21200, retracement: 21250, inside: true, confluence: true },
        smt: { present: "no", pair: "", sweptMarket: "", failedMarket: "", beforeTrigger: false },
        crt: { used: false, reference: "", high: null, low: null, raidSide: "", purge: false, reclaim: false, entryAfterReclaim: false, target: "" },
        intermarket: { dxy: "bearish", yields: "", silver: "", indices: "" },
        entry: 21260,
        sl: 21240,
        tp1: 21320,
        tp2: null,
        tp3: null,
        exitPrice: 21320,
        exitTime: "10:00",
        exitReason: "TP",
        riskPct: 1,
        lots: 2,
        management: "BE",
        partialAtR: 2,
        be: true,
        maeR: 0.1,
        mfeR: 3.0,
        narrativeCorrect: true,
        liquidityCorrect: true,
        locationCorrect: true,
        triggerCorrect: true,
        executionQuality: "optimal",
        managementQuality: "good",
        errors: [],
        primaryError: "No actual error",
        deliveryStatus: "delivered",
        grade: "A+",
        emotion: "calm",
        ruleFollowed: true,
        notes: `Trade #${i} with Unicode notes: 🎯 📈 日本語 and accents: éàçüö`,
        screenshotHtf: i % 5 === 0 ? "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" : "",
        screenshotExec: "",
        result: i % 3 === 0 ? "loss" : "win",
        rMultiple: i % 3 === 0 ? -1.0 : 2.5,
      }));

      // Generate 30 liquidity levels
      const liquidity: LiquidityLevel[] = Array.from({ length: 30 }, (_, i) => ({
        id: `liq-lvl-${i}`,
        date: "2026-11-01",
        market: "NQ",
        timeframe: "4H",
        price: 21000 + i * 25,
        type: "PDH",
        scope: "external",
        status: "untouched",
        dateSwept: "",
        reaction: `Reaction level #${i}`,
        consequence: `Liquidity pool target #${i}`,
      }));

      // Generate 20 daily plans
      const dailyPlans: Record<string, DailyPlan> = {};
      for (let d = 1; d <= 20; d++) {
        const dateKey = `2026-11-${String(d).padStart(2, "0")}`;
        const basePlan = defaultPlanFrom(base, dateKey);
        dailyPlans[dateKey] = {
          ...basePlan,
          notes: `Daily plan narrative for ${dateKey} with UTF-8 symbols: ★ ✔ 🚀`,
          scenarios: "Execution of Silver Bullet in NY AM",
        };
      }

      const largeDesk: DeskData = {
        ...base,
        accountName: "Heavy Load Multi-Trade Portfolio 💼",
        trades,
        liquidity,
        dailyPlans,
      };

      await saveUserDatabase(largeUserId, largeDesk);

      const reloaded = await loadUserDatabase(largeUserId);
      assert.equal(reloaded.trades.length, 50);
      assert.equal(reloaded.liquidity.length, 30);
      assert.equal(Object.keys(reloaded.dailyPlans).length, 20);
      assert.equal(reloaded.trades[10].notes, "Trade #10 with Unicode notes: 🎯 📈 日本語 and accents: éàçüö");
      assert.equal(reloaded.accountName, "Heavy Load Multi-Trade Portfolio 💼");

      assert.equal(interceptor.calls.length, 0);
    } finally {
      interceptor.restore();
    }
  });

  it("Edge Case 7: Notebook edge cases — empty notes array, legacy fallback, and special characters", async () => {
    const interceptor = setupFsWriteInterceptor();
    const nbStamp = Date.now() + 1000;
    const nbUserId = `nb-stress-user-${nbStamp}`;
    const nbGoogleId = `google-nb-stress-${nbStamp}`;
    const sql = await getSql();

    try {
      await sql`
        insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
        values (${nbUserId}, 'Notebook Tester', ${`nb.${nbStamp}@example.com`}, true, now(), now())
        on conflict ("id") do nothing
      `;
      await sql`
        insert into "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt")
        values (${'acc-nb-stress-' + nbUserId}, ${nbGoogleId}, 'google', ${nbUserId}, now(), now())
        on conflict ("id") do nothing
      `;

      // 1. Cold start notebook load
      const initialNb = await loadUserNotebook(nbUserId);
      assert.ok(initialNb.folders.length > 0);
      assert.ok(initialNb.notes.length > 0);

      // 2. Clear all notes -> persist empty array
      await saveUserNotebook(nbUserId, {
        folders: ["Custom Archive"],
        notes: [],
      });

      // 3. Reload -> must maintain 0 notes without reverting to default seed notes
      const emptyReload = await loadUserNotebook(nbUserId);
      assert.equal(emptyReload.notes.length, 0, "Empty notes list must not revert to seed notes");
      assert.deepEqual(emptyReload.folders, ["Custom Archive"]);

      // 4. Save note with UTF-8 emoji and markdown
      const richNote = {
        id: "note-rich-1",
        folder: "Custom Archive",
        title: "Markdown & Emoji Test 📝",
        date: "2026-11-01",
        createdAt: "Nov 01, 2026",
        updatedAt: "Nov 01, 2026",
        pinned: true,
        tags: ["Test", "SpecialChars"],
        content: "# Heading\n- Item 1 with `code`\n- Greek: α, β, γ\n- Math: ∑, ∫",
      };
      await saveUserNotebook(nbUserId, {
        folders: ["Custom Archive"],
        notes: [richNote],
      });

      const reloadedRich = await loadUserNotebook(nbUserId);
      assert.equal(reloadedRich.notes.length, 1);
      assert.equal(reloadedRich.notes[0].title, "Markdown & Emoji Test 📝");
      assert.equal(reloadedRich.notes[0].content, richNote.content);

      // 5. Concurrent notebook saves
      const concurrentNbSaves = Array.from({ length: 5 }, (_, i) =>
        saveUserNotebook(nbUserId, {
          folders: ["Custom Archive", `Concurrent Folder ${i}`],
          notes: [{ ...richNote, id: `note-concurrent-${i}` }],
        }),
      );
      await Promise.all(concurrentNbSaves);

      const finalNb = await loadUserNotebook(nbUserId);
      assert.ok(finalNb.notes.length === 1);

      assert.equal(interceptor.calls.length, 0, "Zero filesystem operations during notebook edge cases");
    } finally {
      interceptor.restore();
    }
  });

  it("Validator Invariant: rigorously enforces DeskData schema boundaries and type contract", () => {
    function validateDeskDataStructure(value: unknown): boolean {
      if (typeof value !== "object" || value === null) return false;
      const data = value as Record<string, unknown>;
      return (
        typeof data.hasBootstrapped === "boolean" &&
        typeof data.accountName === "string" &&
        typeof data.phaseId === "number" &&
        typeof data.rules === "object" &&
        data.rules !== null &&
        (data.themeId === undefined || typeof data.themeId === "string") &&
        (data.accentColor === undefined || typeof data.accentColor === "string") &&
        Array.isArray(data.phases) &&
        Array.isArray(data.instruments) &&
        Array.isArray(data.models) &&
        (data.recentlyDeletedModels === undefined || Array.isArray(data.recentlyDeletedModels)) &&
        Array.isArray(data.trades) &&
        Array.isArray(data.missed) &&
        Array.isArray(data.weeklies) &&
        typeof data.dailyPlans === "object" &&
        data.dailyPlans !== null &&
        Array.isArray(data.liquidity) &&
        Array.isArray(data.checklistItems) &&
        typeof data.checks === "object" &&
        data.checks !== null &&
        Array.isArray(data.protocolDays) &&
        Array.isArray(data.newsEvents) &&
        Array.isArray(data.forceClosedDates) &&
        Array.isArray(data.forceOpenDates)
      );
    }

    const validDesk = createResetState();
    assert.equal(validateDeskDataStructure(validDesk), true, "Valid DeskData passes validation");

    // Test rejection of invalid objects
    assert.equal(validateDeskDataStructure(null), false, "null is rejected");
    assert.equal(validateDeskDataStructure(undefined), false, "undefined is rejected");
    assert.equal(validateDeskDataStructure("invalid string"), false, "string is rejected");
    assert.equal(validateDeskDataStructure([]), false, "array is rejected");
    assert.equal(validateDeskDataStructure({}), false, "empty object is rejected");

    // Missing required fields
    const missingTrades = { ...validDesk };
    delete (missingTrades as any).trades;
    assert.equal(validateDeskDataStructure(missingTrades), false, "Missing trades rejected");

    const missingPhases = { ...validDesk };
    delete (missingPhases as any).phases;
    assert.equal(validateDeskDataStructure(missingPhases), false, "Missing phases rejected");

    const wrongPhaseId = { ...validDesk, phaseId: "1" }; // string instead of number
    assert.equal(validateDeskDataStructure(wrongPhaseId), false, "Wrong phaseId type rejected");

    const wrongBootstrapped = { ...validDesk, hasBootstrapped: "true" }; // string instead of boolean
    assert.equal(validateDeskDataStructure(wrongBootstrapped), false, "Wrong hasBootstrapped type rejected");
  });
});
