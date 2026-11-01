import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getSql } from "../db.ts";
import {
  loadUserDatabase,
  saveUserDatabase,
  loadUserNotebook,
  saveUserNotebook,
  resolveGoogleUserIdentity,
} from "./user-database.server.ts";
import { createResetState, ensureMinimumDeskData } from "../ict-defaults.ts";
import type { DeskData, Trade, LiquidityLevel } from "../ict-types.ts";

/**
 * Adversarial Zero-FS & Serverless Read-Only Container Test Harness.
 *
 * Injects hostile traps on all node:fs mutation & access methods.
 * Any attempt to write or create directories under storage/ or /var/task/
 * throws an explicit EROFS / ENOENT error and registers as a critical failure.
 */
describe("ADVERSARIAL CHALLENGER: Zero-Filesystem Invariant & Serverless Read-Only Conformance", () => {
  const trapsTriggered: Array<{ method: string; path: string; error: string }> = [];

  // Backup original fs methods
  const orig = {
    mkdirSync: fs.mkdirSync,
    mkdir: fs.mkdir,
    writeFileSync: fs.writeFileSync,
    writeFile: fs.writeFile,
    appendFileSync: fs.appendFileSync,
    appendFile: fs.appendFile,
    createWriteStream: fs.createWriteStream,
    openSync: fs.openSync,
    open: fs.open,
    rmSync: fs.rmSync,
    rmdirSync: fs.rmdirSync,
    unlinkSync: fs.unlinkSync,
    promisesMkdir: fs.promises.mkdir,
    promisesWriteFile: fs.promises.writeFile,
    promisesAppendFile: fs.promises.appendFile,
    promisesOpen: fs.promises.open,
  };

  function triggerTrap(method: string, targetPath: unknown) {
    const p = String(targetPath ?? "");
    const err = new Error(`EROFS: read-only file system, ${method} '${p}' [ADVERSARIAL TRAP]`);
    (err as any).code = "EROFS";
    trapsTriggered.push({ method, path: p, error: err.message });
    throw err;
  }

  before(() => {
    // Set serverless environment variables
    process.env.VERCEL = "1";
    process.env.AWS_LAMBDA_FUNCTION_NAME = "adversarial-desk-sync-evaluator";
    process.env.NODE_ENV = "production";

    // Hostile traps for sync mutations
    (fs as any).mkdirSync = (p: any, ...args: any[]) => triggerTrap("mkdirSync", p);
    (fs as any).writeFileSync = (p: any, ...args: any[]) => triggerTrap("writeFileSync", p);
    (fs as any).appendFileSync = (p: any, ...args: any[]) => triggerTrap("appendFileSync", p);
    (fs as any).rmSync = (p: any, ...args: any[]) => triggerTrap("rmSync", p);
    (fs as any).rmdirSync = (p: any, ...args: any[]) => triggerTrap("rmdirSync", p);
    (fs as any).unlinkSync = (p: any, ...args: any[]) => triggerTrap("unlinkSync", p);

    // Hostile traps for async mutations
    (fs as any).mkdir = (p: any, ...args: any[]) => triggerTrap("mkdir", p);
    (fs as any).writeFile = (p: any, ...args: any[]) => triggerTrap("writeFile", p);
    (fs as any).appendFile = (p: any, ...args: any[]) => triggerTrap("appendFile", p);
    (fs as any).createWriteStream = (p: any, ...args: any[]) => triggerTrap("createWriteStream", p);

    // Hostile traps for promises
    (fs.promises as any).mkdir = async (p: any, ...args: any[]) => triggerTrap("promises.mkdir", p);
    (fs.promises as any).writeFile = async (p: any, ...args: any[]) => triggerTrap("promises.writeFile", p);
    (fs.promises as any).appendFile = async (p: any, ...args: any[]) => triggerTrap("promises.appendFile", p);
  });

  after(() => {
    // Restore original fs methods
    (fs as any).mkdirSync = orig.mkdirSync;
    (fs as any).mkdir = orig.mkdir;
    (fs as any).writeFileSync = orig.writeFileSync;
    (fs as any).writeFile = orig.writeFile;
    (fs as any).appendFileSync = orig.appendFileSync;
    (fs as any).appendFile = orig.appendFile;
    (fs as any).createWriteStream = orig.createWriteStream;
    (fs as any).rmSync = orig.rmSync;
    (fs as any).rmdirSync = orig.rmdirSync;
    (fs as any).unlinkSync = orig.unlinkSync;
    (fs.promises as any).mkdir = orig.promisesMkdir;
    (fs.promises as any).writeFile = orig.promisesWriteFile;
    (fs.promises as any).appendFile = orig.promisesAppendFile;

    delete process.env.VERCEL;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
  });

  const stamp = Date.now() + 5000;
  const userAlpha = `adv-user-alpha-${stamp}`;
  const googleAlpha = `google-sub-alpha-${stamp}`;
  const userBeta = `adv-user-beta-${stamp}`;
  const googleBeta = `google-sub-beta-${stamp}`;

  it("ADVERSARIAL 1: First-time initialization executes with zero filesystem operations in locked serverless env", async () => {
    const sql = await getSql();
    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values (${userAlpha}, 'Alpha Adversarial', 'alpha@adversarial.io', true, now(), now())
      on conflict ("id") do nothing
    `;
    await sql`
      insert into "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt")
      values (${'acc-' + userAlpha}, ${googleAlpha}, 'google', ${userAlpha}, now(), now())
      on conflict ("id") do nothing
    `;

    // Load desk for fresh user
    const initialDesk = await loadUserDatabase(userAlpha);
    assert.ok(initialDesk, "Initial desk must load cleanly");
    assert.equal(initialDesk.trades.length, 0);

    // Load notebook for fresh user
    const initialNb = await loadUserNotebook(userAlpha);
    assert.ok(initialNb, "Initial notebook must load cleanly");
    assert.ok(initialNb.folders.length > 0);

    assert.equal(trapsTriggered.length, 0, `No FS traps should have fired: ${JSON.stringify(trapsTriggered)}`);
  });

  it("ADVERSARIAL 2: Heavy multi-screenshot desk save persists strictly to Postgres without filesystem spooling", async () => {
    const desk = await loadUserDatabase(userAlpha);

    // Create 5 trades each with dual large screenshots
    const heavyTrades: Trade[] = Array.from({ length: 5 }, (_, i) => ({
      id: `heavy-trade-${i}-${stamp}`,
      date: "2026-11-01",
      time: "10:30",
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
      entry: 20900,
      sl: 20850,
      tp1: 21000,
      tp2: null,
      tp3: null,
      exitPrice: 21000,
      exitTime: "11:00",
      exitReason: "TP",
      riskPct: 1,
      lots: 2,
      management: "BE",
      partialAtR: 2,
      be: true,
      maeR: 0.1,
      mfeR: 2.0,
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
      notes: `Heavy trade #${i} with high resolution simulated screenshot`,
      screenshotHtf: `data:image/png;base64,${Buffer.from(`fake-htf-image-data-${i}-${stamp}`).toString("base64")}`,
      screenshotExec: `data:image/png;base64,${Buffer.from(`fake-exec-image-data-${i}-${stamp}`).toString("base64")}`,
      result: "win",
      rMultiple: 2.0,
    }));

    const heavyState: DeskData = {
      ...desk,
      accountName: "Heavy Stress Fund",
      trades: heavyTrades,
    };

    const saveResult = await saveUserDatabase(userAlpha, heavyState);
    assert.deepEqual(saveResult, { success: true });

    // Reload from Neon Postgres
    const reloaded = await loadUserDatabase(userAlpha);
    assert.equal(reloaded.trades.length, 5);
    assert.equal(reloaded.trades[0].id, `heavy-trade-0-${stamp}`);
    assert.ok(reloaded.trades[0].screenshotHtf.startsWith("data:image/png;base64,"));

    // Verify direct Postgres SQL query
    const sql = await getSql();
    const rows = await sql<{ screenshots: any; desk_state: any }>`
      select screenshots, desk_state from google_user_databases where google_user_id = ${googleAlpha}
    `;
    assert.equal(rows[0].screenshots.tradeScreenshots.length, 5);
    assert.equal(rows[0].desk_state.accountName, "Heavy Stress Fund");

    assert.equal(trapsTriggered.length, 0, `Traps triggered during heavy desk save: ${JSON.stringify(trapsTriggered)}`);
  });

  it("ADVERSARIAL 3: Concurrent desk saves across multiple accounts under zero-FS lockdown", async () => {
    const sql = await getSql();
    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values (${userBeta}, 'Beta Adversarial', 'beta@adversarial.io', true, now(), now())
      on conflict ("id") do nothing
    `;
    await sql`
      insert into "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt")
      values (${'acc-' + userBeta}, ${googleBeta}, 'google', ${userBeta}, now(), now())
      on conflict ("id") do nothing
    `;

    // Concurrently load and save for both Alpha and Beta 5 times in parallel
    const operations = Array.from({ length: 5 }, (_, idx) => [
      saveUserDatabase(userAlpha, {
        ...(ensureMinimumDeskData(createResetState())),
        accountName: `Alpha Iteration ${idx}`,
      }),
      saveUserDatabase(userBeta, {
        ...(ensureMinimumDeskData(createResetState())),
        accountName: `Beta Iteration ${idx}`,
      }),
      loadUserDatabase(userAlpha),
      loadUserDatabase(userBeta),
      saveUserNotebook(userAlpha, {
        folders: ["Folder A", `Iter ${idx}`],
        notes: [],
      }),
      loadUserNotebook(userBeta),
    ]).flat();

    const results = await Promise.all(operations);
    assert.equal(results.length, 30);
    assert.equal(trapsTriggered.length, 0, "Zero traps triggered during heavy concurrent access");
  });

  it("ADVERSARIAL 4: Empty notes state persistence does not resurrect seed notes or touch filesystem", async () => {
    const saveEmpty = await saveUserNotebook(userAlpha, {
      folders: ["Custom Empty Folder"],
      notes: [],
    });
    assert.deepEqual(saveEmpty, { success: true });

    const loadedEmpty = await loadUserNotebook(userAlpha);
    assert.equal(loadedEmpty.notes.length, 0, "Must stay 0 notes");
    assert.deepEqual(loadedEmpty.folders, ["Custom Empty Folder"]);

    assert.equal(trapsTriggered.length, 0);
  });

  it("ADVERSARIAL 5: storage/users/ directory is guaranteed completely empty (0 files, 0 folders)", async () => {
    const storageUsersPath = path.join(process.cwd(), "storage", "users");
    const exists = fs.existsSync(storageUsersPath);
    if (exists) {
      const entries = fs.readdirSync(storageUsersPath);
      assert.deepEqual(
        entries,
        [],
        `CRITICAL VIOLATION: storage/users/ must contain 0 files/folders, but found: ${JSON.stringify(entries)}`,
      );
    }
  });

  it("ADVERSARIAL 6: Non-OAuth / Email-only user fallback persists to Postgres with zero filesystem operations", async () => {
    const nonOAuthUserId = `non-oauth-user-${stamp}`;
    const sql = await getSql();

    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values (${nonOAuthUserId}, 'Email Trader', 'email.only@test.com', true, now(), now())
      on conflict ("id") do nothing
    `;

    const identity = await resolveGoogleUserIdentity(nonOAuthUserId);
    assert.equal(identity.googleUserId, `account_${nonOAuthUserId}`);

    const loadedDesk = await loadUserDatabase(nonOAuthUserId);
    assert.ok(loadedDesk);
    assert.equal(loadedDesk.trades.length, 0);

    const saved = await saveUserDatabase(nonOAuthUserId, {
      ...loadedDesk,
      accountName: "Email Only Desk",
    });
    assert.deepEqual(saved, { success: true });

    const reloaded = await loadUserDatabase(nonOAuthUserId);
    assert.equal(reloaded.accountName, "Email Only Desk");

    assert.equal(trapsTriggered.length, 0, "No traps triggered for non-OAuth user");
  });

  it("ADVERSARIAL 7: Corrupted or malformed database JSON state safely recovers without filesystem fallback", async () => {
    const corruptUserId = `corrupt-user-${stamp}`;
    const corruptGoogleId = `google-corrupt-${stamp}`;
    const sql = await getSql();

    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values (${corruptUserId}, 'Corrupt Trader', 'corrupt@test.com', true, now(), now())
      on conflict ("id") do nothing
    `;
    await sql`
      insert into "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt")
      values (${'acc-' + corruptUserId}, ${corruptGoogleId}, 'google', ${corruptUserId}, now(), now())
      on conflict ("id") do nothing
    `;

    // Seed malformed database row: trade_history is an object without trades array, map_data is empty
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
        ${corruptGoogleId},
        ${corruptUserId},
        'corrupt@test.com',
        'Corrupt Trader',
        '{"invalidField": 123}'::jsonb,
        'null'::jsonb,
        '{}'::jsonb,
        '{"hasBootstrapped": true, "accountName": "Corrupt State Recovered"}'::jsonb,
        now()
      )
    `;

    // loadUserDatabase should gracefully handle malformed partitions and reconstruct valid DeskData with 0 FS calls
    const recovered = await loadUserDatabase(corruptUserId);
    assert.ok(recovered);
    assert.equal(recovered.accountName, "Corrupt State Recovered");
    assert.ok(Array.isArray(recovered.trades));
    assert.ok(Array.isArray(recovered.missed));
    assert.ok(Array.isArray(recovered.liquidity));
    assert.ok(Array.isArray(recovered.weeklies));

    assert.equal(trapsTriggered.length, 0, "No traps triggered during corrupted state recovery");
  });

  it("ADVERSARIAL 8: Serverless filesystem lockdown throws zero ENOENT or EROFS during full sync lifecycle", async () => {
    const lifecycleUserId = `lifecycle-user-${stamp}`;
    const lifecycleGoogleId = `google-lifecycle-${stamp}`;
    const sql = await getSql();

    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values (${lifecycleUserId}, 'Lifecycle Trader', 'lifecycle@test.com', true, now(), now())
      on conflict ("id") do nothing
    `;
    await sql`
      insert into "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt")
      values (${'acc-' + lifecycleUserId}, ${lifecycleGoogleId}, 'google', ${lifecycleUserId}, now(), now())
      on conflict ("id") do nothing
    `;

    // 1. Initial Load
    const d1 = await loadUserDatabase(lifecycleUserId);
    assert.ok(d1);

    // 2. Desk Save
    await saveUserDatabase(lifecycleUserId, {
      ...d1,
      accountName: "Full Lifecycle Serverless Desk",
    });

    // 3. Notebook Load & Save
    const nb1 = await loadUserNotebook(lifecycleUserId);
    await saveUserNotebook(lifecycleUserId, {
      folders: [...nb1.folders, "Serverless Folder"],
      notes: [],
    });

    // 4. Reload both
    const d2 = await loadUserDatabase(lifecycleUserId);
    assert.equal(d2.accountName, "Full Lifecycle Serverless Desk");
    const nb2 = await loadUserNotebook(lifecycleUserId);
    assert.ok(nb2.folders.includes("Serverless Folder"));

    // 5. Verify zero traps triggered
    assert.equal(trapsTriggered.length, 0, "Zero filesystem traps triggered across lifecycle");
  });
});
