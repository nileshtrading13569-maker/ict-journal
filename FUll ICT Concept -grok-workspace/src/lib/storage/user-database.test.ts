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
import { createInitialState } from "../ict-defaults.ts";
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

describe("Multi-User Google Isolated Database & Storage", () => {
  const stamp = Date.now();
  const userA_Id = "test-user-a-" + stamp;
  const googleA_Id = "google-sub-111111111111111111111-" + stamp;
  const emailA = `trader.one.${stamp}@gmail.com`;

  const userB_Id = "test-user-b-" + stamp;
  const googleB_Id = "google-sub-222222222222222222222-" + stamp;
  const emailB = `trader.two.${stamp}@gmail.com`;

  before(async () => {
    const sql = await getSql();

    // Insert user A & account A (Google)
    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values (${userA_Id}, 'Trader One', ${emailA}, true, now(), now())
      on conflict ("id") do nothing
    `;
    await sql`
      insert into "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt")
      values (${'acc-a-' + userA_Id}, ${googleA_Id}, 'google', ${userA_Id}, now(), now())
      on conflict ("id") do nothing
    `;

    // Insert user B & account B (Google)
    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values (${userB_Id}, 'Trader Two', ${emailB}, true, now(), now())
      on conflict ("id") do nothing
    `;
    await sql`
      insert into "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt")
      values (${'acc-b-' + userB_Id}, ${googleB_Id}, 'google', ${userB_Id}, now(), now())
      on conflict ("id") do nothing
    `;
  });

  it("resolves Google User ID correctly from Google OAuth account", async () => {
    const idA = await resolveGoogleUserIdentity(userA_Id);
    assert.equal(idA.googleUserId, googleA_Id);
    assert.equal(idA.email, emailA);

    const idB = await resolveGoogleUserIdentity(userB_Id);
    assert.equal(idB.googleUserId, googleB_Id);
    assert.equal(idB.email, emailB);
  });

  it("automatically creates separate, isolated database and storage for each Google ID", async () => {
    // 1. Initial load for Account A creates isolated storage
    const stateA = await loadUserDatabase(userA_Id);
    assert.ok(stateA);
    assert.equal(stateA.trades.length, 0);

    // 2. Add trades, map data collection, and screenshot to Account A
    const customTradeA: Trade = {
      id: "trade-a-101",
      date: "2026-10-31",
      time: "09:30",
      market: "NQ",
      side: "long",
      modelId: "m1",
      modelName: "Silver Bullet",
      weeklyBias: "bullish",
      dailyBias: "bullish",
      drawOnLiquidity: "PDH",
      location: "discount",
      dealingRange: { high: 21000, low: 20800 },
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
      judas: { present: "yes", direction: "lower", aligned: true, after: "reversal" },
      ote: { used: "used", swingHigh: 20950, swingLow: 20850, retracement: 20880, inside: true, confluence: true },
      smt: { present: "no", pair: "", sweptMarket: "", failedMarket: "", beforeTrigger: false },
      crt: { used: false, reference: "", high: null, low: null, raidSide: "", purge: false, reclaim: false, entryAfterReclaim: false, target: "" },
      intermarket: { dxy: "bearish", yields: "", silver: "", indices: "" },
      entry: 20890,
      sl: 20860,
      tp1: 20980,
      tp2: null,
      tp3: null,
      exitPrice: 20980,
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
      errors: ["No actual error"],
      primaryError: "No actual error",
      deliveryStatus: "delivered",
      grade: "A+",
      emotion: "calm",
      ruleFollowed: true,
      notes: "Account A private trade note",
      // High-res screenshot test
      screenshotHtf: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      screenshotExec: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      result: "win",
      rMultiple: 3.0,
    };

    const mapLevelA: LiquidityLevel = {
      id: "liq-map-a-1",
      date: "2026-10-31",
      market: "NQ",
      timeframe: "1H",
      price: 21050,
      type: "PDH",
      scope: "external",
      status: "untouched",
      dateSwept: "",
      reaction: "Reaction at previous day high",
      consequence: "External liquidity run",
    };

    const updatedStateA: DeskData = {
      ...stateA,
      accountName: "Account A ICT Fund",
      trades: [customTradeA],
      liquidity: [mapLevelA],
    };

    await saveUserDatabase(userA_Id, updatedStateA);

    // 3. Verify Account B loads a completely separate, clean database (0 trades, 0 map items)
    const stateB = await loadUserDatabase(userB_Id);
    assert.notEqual(stateB.accountName, "Account A ICT Fund");
    assert.equal(stateB.trades.length, 0, "Account B must have 0 trades (complete isolation from Account A)");
    assert.equal(stateB.liquidity.length, 0, "Account B must have 0 liquidity levels from Account A");

    // 4. Verify Account A data is preserved and untouched
    const reloadA = await loadUserDatabase(userA_Id);
    assert.equal(reloadA.accountName, "Account A ICT Fund");
    assert.equal(reloadA.trades.length, 1);
    assert.equal(reloadA.trades[0].id, "trade-a-101");
    assert.equal(reloadA.trades[0].screenshotHtf, customTradeA.screenshotHtf);
    assert.equal(reloadA.liquidity.length, 1);
    assert.equal(reloadA.liquidity[0].id, "liq-map-a-1");

    // 5. Verify isolated Postgres database persistence and account isolation
    const sql = await getSql();
    const dbRowsA = await sql<{
      trade_history: any;
      map_data: any;
      screenshots: any;
      desk_state: any;
    }>`
      select trade_history, map_data, screenshots, desk_state
      from google_user_databases
      where google_user_id = ${googleA_Id}
      limit 1
    `;
    assert.equal(dbRowsA.length, 1, "Account A row exists in google_user_databases");
    assert.equal(dbRowsA[0].trade_history.trades.length, 1);
    assert.equal(dbRowsA[0].trade_history.trades[0].id, "trade-a-101");
    assert.equal(dbRowsA[0].screenshots.tradeScreenshots.length, 1);
    assert.equal(dbRowsA[0].screenshots.tradeScreenshots[0].tradeId, "trade-a-101");
    assert.ok(dbRowsA[0].screenshots.tradeScreenshots[0].screenshotHtf.startsWith("data:image/png;base64,"));
    assert.equal(dbRowsA[0].map_data.liquidity.length, 1);
    assert.equal(dbRowsA[0].map_data.liquidity[0].id, "liq-map-a-1");
    assert.equal(dbRowsA[0].desk_state.accountName, "Account A ICT Fund");

    // Verify user_desk_state legacy sync table is also persisted
    const legacyRowsA = await sql<{ state: any }>`
      select state from user_desk_state where user_id = ${userA_Id} limit 1
    `;
    assert.equal(legacyRowsA.length, 1);
    assert.equal(legacyRowsA[0].state.accountName, "Account A ICT Fund");

    // Verify Account B's database row does NOT contain Account A's trades or data
    const dbRowsB = await sql<{ trade_history: any }>`
      select trade_history from google_user_databases where google_user_id = ${googleB_Id} limit 1
    `;
    assert.equal(dbRowsB.length, 1);
    assert.equal(dbRowsB[0].trade_history.trades.length, 0, "Account B database must NEVER contain Account A trades");

    // 6. Account B adds their own trades & map data
    const customTradeB: Trade = {
      ...customTradeA,
      id: "trade-b-202",
      notes: "Account B private note",
      rMultiple: -1.0,
      result: "loss",
    };
    await saveUserDatabase(userB_Id, {
      ...stateB,
      accountName: "Account B Desk",
      trades: [customTradeB],
    });

    // 7. Verify Account A still sees ONLY Account A data (0 trades of Account B)
    const reloadA2 = await loadUserDatabase(userA_Id);
    assert.equal(reloadA2.trades.length, 1);
    assert.equal(reloadA2.trades[0].id, "trade-a-101");
    assert.ok(!reloadA2.trades.some((t) => t.id === "trade-b-202"));

    // 8. Verify Account B sees ONLY Account B data (0 trades of Account A)
    const reloadB2 = await loadUserDatabase(userB_Id);
    assert.equal(reloadB2.trades.length, 1);
    assert.equal(reloadB2.trades[0].id, "trade-b-202");
    assert.ok(!reloadB2.trades.some((t) => t.id === "trade-a-101"));
  });

  it("authenticates via /api/auth/google/dev-signin endpoint and establishes Google session", async () => {
    const { auth } = await import("../auth/server.ts");
    const testGoogleId = "google-sub-ep-" + Date.now();
    const testEmail = `trader.ep.${Date.now()}@gmail.com`;

    const request = new Request("http://localhost:8080/api/auth/google/dev-signin", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        origin: "http://localhost:8080",
      },
      body: JSON.stringify({
        googleId: testGoogleId,
        email: testEmail,
        name: "Endpoint Trader",
      }),
    });

    const response = await auth.handler(request);
    assert.equal(response.status, 200, "Google dev-signin must return 200");
    const json = await response.json();
    assert.ok(json.ok);
    assert.ok(json.user);
    assert.equal(json.googleUserId, testGoogleId);
    assert.equal(json.user.email, testEmail);

    // Verify isolated database was created for this user
    const userDesk = await loadUserDatabase(json.user.id);
    assert.ok(userDesk);
    assert.equal(userDesk.trades.length, 0);

    // Verify database record was persisted in google_user_databases
    const sql = await getSql();
    const rows = await sql<{ google_user_id: string; email: string }>`
      select google_user_id, email
      from google_user_databases
      where google_user_id = ${testGoogleId}
      limit 1
    `;
    assert.equal(rows.length, 1, "User record exists in google_user_databases table");
    assert.equal(rows[0].email, testEmail);
  });

  it("resolves Google User ID when authenticated via grok-google broker provider", async () => {
    const sql = await getSql();
    const brokerUserId = "broker-user-" + Date.now();
    const brokerGoogleId = "google-broker-sub-" + Date.now();

    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values (${brokerUserId}, 'Broker Trader', 'broker@gmail.com', true, now(), now())
      on conflict ("id") do nothing
    `;
    await sql`
      insert into "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt")
      values (${'acc-broker-' + brokerUserId}, ${brokerGoogleId}, 'grok-google', ${brokerUserId}, now(), now())
      on conflict ("id") do nothing
    `;

    const identity = await resolveGoogleUserIdentity(brokerUserId);
    assert.equal(identity.googleUserId, brokerGoogleId);
  });

  it("robustly handles database rows where trade_history or map_data are stored as raw arrays", async () => {
    const sql = await getSql();
    const arrayFormatUserId = "array-format-user-" + Date.now();
    const arrayFormatGoogleId = "google-array-sub-" + Date.now();

    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values (${arrayFormatUserId}, 'Array Trader', 'array@gmail.com', true, now(), now())
      on conflict ("id") do nothing
    `;
    await sql`
      insert into "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt")
      values (${'acc-arr-' + arrayFormatUserId}, ${arrayFormatGoogleId}, 'google', ${arrayFormatUserId}, now(), now())
      on conflict ("id") do nothing
    `;

    // Directly insert row with trade_history as JSON array '[]' (like the SQL default)
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
        ${arrayFormatGoogleId},
        ${arrayFormatUserId},
        'array@gmail.com',
        'Array Trader',
        '[]'::jsonb,
        '[]'::jsonb,
        '{}'::jsonb,
        '{"hasBootstrapped": true, "accountName": "Direct SQL Desk"}'::jsonb,
        now()
      )
    `;

    const loaded = await loadUserDatabase(arrayFormatUserId);
    assert.ok(loaded);
    assert.equal(loaded.accountName, "Direct SQL Desk");
    assert.equal(Array.isArray(loaded.trades), true);
    assert.equal(Array.isArray(loaded.liquidity), true);
  });

  it("loads and saves isolated notebook state for each Google user account", async () => {
    // 1. Initial load generates defaults and creates storage/users/<id>/notebook.json
    const initialA = await loadUserNotebook(userA_Id);
    assert.ok(initialA);
    assert.ok(Array.isArray(initialA.folders));
    assert.ok(initialA.folders.includes("Daily Journal"));
    assert.ok(Array.isArray(initialA.notes));
    assert.ok(initialA.notes.length > 0);

    const sql = await getSql();
    const nbRowsInitial = await sql<{ folders: any; notes: any }>`
      select folders, notes from user_notebook_state where user_id = ${userA_Id} limit 1
    `;
    assert.equal(nbRowsInitial.length, 1, "Initial notebook row created in user_notebook_state");

    // 2. Save custom notes for User A
    const customNoteA = {
      id: "note-a-custom-1",
      folder: "Daily Journal",
      title: "Fri Oct 31, 2026 - User A Custom Tape",
      date: "2026-10-31",
      createdAt: "Oct 31, 2026 09:30AM",
      updatedAt: "Oct 31, 2026 10:00AM",
      pinned: true,
      tags: ["NY AM", "Tape"],
      content: "## Isolated Tape for User A",
      manualMetrics: {
        netPnl: 450.0,
        grossPnl: 480.0,
        commissions: 30.0,
        totalTrades: 2,
        winners: 2,
        losers: 0,
        winrate: 100,
        volume: 8,
        profitFactor: 99.9,
      },
    };

    await saveUserNotebook(userA_Id, {
      folders: [...initialA.folders, "User A Custom Folder"],
      notes: [customNoteA, ...initialA.notes],
    });

    // 3. User B should have independent, isolated notebook data
    const initialB = await loadUserNotebook(userB_Id);
    assert.ok(initialB);
    assert.equal(initialB.folders.includes("User A Custom Folder"), false);
    assert.equal(initialB.notes.some((n) => n.id === "note-a-custom-1"), false);

    // 4. Reload User A notebook from database/storage and verify exact data
    const reloadedA = await loadUserNotebook(userA_Id);
    assert.equal(reloadedA.folders.includes("User A Custom Folder"), true);
    const foundCustom = reloadedA.notes.find((n) => n.id === "note-a-custom-1");
    assert.ok(foundCustom);
    assert.equal(foundCustom.manualMetrics?.netPnl, 450.0);
    assert.equal(foundCustom.manualMetrics?.winrate, 100);

    // 5. Verify database persistence in user_notebook_state and google_user_databases
    const nbRowsCustom = await sql<{ folders: any; notes: any }>`
      select folders, notes from user_notebook_state where user_id = ${userA_Id} limit 1
    `;
    assert.equal(nbRowsCustom.length, 1);
    assert.ok(nbRowsCustom[0].folders.includes("User A Custom Folder"));
    assert.ok(nbRowsCustom[0].notes.some((n: any) => n.id === "note-a-custom-1"));

    const gdbRowsCustom = await sql<{ notebook_state: any }>`
      select notebook_state from google_user_databases where google_user_id = ${googleA_Id} limit 1
    `;
    assert.equal(gdbRowsCustom.length, 1);
    assert.ok(gdbRowsCustom[0].notebook_state.folders.includes("User A Custom Folder"));
    assert.ok(gdbRowsCustom[0].notebook_state.notes.some((n: any) => n.id === "note-a-custom-1"));

    // 6. User A clears/deletes notes down to empty array -> verify it persists 0 notes and doesn't revert to seed notes
    await saveUserNotebook(userA_Id, {
      folders: initialA.folders,
      notes: [],
    });
    const reloadedEmptyA = await loadUserNotebook(userA_Id);
    assert.equal(reloadedEmptyA.notes.length, 0, "User A with 0 notes must not revert to seed notes");
  });

  it("guarantees zero filesystem write or mkdir operations during desk load, save, and sync", async () => {
    const interceptor = setupFsWriteInterceptor();
    const storageUsersDir = join(process.cwd(), "storage", "users");
    const initialFiles = existsSync(storageUsersDir) ? fs.readdirSync(storageUsersDir) : [];

    try {
      // 1. Perform desk load for Account A
      const deskData = await loadUserDatabase(userA_Id);
      assert.ok(deskData, "Desk state loaded successfully");

      // 2. Perform desk save with updated data for Account A
      const modifiedDesk: DeskData = {
        ...deskData,
        accountName: "Zero-FS Verified Desk",
        trades: [
          ...deskData.trades,
          {
            id: "trade-zero-fs-999",
            date: "2026-11-01",
            time: "10:00",
            market: "ES",
            side: "long",
            modelId: "m1",
            modelName: "Silver Bullet",
            weeklyBias: "bullish",
            dailyBias: "bullish",
            drawOnLiquidity: "PDH",
            location: "discount",
            dealingRange: { high: 5900, low: 5850 },
            dealingRangeLabel: "Daily",
            taken: ["SSL"],
            targetLiq: ["BSL"],
            pdArray: "Fair Value Gap",
            pdTimeframe: "5m",
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
            ote: { used: "not-used", swingHigh: 0, swingLow: 0, retracement: 0, inside: false, confluence: false },
            smt: { present: "no", pair: "", sweptMarket: "", failedMarket: "", beforeTrigger: false },
            crt: { used: false, reference: "", high: null, low: null, raidSide: "", purge: false, reclaim: false, entryAfterReclaim: false, target: "" },
            intermarket: { dxy: "bearish", yields: "", silver: "", indices: "" },
            entry: 5860,
            sl: 5850,
            tp1: 5890,
            tp2: null,
            tp3: null,
            exitPrice: 5890,
            exitTime: "10:30",
            exitReason: "TP",
            riskPct: 1,
            lots: 1,
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
            grade: "A",
            emotion: "calm",
            ruleFollowed: true,
            notes: "Zero filesystem write test trade",
            screenshotHtf: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
            screenshotExec: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            result: "win",
            rMultiple: 3.0,
          },
        ],
      };
      await saveUserDatabase(userA_Id, modifiedDesk);

      // 3. Perform notebook load and save
      const nb = await loadUserNotebook(userA_Id);
      assert.ok(nb);
      await saveUserNotebook(userA_Id, nb);

      // 4. Assert zero write or mkdir calls were made to fs
      assert.equal(
        interceptor.calls.length,
        0,
        `Zero filesystem write/mkdir calls should occur, but received: ${JSON.stringify(interceptor.calls)}`,
      );

      // 5. Assert no new files or folders were created on disk under storage/users/
      const currentFiles = existsSync(storageUsersDir) ? fs.readdirSync(storageUsersDir) : [];
      const createdEntries = currentFiles.filter((f) => !initialFiles.includes(f));
      assert.deepEqual(createdEntries, [], "Zero directories or files created on disk");

      // 6. Verify data was persisted directly into Neon Postgres
      const sql = await getSql();
      const rows = await sql<{ desk_state: any }>`
        select desk_state from google_user_databases where google_user_id = ${googleA_Id}
      `;
      assert.equal(rows[0]?.desk_state?.accountName, "Zero-FS Verified Desk");
    } finally {
      interceptor.restore();
    }
  });

  it("recovers desk state from legacy user_desk_state Postgres fallback with zero filesystem operations", async () => {
    const interceptor = setupFsWriteInterceptor();
    const sql = await getSql();
    const legacyStamp = Date.now() + 100;
    const legacyUserId = `legacy-desk-user-${legacyStamp}`;
    const legacyGoogleId = `google-legacy-sub-${legacyStamp}`;

    try {
      // Setup user & account
      await sql`
        insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
        values (${legacyUserId}, 'Legacy Desk Trader', ${`legacy.${legacyStamp}@gmail.com`}, true, now(), now())
        on conflict ("id") do nothing
      `;
      await sql`
        insert into "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt")
        values (${'acc-legacy-' + legacyUserId}, ${legacyGoogleId}, 'google', ${legacyUserId}, now(), now())
        on conflict ("id") do nothing
      `;

      // Seed state ONLY in user_desk_state (no google_user_databases row exists yet)
      const legacyState = {
        ...createInitialState(),
        accountName: "Legacy Restored Account",
        mantra: "Follow the plan",
      };
      await sql`
        insert into user_desk_state (user_id, state, updated_at)
        values (${legacyUserId}, ${JSON.stringify(legacyState)}::jsonb, now())
      `;

      // Verify no row in google_user_databases yet
      const preRows = await sql`
        select google_user_id from google_user_databases where google_user_id = ${legacyGoogleId}
      `;
      assert.equal(preRows.length, 0);

      // Load user database - should recover from user_desk_state and migrate forward
      const recovered = await loadUserDatabase(legacyUserId);
      assert.equal(recovered.accountName, "Legacy Restored Account");
      assert.equal(recovered.mantra, "Follow the plan");

      // Verify row now exists in google_user_databases
      const postRows = await sql<{ desk_state: any }>`
        select desk_state from google_user_databases where google_user_id = ${legacyGoogleId}
      `;
      assert.equal(postRows.length, 1);
      assert.equal(postRows[0]?.desk_state?.accountName, "Legacy Restored Account");

      // Verify zero filesystem calls occurred
      assert.equal(interceptor.calls.length, 0, "Zero filesystem operations during fallback migration");
    } finally {
      interceptor.restore();
    }
  });

  it("recovers notebook state from google_user_databases Postgres fallback with zero filesystem operations", async () => {
    const interceptor = setupFsWriteInterceptor();
    const sql = await getSql();
    const nbStamp = Date.now() + 200;
    const nbFallbackUserId = `nb-fallback-user-${nbStamp}`;
    const nbFallbackGoogleId = `google-nb-sub-${nbStamp}`;

    try {
      await sql`
        insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
        values (${nbFallbackUserId}, 'Notebook Trader', ${`nb.${nbStamp}@gmail.com`}, true, now(), now())
        on conflict ("id") do nothing
      `;
      await sql`
        insert into "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt")
        values (${'acc-nb-' + nbFallbackUserId}, ${nbFallbackGoogleId}, 'google', ${nbFallbackUserId}, now(), now())
        on conflict ("id") do nothing
      `;

      // Seed notebook state ONLY in google_user_databases (user_notebook_state has no row)
      const testNotes = [
        {
          id: "note-pg-fallback-1",
          folder: "Daily Journal",
          title: "Postgres Recovered Tape",
          date: "2026-11-01",
          createdAt: "Nov 01, 2026",
          updatedAt: "Nov 01, 2026",
          pinned: false,
          tags: ["Tape"],
          content: "Pure DB state recovered without filesystem",
        },
      ];
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
          notebook_state,
          updated_at
        )
        values (
          ${nbFallbackGoogleId},
          ${nbFallbackUserId},
          ${`nb.${nbStamp}@gmail.com`},
          'Notebook Trader',
          '[]'::jsonb,
          '{}'::jsonb,
          '{}'::jsonb,
          '{}'::jsonb,
          ${JSON.stringify({ folders: ["Daily Journal", "Postgres Folder"], notes: testNotes, initialized: true })}::jsonb,
          now()
        )
      `;

      // Load user notebook
      const nb = await loadUserNotebook(nbFallbackUserId);
      assert.ok(nb.folders.includes("Postgres Folder"));
      assert.equal(nb.notes.length, 1);
      assert.equal(nb.notes[0].id, "note-pg-fallback-1");

      // Verify zero filesystem calls occurred
      assert.equal(interceptor.calls.length, 0, "Zero filesystem operations during notebook load");
    } finally {
      interceptor.restore();
    }
  });

  it("serverless simulation: verifies desk load and sync succeed when /var/task and storage/ are strictly read-only", async () => {
    const origVercel = process.env.VERCEL;
    const origLambda = process.env.AWS_LAMBDA_FUNCTION_NAME;

    // Simulate Vercel / AWS Lambda environment
    process.env.VERCEL = "1";
    process.env.AWS_LAMBDA_FUNCTION_NAME = "serverless-desk-sync-fn";

    const interceptor = setupFsWriteInterceptor();

    try {
      // 1. Desk load executes cleanly without ENOENT: no such file or directory, mkdir '/var/task/storage/users/...'
      const deskData = await loadUserDatabase(userA_Id);
      assert.ok(deskData);

      // 2. Desk save executes cleanly without ENOENT
      const updatedDesk: DeskData = {
        ...deskData,
        accountName: "Serverless Neon Desk",
      };
      const saveResult = await saveUserDatabase(userA_Id, updatedDesk);
      assert.deepEqual(saveResult, { success: true });

      // 3. Reload desk state from Postgres
      const reloaded = await loadUserDatabase(userA_Id);
      assert.equal(reloaded.accountName, "Serverless Neon Desk");

      // 4. Confirm zero write/mkdir calls occurred
      assert.equal(interceptor.calls.length, 0, "No filesystem operations should be invoked in serverless context");
    } finally {
      interceptor.restore();
      if (origVercel !== undefined) process.env.VERCEL = origVercel;
      else delete process.env.VERCEL;
      if (origLambda !== undefined) process.env.AWS_LAMBDA_FUNCTION_NAME = origLambda;
      else delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    }
  });
});
