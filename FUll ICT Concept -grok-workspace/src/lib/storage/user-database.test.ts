import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getSql } from "../db.ts";
import {
  loadUserDatabase,
  saveUserDatabase,
  loadUserNotebook,
  saveUserNotebook,
  resolveGoogleUserIdentity,
  ensureUserStorageDirectory,
} from "./user-database.server.ts";
import { createInitialState } from "../ict-defaults.ts";
import type { DeskData, Trade, LiquidityLevel, DailyPlan, WeeklyNarrative } from "../ict-types.ts";

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

    // 5. Verify isolated filesystem folders and files were created for each Google User ID
    const dirA = ensureUserStorageDirectory(googleA_Id);
    const dirB = ensureUserStorageDirectory(googleB_Id);
    assert.ok(existsSync(join(dirA, "trades.json")), "trades.json exists for Google User A");
    assert.ok(existsSync(join(dirA, "map-data.json")), "map-data.json exists for Google User A");
    assert.ok(existsSync(join(dirA, "screenshots.json")), "screenshots.json exists for Google User A");
    assert.ok(existsSync(join(dirB, "trades.json")), "trades.json exists for Google User B");

    const contentTradesA = readFileSync(join(dirA, "trades.json"), "utf-8");
    assert.ok(contentTradesA.includes("trade-a-101"));

    const contentTradesB = readFileSync(join(dirB, "trades.json"), "utf-8");
    assert.ok(!contentTradesB.includes("trade-a-101"), "Account B files must NEVER contain Account A trades");

    // Verify individual decoded screenshot image files were saved in User A's screenshots directory
    const safeTradeId = customTradeA.id.replace(/[^a-zA-Z0-9_-]/g, "_");
    const screenshotHtfFile = join(dirA, "screenshots", `${safeTradeId}_htf.png`);
    const screenshotExecFile = join(dirA, "screenshots", `${safeTradeId}_exec.png`);
    assert.ok(existsSync(screenshotHtfFile), "Physical HTF screenshot image exists in User A storage");
    assert.ok(existsSync(screenshotExecFile), "Physical Exec screenshot image exists in User A storage");

    // Verify User B's screenshot directory does NOT have User A's screenshots
    const userBScreenshotHtf = join(dirB, "screenshots", `${safeTradeId}_htf.png`);
    assert.ok(!existsSync(userBScreenshotHtf), "User B must NEVER have User A's physical screenshot files");

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

    const userDir = ensureUserStorageDirectory(testGoogleId);
    assert.ok(existsSync(join(userDir, "manifest.json")));
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

    const dirA = ensureUserStorageDirectory(googleA_Id);
    assert.equal(existsSync(join(dirA, "notebook.json")), true);

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

    // 5. Verify file content on disk in storage/users/<googleUserId>/notebook.json
    const diskContent = JSON.parse(readFileSync(join(dirA, "notebook.json"), "utf-8"));
    assert.ok(diskContent.folders.includes("User A Custom Folder"));
    assert.ok(diskContent.notes.some((n: any) => n.id === "note-a-custom-1"));

    // 6. User A clears/deletes notes down to empty array -> verify it persists 0 notes and doesn't revert to seed notes
    await saveUserNotebook(userA_Id, {
      folders: initialA.folders,
      notes: [],
    });
    const reloadedEmptyA = await loadUserNotebook(userA_Id);
    assert.equal(reloadedEmptyA.notes.length, 0, "User A with 0 notes must not revert to seed notes");
  });
});
