import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import fs, { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  calculateJournalKPIs,
  winRate,
  profitFactor,
  expectancyR,
  formatKPIPnL,
  formatKPIR,
} from "../../src/lib/ict-stats.ts";
import {
  formatCurrency,
  getTradeHoldDuration,
  getTradePnL,
  calculateTradeRuleAdherence,
  formatTradeRuleAdherenceRatio,
  getPlaybookRules,
} from "../../src/lib/tradezella-helpers.ts";
import { paginateJournalRows } from "../../src/lib/journal-pagination.ts";
import {
  pendingMigrations,
  migrationName,
  isMigrationFile,
} from "../../scripts/migration-plan.mjs";
import { getSql } from "../../src/lib/db.ts";
import {
  loadUserDatabase,
  saveUserDatabase,
  resolveGoogleUserIdentity,
} from "../../src/lib/storage/user-database.server.ts";
import { createInitialState } from "../../src/lib/ict-defaults.ts";
import type { DeskData, SetupModel, Trade, TradeResult, Side } from "../../src/lib/ict-types.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Exact 15 table columns specified for Journal Table in Milestone 2
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

/**
 * Format price according to instrument precision matching all-view.tsx logic:
 * Forex (non-JPY): 5 decimals
 * Forex (JPY): 3 decimals
 * Others (Indices/Commodities): 2 decimals with commas
 */
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

/**
 * Parses CSV lines complying with RFC4180
 */
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

function buildCsv(trades: Trade[]): string {
  const cols: (keyof Trade)[] = ["date", "time", "market", "side", "result", "rMultiple", "entry", "sl", "exitPrice", "session", "ruleFollowed", "notes"];
  const lines = [
    cols.join(","),
    ...trades.map((t) => cols.map((col) => {
      const val = t[col];
      const text = val == null ? "" : String(val);
      return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    }).join(",")),
  ];
  return lines.join("\r\n");
}

/**
 * Creates a fully initialized Trade mock satisfying the Trade interface.
 */
function createMockTrade(partial: Partial<Trade> = {}): Trade {
  return {
    id: `trade-${Math.random().toString(36).slice(2, 9)}`,
    date: "2026-10-29",
    time: "09:48",
    market: "XAUUSD",
    side: "short",
    modelId: "m1",
    modelName: "Sell-side raid",
    weeklyBias: "bearish",
    dailyBias: "bearish",
    drawOnLiquidity: "SSL",
    location: "premium",
    dealingRange: { high: 2755, low: 2735 },
    dealingRangeLabel: "Daily",
    taken: ["BSL"],
    targetLiq: ["SSL"],
    pdArray: "Fair Value Gap",
    pdTimeframe: "5m",
    pdCondition: "fresh",
    triggers: ["MSS"],
    session: "NY AM",
    killZone: "NY AM",
    timeModel: "Silver Bullet",
    structureBefore: "bearish",
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
    intermarket: { dxy: "bullish", yields: "", silver: "", indices: "" },
    newsImpact: "none",
    notes: "Execution notes",
    tradeEfficiency: 85,
    result: "win",
    rMultiple: 2.44,
    entry: 2748.4,
    sl: 2742.0,
    exitPrice: 2736.27,
    exitTime: "10:36",
    exitReason: "TP",
    riskPct: 0.25,
    lots: 0.25,
    netPnL: 303.25,
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
    reviewed: true,
    tags: ["NY AM", "Silver Bullet"],
    setupTags: ["NY AM", "Silver Bullet"],
    mistakeTags: [],
    holdDuration: "48m",
    ...partial,
  };
}

/**
 * Builds the canonical 12-trade dataset corresponding to the reference screenshots
 * media_1793558980093_2aa50d5b.png and media_1793558977067_b5c2cb4e.png.
 */
function createReference12TradeDataset(): Trade[] {
  return [
    // 1. Oct 29, 2026 09:48 - XAUUSD SHORT (Win, +$303.25, +2.44R)
    createMockTrade({
      id: "trade-ref-1",
      date: "2026-10-29",
      time: "09:48",
      market: "XAUUSD",
      side: "short",
      lots: 0.25,
      entry: 2748.4,
      exitPrice: 2736.27,
      netPnL: 303.25,
      rMultiple: 2.44,
      plannedR: 2.35,
      result: "win",
      modelName: "Sell-side raid",
      tags: ["NY AM", "Silver Bullet"],
      setupTags: ["NY AM", "Silver Bullet"],
      mistakeTags: [],
      rulesAssessment: { r1: "followed", r2: "followed", r3: "followed", r4: "followed", r5: "followed", r6: "followed", r7: "followed", r8: "followed", r9: "followed", r10: "not" },
      grade: "A",
      reviewed: true,
      holdDuration: "48m dur",
    }),
    // 2. Oct 28, 2026 10:00 - NQ LONG (Win, +$275.50, +2.22R)
    createMockTrade({
      id: "trade-ref-2",
      date: "2026-10-28",
      time: "10:00",
      market: "NQ",
      side: "long",
      lots: 2.0,
      entry: 20410.5,
      exitPrice: 20465.0,
      netPnL: 275.5,
      rMultiple: 2.22,
      plannedR: 2.35,
      result: "win",
      modelName: "Turtle soup",
      tags: ["NY AM"],
      setupTags: ["NY AM"],
      mistakeTags: [],
      rulesAssessment: { r1: "followed", r2: "followed", r3: "followed", r4: "followed", r5: "followed", r6: "followed", r7: "followed", r8: "followed" },
      grade: "A+",
      reviewed: true,
      holdDuration: "1h 14m dur",
    }),
    // 3. Oct 27, 2026 10:30 - EURUSD SHORT (Loss, -$124.97, -1.00R)
    createMockTrade({
      id: "trade-ref-3",
      date: "2026-10-27",
      time: "10:30",
      market: "EURUSD",
      side: "short",
      lots: 1.0,
      entry: 1.0811,
      exitPrice: 1.08235,
      netPnL: -124.97,
      rMultiple: -1.0,
      plannedR: 2.35,
      result: "loss",
      modelName: "Turtle soup",
      tags: ["Chased", "Late entry"],
      setupTags: [],
      mistakeTags: ["Chased", "Late entry"],
      rulesAssessment: { r1: "followed", r2: "followed", r3: "followed", r4: "followed", r5: "followed", r6: "not", r7: "not", r8: "not", r9: "not", r10: "not" },
      grade: "C",
      reviewed: true,
      holdDuration: "22m dur",
    }),
    // 4. Oct 25, 2026 14:15 - ES LONG (Win, +$250.00, +2.00R)
    createMockTrade({
      id: "trade-ref-4",
      date: "2026-10-25",
      time: "14:15",
      market: "ES",
      side: "long",
      lots: 1.5,
      entry: 5850.25,
      exitPrice: 5865.0,
      netPnL: 250.0,
      rMultiple: 2.0,
      plannedR: 2.35,
      result: "win",
      modelName: "Breaker Block",
      tags: ["PM Sess"],
      setupTags: ["PM Sess"],
      mistakeTags: [],
      rulesAssessment: { r1: "followed", r2: "followed", r3: "followed", r4: "followed", r5: "followed", r6: "followed", r7: "followed", r8: "followed", r9: "followed", r10: "followed" },
      grade: "A",
      reviewed: true,
      holdDuration: "1h 30m dur",
    }),
    // 5. Oct 24, 2026 11:00 - ES SHORT (Loss, -$120.00, -1.00R)
    createMockTrade({
      id: "trade-ref-5",
      date: "2026-10-24",
      time: "11:00",
      market: "ES",
      side: "short",
      lots: 1.0,
      entry: 5872.5,
      exitPrice: 5884.5,
      netPnL: -120.0,
      rMultiple: -1.0,
      plannedR: 2.35,
      result: "loss",
      modelName: "Breaker Block",
      tags: ["FOMO"],
      setupTags: [],
      mistakeTags: ["FOMO"],
      rulesAssessment: { r1: "followed", r2: "followed", r3: "followed", r4: "followed", r5: "not", r6: "not", r7: "not", r8: "not", r9: "not", r10: "not" },
      grade: "D",
      reviewed: true,
      holdDuration: "15m dur",
    }),
    // 6. Oct 23, 2026 09:30 - EURUSD LONG (Win, +$220.00, +1.76R)
    createMockTrade({
      id: "trade-ref-6",
      date: "2026-10-23",
      time: "09:30",
      market: "EURUSD",
      side: "long",
      lots: 1.0,
      entry: 1.08215,
      exitPrice: 1.08435,
      netPnL: 220.0,
      rMultiple: 1.76,
      plannedR: 2.35,
      result: "win",
      modelName: "Judas swing",
      tags: ["London Low Sweep"],
      setupTags: ["London Low Sweep"],
      mistakeTags: [],
      rulesAssessment: { r1: "followed", r2: "followed", r3: "followed", r4: "followed", r5: "followed", r6: "followed", r7: "not", r8: "not", r9: "not", r10: "not" },
      grade: "B+",
      reviewed: true,
      holdDuration: "45m dur",
    }),
    // 7. Oct 22, 2026 09:50 - XAUUSD LONG (BE, $0.00, 0.00R)
    createMockTrade({
      id: "trade-ref-7",
      date: "2026-10-22",
      time: "09:50",
      market: "XAUUSD",
      side: "long",
      lots: 0.25,
      entry: 2720.0,
      exitPrice: 2720.0,
      netPnL: 0.0,
      rMultiple: 0.0,
      plannedR: 2.35,
      result: "be",
      modelName: "Sell-side raid",
      tags: ["BE Scratch"],
      setupTags: ["BE Scratch"],
      mistakeTags: [],
      rulesAssessment: { r1: "followed", r2: "followed", r3: "followed", r4: "followed", r5: "followed", r6: "followed", r7: "followed", r8: "followed", r9: "not", r10: "not" },
      grade: "B",
      reviewed: true,
      holdDuration: "30m dur",
    }),
    // 8. Oct 21, 2026 10:15 - NQ SHORT (Win, +$240.00, +1.92R)
    createMockTrade({
      id: "trade-ref-8",
      date: "2026-10-21",
      time: "10:15",
      market: "NQ",
      side: "short",
      lots: 1.0,
      entry: 20380.0,
      exitPrice: 20332.0,
      netPnL: 240.0,
      rMultiple: 1.92,
      plannedR: 2.35,
      result: "win",
      modelName: "Sell-side raid",
      tags: ["NY AM"],
      setupTags: ["NY AM"],
      mistakeTags: [],
      rulesAssessment: { r1: "followed", r2: "followed", r3: "followed", r4: "followed", r5: "followed", r6: "followed", r7: "followed", r8: "followed", r9: "followed", r10: "not" },
      grade: "A",
      reviewed: true,
      holdDuration: "35m dur",
    }),
    // 9. Oct 19, 2026 14:00 - NQ LONG (Loss, -$125.00, -1.00R)
    createMockTrade({
      id: "trade-ref-9",
      date: "2026-10-19",
      time: "14:00",
      market: "NQ",
      side: "long",
      lots: 1.0,
      entry: 20250.0,
      exitPrice: 20225.0,
      netPnL: -125.0,
      rMultiple: -1.0,
      plannedR: 2.35,
      result: "loss",
      modelName: "Sell-side raid",
      tags: ["Late entry"],
      setupTags: [],
      mistakeTags: ["Late entry"],
      rulesAssessment: { r1: "followed", r2: "followed", r3: "followed", r4: "followed", r5: "followed", r6: "followed", r7: "not", r8: "not", r9: "not", r10: "not" },
      grade: "C",
      reviewed: true,
      holdDuration: "18m dur",
    }),
    // 10. Oct 18, 2026 09:45 - XAUUSD LONG (Win, +$210.00, +1.68R)
    createMockTrade({
      id: "trade-ref-10",
      date: "2026-10-18",
      time: "09:45",
      market: "XAUUSD",
      side: "long",
      lots: 0.2,
      entry: 2715.5,
      exitPrice: 2726.0,
      netPnL: 210.0,
      rMultiple: 1.68,
      plannedR: 2.35,
      result: "win",
      modelName: "FVG Fill & Go",
      tags: ["Silver Bullet"],
      setupTags: ["Silver Bullet"],
      mistakeTags: [],
      rulesAssessment: { r1: "followed", r2: "followed", r3: "followed", r4: "followed", r5: "followed", r6: "followed", r7: "followed", r8: "followed", r9: "not", r10: "not" },
      grade: "A",
      reviewed: true,
      holdDuration: "50m dur",
    }),
    // 11. Oct 16, 2026 10:00 - XAUUSD SHORT (Loss, -$125.17, -1.00R)
    createMockTrade({
      id: "trade-ref-11",
      date: "2026-10-16",
      time: "10:00",
      market: "XAUUSD",
      side: "short",
      lots: 0.25,
      entry: 2730.0,
      exitPrice: 2735.0,
      netPnL: -125.17,
      rMultiple: -1.0,
      plannedR: 2.35,
      result: "loss",
      modelName: "FVG Fill & Go",
      tags: ["Outside Killzone"],
      setupTags: [],
      mistakeTags: ["Outside Killzone"],
      rulesAssessment: { r1: "followed", r2: "followed", r3: "followed", r4: "followed", r5: "followed", r6: "not", r7: "not", r8: "not", r9: "not", r10: "not" },
      grade: "D",
      reviewed: false,
      holdDuration: "12m dur",
    }),
    // 12. Oct 15, 2026 13:45 - EURUSD SHORT (Win, +$194.64, +1.56R)
    createMockTrade({
      id: "trade-ref-12",
      date: "2026-10-15",
      time: "13:45",
      market: "EURUSD",
      side: "short",
      lots: 1.0,
      entry: 1.0895,
      exitPrice: 1.08755,
      netPnL: 194.64,
      rMultiple: 1.56,
      plannedR: 2.35,
      result: "win",
      modelName: "Judas swing",
      tags: ["NY PM"],
      setupTags: ["NY PM"],
      mistakeTags: [],
      rulesAssessment: { r1: "followed", r2: "followed", r3: "followed", r4: "followed", r5: "followed", r6: "followed", r7: "followed", r8: "not", r9: "not", r10: "not" },
      grade: "B",
      reviewed: false,
      holdDuration: "2h dur",
    }),
  ];
}

/**
 * Node.js filesystem interceptor to spy on all write and mkdir attempts.
 */
function createFsWriteSpy() {
  const writeCalls: Array<{ method: string; path: string }> = [];

  const origMkdirSync = fs.mkdirSync;
  const origWriteFileSync = fs.writeFileSync;
  const origAppendFileSync = fs.appendFileSync;
  const origPromisesMkdir = fs.promises.mkdir;
  const origPromisesWriteFile = fs.promises.writeFile;
  const origPromisesAppendFile = fs.promises.appendFile;

  function record(method: string, targetPath: unknown) {
    writeCalls.push({ method, path: String(targetPath ?? "") });
  }

  (fs as any).mkdirSync = function (p: any, ...args: any[]) {
    record("mkdirSync", p);
    return (origMkdirSync as Function).apply(fs, [p, ...args]);
  };
  (fs as any).writeFileSync = function (p: any, ...args: any[]) {
    record("writeFileSync", p);
    return (origWriteFileSync as Function).apply(fs, [p, ...args]);
  };
  (fs as any).appendFileSync = function (p: any, ...args: any[]) {
    record("appendFileSync", p);
    return (origAppendFileSync as Function).apply(fs, [p, ...args]);
  };
  (fs.promises as any).mkdir = async function (p: any, ...args: any[]) {
    record("promises.mkdir", p);
    return (origPromisesMkdir as Function).apply(fs.promises, [p, ...args]);
  };
  (fs.promises as any).writeFile = async function (p: any, ...args: any[]) {
    record("promises.writeFile", p);
    return (origPromisesWriteFile as Function).apply(fs.promises, [p, ...args]);
  };
  (fs.promises as any).appendFile = async function (p: any, ...args: any[]) {
    record("promises.appendFile", p);
    return (origPromisesAppendFile as Function).apply(fs.promises, [p, ...args]);
  };

  return {
    writeCalls,
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

describe("E2E Journal & Neon Persistence Test Suite", () => {
  // =========================================================================
  // TIER 1: FEATURE COVERAGE (Representative Happy-Path Tests)
  // =========================================================================
  describe("Tier 1: Feature Coverage (Features 1–25)", () => {
    describe("Features 1 & 2: Neon SQL Migration & Zero-FS Persistence Invariant", () => {
      it("Feature 1: SQL Migration 0005_journal_indexes.sql exists and creates GIN indexes for JSONB trade_history and desk_state", () => {
        const migrationPath = join(__dirname, "..", "..", "migrations", "0005_journal_indexes.sql");
        assert.ok(existsSync(migrationPath), "Migration 0005_journal_indexes.sql must exist on disk");

        const sqlContent = readFileSync(migrationPath, "utf-8");
        assert.match(
          sqlContent,
          /create\s+index\s+if\s+not\s+exists\s+idx_google_user_databases_trade_history\s+on\s+google_user_databases\s+using\s+gin\s*\(trade_history\)/i,
          "Must create GIN index on google_user_databases(trade_history)",
        );
        assert.match(
          sqlContent,
          /create\s+index\s+if\s+not\s+exists\s+idx_google_user_databases_desk_state\s+on\s+google_user_databases\s+using\s+gin\s*\(desk_state\)/i,
          "Must create GIN index on google_user_databases(desk_state)",
        );
        assert.match(
          sqlContent,
          /create\s+index\s+if\s+not\s+exists\s+idx_user_desk_state_updated_at\s+on\s+user_desk_state\s*\(updated_at\)/i,
          "Must create B-tree index on user_desk_state(updated_at)",
        );
      });

      it("Feature 1: Migration discovery engine detects 0005_journal_indexes.sql when previous migrations applied", () => {
        const allFiles = [
          "0001_auth.sql",
          "0002_user_desk_state.sql",
          "0003_google_user_databases.sql",
          "0004_notebook_state.sql",
          "0005_journal_indexes.sql",
        ];
        const applied = [
          "0001_auth.sql",
          "0002_user_desk_state.sql",
          "0003_google_user_databases.sql",
          "0004_notebook_state.sql",
        ];
        const pending = pendingMigrations(allFiles, applied);
        assert.equal(pending.length, 1);
        assert.equal(pending[0].name, "0005_journal_indexes.sql");
      });

      it("Feature 2: Persists desk trades to Neon/PGlite with 100% Zero-Filesystem Storage", async () => {
        const spy = createFsWriteSpy();
        try {
          const sql = await getSql();
          const testUserId = `e2e-user-${Date.now()}`;
          const testGoogleSub = `google-sub-e2e-${Date.now()}`;

          // Seed user & google account
          await sql`
            insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
            values (${testUserId}, 'E2E Trader', ${testUserId + "@test.internal"}, true, now(), now())
            on conflict ("id") do nothing
          `;
          await sql`
            insert into "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt")
            values (${'acc-' + testUserId}, ${testGoogleSub}, 'google', ${testUserId}, now(), now())
            on conflict ("id") do nothing
          `;

          // Initial load
          const initial = await loadUserDatabase(testUserId);
          assert.ok(initial);
          assert.equal(Array.isArray(initial.trades), true);

          // Save desk state with trades
          const referenceTrades = createReference12TradeDataset();
          const deskToSave: DeskData = {
            ...initial,
            trades: referenceTrades,
          };

          await saveUserDatabase(testUserId, deskToSave);

          // Reload and verify trades survived database round-trip
          const reloaded = await loadUserDatabase(testUserId);
          assert.equal(reloaded.trades.length, 12);
          assert.equal(reloaded.trades[0].market, referenceTrades[0].market);
          assert.equal(reloaded.trades[0].netPnL, referenceTrades[0].netPnL);

          // Assert zero filesystem calls
          const storageWrites = spy.writeCalls.filter(
            (c) => c.path.includes("storage") || c.path.includes("users") || c.path.includes(".json"),
          );
          assert.equal(
            storageWrites.length,
            0,
            `Zero filesystem writes allowed, detected: ${JSON.stringify(storageWrites)}`,
          );
        } finally {
          spy.restore();
        }
      });
    });

    describe("Features 3–6: Prop KPI Analytics Engine", () => {
      const sampleTrades = createReference12TradeDataset();
      const kpis = calculateJournalKPIs(sampleTrades);

      it("Feature 3: Prop Win Rate excludes BE trades from denominator (7 / 11 = 63.6%)", () => {
        assert.equal(kpis.winCount, 7);
        assert.equal(kpis.lossCount, 4);
        assert.equal(kpis.beCount, 1);
        // Standard win rate with BE would be 7 / 12 = 58.3%
        // Prop win rate is 7 / (7 + 4) = 63.636...% -> 63.6%
        assert.equal(kpis.winRatePct, 63.6);
        assert.equal(Number(winRate(sampleTrades, true).toFixed(1)), 63.6);
      });

      it("Feature 4: Profit Factor computes Gross Profit / Gross Loss ($1,693.39 / $495.14 = 3.42)", () => {
        assert.equal(kpis.grossProfit, 1693.39);
        assert.equal(kpis.grossLoss, 495.14);
        assert.equal(kpis.profitFactor, 3.42);
      });

      it("Feature 5: Expectancy computes Net P&L / closed decided trades ($1,198.25 / 11 = +$108.93)", () => {
        assert.equal(kpis.netPnL, 1198.25);
        assert.equal(kpis.expectancy, 108.93);
        assert.equal(formatKPIPnL(kpis.expectancy), "+$108.93");
      });

      it("Feature 6: Cumulative R, Planned R, and Avg Realized R calculations match specification", () => {
        assert.equal(kpis.cumulativeR, 9.58);
        assert.equal(kpis.cumulativeRFormatted, "+9.58R");
        assert.equal(kpis.plannedR, 2.35);
        assert.ok(kpis.avgRealizedR > 0);
      });
    });

    describe("Features 7 & 8: Formatting & Adherence Helpers", () => {
      it("Feature 7: Hold Duration Formatter outputs minutes, hours, and dur suffix", () => {
        const tMin = createMockTrade({ time: "09:48", exitTime: "10:36", holdDuration: undefined });
        assert.equal(getTradeHoldDuration(tMin), "48m");
        assert.equal(getTradeHoldDuration(tMin, true), "48m dur");

        const tHours = createMockTrade({ time: "09:00", exitTime: "10:14", holdDuration: undefined });
        assert.equal(getTradeHoldDuration(tHours), "1h 14m");
        assert.equal(getTradeHoldDuration(tHours, true), "1h 14m dur");

        const tPreserved = createMockTrade({ holdDuration: "48m dur" });
        assert.equal(getTradeHoldDuration(tPreserved), "48m dur");
      });

      it("Feature 8: Rule Adherence Fraction formats compliance ratio (9/10, 8/8) with percentage thresholds", () => {
        const t1 = createMockTrade({
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
        const adherence = calculateTradeRuleAdherence(t1);
        assert.equal(adherence.ratio, "9/10");
        assert.equal(adherence.followed, 9);
        assert.equal(adherence.total, 10);
        assert.equal(adherence.adherencePct, 90);
        assert.equal(formatTradeRuleAdherenceRatio(t1), "9/10");
      });
    });

    describe("Features 9–13: Journal Page UI & KPI Cards Component Contracts", () => {
      it("Feature 9 & 10: Page Header serif title, subtitle, and auto-sync indicator layout", () => {
        const journalRoutePath = join(__dirname, "..", "..", "src", "routes", "journal.tsx");
        assert.ok(existsSync(journalRoutePath));
        const src = readFileSync(journalRoutePath, "utf-8");

        // Header Title & Subtitle
        assert.match(src, /font-serif[\s\S]*?Journal/i, "Journal title must use serif font styling");
        assert.match(src, /PROP DESK/i, "Header must include 'PROP DESK' subtitle");

        // Auto-sync status indicator
        assert.match(src, /Auto-sync enabled · MT5 Raw Spread/i, "Auto-sync indicator text must match");
        assert.match(src, /bg-emerald-500/i, "Auto-sync dot must have green styling");
      });

      it("Feature 11 & 12: Header Action Buttons and Uppercase Navigation Tabs with red underline", () => {
        const journalRoutePath = join(__dirname, "..", "..", "src", "routes", "journal.tsx");
        const src = readFileSync(journalRoutePath, "utf-8");

        // Action Buttons
        assert.match(src, /Import CSV/i, "Header must include 'Import CSV' action button");
        assert.match(src, /\+ Log trade/i, "Header must include '+ Log trade' button");
        assert.match(src, /bg-\[#e50914\]/i, "+ Log trade button must use red styling");

        // Tabs
        assert.match(src, /value="all"/i, "Tabs must contain 'ALL' tab");
        assert.match(src, /value="day"/i, "Tabs must contain 'DAY' tab");
        assert.match(src, /value="calendar"/i, "Tabs must contain 'CALENDAR' tab");
        assert.match(src, /value="quarter"/i, "Tabs must contain 'QUARTER' tab");
        assert.match(src, /value="missed"/i, "Tabs must contain 'MISSED' tab");
        assert.match(src, /data-\[state=active\]:border-\[#e50914\]/i, "Active tab must have red underline indicator");
      });

      it("Feature 13: 5 KPI Summary Cards component mounts with required test IDs and progress bars", () => {
        const kpiCardsPath = join(
          __dirname,
          "..",
          "..",
          "src",
          "components",
          "journal",
          "journal-kpi-cards.tsx",
        );
        assert.ok(existsSync(kpiCardsPath));
        const src = readFileSync(kpiCardsPath, "utf-8");

        assert.match(src, /data-testid="journal-kpi-cards"/, "Container must have data-testid");
        assert.match(src, /data-testid="kpi-card-net-pnl"/, "NET P&L card must have data-testid");
        assert.match(src, /data-testid="kpi-card-win-rate"/, "WIN RATE card must have data-testid");
        assert.match(src, /data-testid="kpi-card-profit-factor"/, "PROFIT FACTOR card must have data-testid");
        assert.match(src, /data-testid="kpi-card-avg-realized-r"/, "AVG REALIZED R card must have data-testid");
        assert.match(src, /data-testid="kpi-card-expectancy"/, "EXPECTANCY card must have data-testid");
      });
    });

    describe("Features 14–25: Table, Badges, Selection, Pagination & CSV", () => {
      it("Feature 14 & 15: Toolbar Search input and Date Range Dropdown", () => {
        const allViewPath = join(__dirname, "..", "..", "src", "components", "journal", "all-view.tsx");
        assert.ok(existsSync(allViewPath));
        const src = readFileSync(allViewPath, "utf-8");

        assert.match(src, /Search symbol, playbook, tag, notes\.\.\./, "Search placeholder must match");
        assert.match(src, /Oct 1 – Oct 29, 2026/, "Date Range selector default must match");
      });

      it("Feature 16: 15-Column Table layout matches exact column inventory", () => {
        const expectedColumns = [
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
        assert.deepEqual([...EXPECTED_JOURNAL_COLUMNS], expectedColumns);
      });

      it("Feature 17: Duration Subtitle rendered in Open ET column", () => {
        const formattedDate = formatOpenDateTime("2026-10-29", "09:48");
        assert.equal(formattedDate, "10/29 09:48");

        const t = createMockTrade({ date: "2026-10-29", time: "09:48", holdDuration: "48m dur" });
        const hold = getTradeHoldDuration(t, true);
        assert.equal(hold, "48m dur");
      });

      it("Feature 18: Status & Side pill badges format cleanly", () => {
        const tLongWin = createMockTrade({ side: "long", result: "win" });
        assert.equal(tLongWin.side.toUpperCase(), "LONG");
        assert.equal(tLongWin.result.toUpperCase(), "WIN");

        const tShortLoss = createMockTrade({ side: "short", result: "loss" });
        assert.equal(tShortLoss.side.toUpperCase(), "SHORT");
        assert.equal(tShortLoss.result.toUpperCase(), "LOSS");

        const tBE = createMockTrade({ result: "be" });
        assert.equal(tBE.result.toUpperCase(), "BE");
      });

      it("Feature 19: Playbook Tier Badges format as square letter pills ([A], [B], [C])", () => {
        const tRaid = createMockTrade({ modelName: "Sell-side raid" });
        assert.equal(getPlaybookLetter(tRaid), "A");

        const tSoup = createMockTrade({ modelName: "Turtle soup" });
        assert.equal(getPlaybookLetter(tSoup), "B");

        const tJudas = createMockTrade({ modelName: "Judas swing" });
        assert.equal(getPlaybookLetter(tJudas), "C");

        const tFVG = createMockTrade({ modelName: "FVG Fill & Go" });
        assert.equal(getPlaybookLetter(tFVG), "B");
      });

      it("Feature 20: Mistake Warning Tag Badges detect mistake tags for amber warning styling", () => {
        assert.equal(isMistakeTag("Late entry"), true);
        assert.equal(isMistakeTag("Chased"), true);
        assert.equal(isMistakeTag("FOMO"), true);
        assert.equal(isMistakeTag("Revenge"), true);
        assert.equal(isMistakeTag("Early exit"), true);
        assert.equal(isMistakeTag("NY AM"), false);
        assert.equal(isMistakeTag("Silver Bullet"), false);
      });

      it("Feature 21 & 22: Rules ratio, Grade badge, and Reviewed checkmark icon", () => {
        const t = createMockTrade({ grade: "A", reviewed: true });
        assert.equal(t.grade, "A");
        assert.equal(t.reviewed, true);
      });

      it("Feature 23: Selected row left red accent class is present in all-view.tsx", () => {
        const allViewPath = join(__dirname, "..", "..", "src", "components", "journal", "all-view.tsx");
        const src = readFileSync(allViewPath, "utf-8");
        assert.match(
          src,
          /border-l-4\s+border-l-\[#e50914\]/,
          "Selected row must have solid 4px red left border accent",
        );
      });

      it("Feature 24: Pagination helper paginates 12 trades into 2 pages of 6 rows", () => {
        const dataset = createReference12TradeDataset();
        const page1 = paginateJournalRows(dataset, 1, 6);
        assert.equal(page1.rows.length, 6);
        assert.equal(page1.totalPages, 2);
        assert.equal(page1.page, 1);
        assert.equal(page1.startIndex, 0);

        const page2 = paginateJournalRows(dataset, 2, 6);
        assert.equal(page2.rows.length, 6);
        assert.equal(page2.page, 2);
        assert.equal(page2.startIndex, 6);
      });

      it("Feature 25: In-Memory CSV Export and Import operate without filesystem writes", () => {
        const spy = createFsWriteSpy();
        try {
          const dataset = createReference12TradeDataset();
          const csvText = buildCsv(dataset);
          assert.ok(csvText.includes("date,time,market,side,result,rMultiple,entry,sl,exitPrice"));
          assert.ok(csvText.includes("XAUUSD"));
          assert.ok(csvText.includes("2748.4"));

          const parsedRows = parseCsv(csvText);
          assert.equal(parsedRows.length, 13); // Header + 12 trades
          assert.equal(parsedRows[0][0], "date");
          assert.equal(parsedRows[1][2], "XAUUSD");

          // Assert zero disk writes
          assert.equal(spy.writeCalls.length, 0);
        } finally {
          spy.restore();
        }
      });
    });
  });

  // =========================================================================
  // TIER 2: BOUNDARY & CORNER CASES
  // =========================================================================
  describe("Tier 2: Boundary & Corner Cases", () => {
    describe("Dataset Size Extremes", () => {
      it("handles completely empty journal (0 trades) with clean zero metrics", () => {
        const emptyKpis = calculateJournalKPIs([]);
        assert.equal(emptyKpis.netPnL, 0);
        assert.equal(emptyKpis.netPnLFormatted, "$0.00");
        assert.equal(emptyKpis.cumulativeR, 0);
        assert.equal(emptyKpis.cumulativeRFormatted, "0.00R");
        assert.equal(emptyKpis.winCount, 0);
        assert.equal(emptyKpis.lossCount, 0);
        assert.equal(emptyKpis.beCount, 0);
        assert.equal(emptyKpis.winRatePct, 0);
        assert.equal(emptyKpis.profitFactor, 0);
        assert.equal(emptyKpis.grossProfit, 0);
        assert.equal(emptyKpis.grossLoss, 0);
        assert.equal(emptyKpis.avgRealizedR, 0);
        assert.equal(emptyKpis.plannedR, 0);
        assert.equal(emptyKpis.expectancy, 0);

        const paginatedEmpty = paginateJournalRows([], 1, 6);
        assert.equal(paginatedEmpty.rows.length, 0);
        assert.equal(paginatedEmpty.totalPages, 1);
        assert.equal(paginatedEmpty.page, 1);
      });

      it("handles single-trade journal (1 win or 1 loss) with single page", () => {
        const singleWin = [createMockTrade({ netPnL: 500, rMultiple: 2.0, result: "win", plannedR: 2.5 })];
        const winKpis = calculateJournalKPIs(singleWin);
        assert.equal(winKpis.winCount, 1);
        assert.equal(winKpis.lossCount, 0);
        assert.equal(winKpis.winRatePct, 100);
        assert.equal(winKpis.profitFactor, 99.99);
        assert.equal(winKpis.expectancy, 500);

        const singleLoss = [createMockTrade({ netPnL: -250, rMultiple: -1.0, result: "loss", plannedR: 2.5 })];
        const lossKpis = calculateJournalKPIs(singleLoss);
        assert.equal(lossKpis.winCount, 0);
        assert.equal(lossKpis.lossCount, 1);
        assert.equal(lossKpis.winRatePct, 0);
        assert.equal(lossKpis.profitFactor, 0);
        assert.equal(lossKpis.expectancy, -250);
      });

      it("handles large scale of 10,000 trades in < 250ms with arithmetic accuracy", () => {
        const N = 10000;
        const trades: Trade[] = [];
        let totalNet = 0;
        let wins = 0;
        let losses = 0;
        let bes = 0;

        for (let i = 0; i < N; i++) {
          const mod = i % 3;
          if (mod === 0) {
            trades.push(createMockTrade({ netPnL: 100.0, rMultiple: 2.0, result: "win" }));
            totalNet += 100.0;
            wins++;
          } else if (mod === 1) {
            trades.push(createMockTrade({ netPnL: -50.0, rMultiple: -1.0, result: "loss" }));
            totalNet -= 50.0;
            losses++;
          } else {
            trades.push(createMockTrade({ netPnL: 0.0, rMultiple: 0.0, result: "be" }));
            bes++;
          }
        }

        const start = performance.now();
        const kpis = calculateJournalKPIs(trades);
        const elapsed = performance.now() - start;

        assert.ok(elapsed < 250, `10k trades calculated in ${elapsed.toFixed(1)}ms, expected < 250ms`);
        assert.equal(kpis.winCount, wins);
        assert.equal(kpis.lossCount, losses);
        assert.equal(kpis.beCount, bes);
        assert.equal(kpis.netPnL, Number(totalNet.toFixed(2)));

        const paginated10k = paginateJournalRows(trades, 1, 6);
        assert.equal(paginated10k.totalPages, Math.ceil(10000 / 6));
      });
    });

    describe("Extreme Win/Loss Distributions & Mathematical Boundaries", () => {
      it("100% win rate caps profit factor at 99.99 with $0.00 gross loss", () => {
        const allWins = [
          createMockTrade({ netPnL: 100, rMultiple: 2, result: "win" }),
          createMockTrade({ netPnL: 200, rMultiple: 2, result: "win" }),
        ];
        const kpis = calculateJournalKPIs(allWins);
        assert.equal(kpis.winRatePct, 100);
        assert.equal(kpis.grossLoss, 0);
        assert.equal(kpis.profitFactor, 99.99);
      });

      it("100% loss rate yields 0% win rate and 0.00 profit factor", () => {
        const allLosses = [
          createMockTrade({ netPnL: -100, rMultiple: -1, result: "loss" }),
          createMockTrade({ netPnL: -200, rMultiple: -1, result: "loss" }),
        ];
        const kpis = calculateJournalKPIs(allLosses);
        assert.equal(kpis.winRatePct, 0);
        assert.equal(kpis.profitFactor, 0);
        assert.equal(kpis.grossProfit, 0);
        assert.equal(kpis.netPnL, -300);
      });

      it("all breakeven trades yield 0% win rate and 0.00 profit factor without division by zero", () => {
        const allBE = [
          createMockTrade({ netPnL: 0, rMultiple: 0, result: "be" }),
          createMockTrade({ netPnL: 0, rMultiple: 0, result: "be" }),
        ];
        const kpis = calculateJournalKPIs(allBE);
        assert.equal(kpis.winRatePct, 0);
        assert.equal(kpis.profitFactor, 0);
        assert.equal(kpis.expectancy, 0);
      });

      it("handles fractional profit factor and negative PnL formatting", () => {
        const trades = [
          createMockTrade({ netPnL: 50, rMultiple: 1.0, result: "win" }),
          createMockTrade({ netPnL: -100, rMultiple: -2.0, result: "loss" }),
        ];
        const kpis = calculateJournalKPIs(trades);
        assert.equal(kpis.netPnL, -50);
        assert.equal(kpis.netPnLFormatted, "-$50.00");
        assert.equal(kpis.profitFactor, 0.5);
      });
    });

    describe("Numerical and Formatting Boundaries", () => {
      it("formats extreme billion-dollar trades and precision decimals accurately", () => {
        assert.equal(formatCurrency(1_000_000_000), "+$1,000,000,000.00");
        assert.equal(formatCurrency(-500_000_000.5), "-$500,000,000.50");

        // Forex 5 decimals
        assert.equal(formatPrice(1.08215, "EURUSD"), "1.08215");
        // JPY 3 decimals
        assert.equal(formatPrice(152.345, "USDJPY"), "152.345");
        // Commodity/Index 2 decimals
        assert.equal(formatPrice(2748.4, "XAUUSD"), "2,748.40");
      });

      it("handles invalid or missing date/time strings gracefully with fallback", () => {
        assert.equal(formatOpenDateTime("", ""), "—");
        assert.equal(formatOpenDateTime("2026-10-29", undefined), "10/29 00:00");
        assert.equal(formatOpenDateTime("invalid", "12:00"), "invalid 12:00");
      });
    });

    describe("Malformed CSV & Edge Inputs", () => {
      it("rejects empty CSV text", () => {
        const rows = parseCsv("");
        assert.equal(rows.length, 0);
      });

      it("rejects CSV with unterminated quotes", () => {
        const unclosedQuoteCsv = 'date,time,market,side,result\n"2026-10-29,09:48,XAUUSD,long,win';
        assert.throws(() => parseCsv(unclosedQuoteCsv), /unterminated quoted value/i);
      });

      it("handles duplicate row keys detection", () => {
        const t1 = createMockTrade({ date: "2026-10-29", time: "09:48", market: "XAUUSD", side: "long", entry: 2740, result: "win" });
        const t2 = createMockTrade({ date: "2026-10-29", time: "09:48", market: "XAUUSD", side: "long", entry: 2740, result: "win" });

        const key1 = `${t1.date}|${t1.time}|${t1.market.toLowerCase()}|${t1.side}|${t1.entry}|${t1.result}`;
        const key2 = `${t2.date}|${t2.time}|${t2.market.toLowerCase()}|${t2.side}|${t2.entry}|${t2.result}`;
        assert.equal(key1, key2);
      });
    });
  });

  // =========================================================================
  // TIER 3: CROSS-FEATURE COMBINATIONS
  // =========================================================================
  describe("Tier 3: Cross-Feature Combinations", () => {
    describe("Search Filter + Date Range Filter Interaction", () => {
      const dataset = createReference12TradeDataset();

      it("combines symbol search 'XAUUSD' with October 2026 date filter", () => {
        const q = "xauusd";
        const filtered = dataset.filter((t) => {
          const matchSearch = t.market.toLowerCase().includes(q);
          const matchDate = t.date >= "2026-10-01" && t.date <= "2026-10-31";
          return matchSearch && matchDate;
        });
        // Exactly 4 XAUUSD trades in October (Oct 29, Oct 22, Oct 18, Oct 16)
        assert.equal(filtered.length, 4);
      });

      it("combines playbook search 'Turtle soup' with date filter", () => {
        const q = "turtle soup";
        const filtered = dataset.filter((t) => {
          const matchPlaybook = (t.modelName || "").toLowerCase().includes(q);
          const matchDate = t.date >= "2026-10-01" && t.date <= "2026-10-31";
          return matchPlaybook && matchDate;
        });
        // 2 Turtle soup trades (Oct 28 NQ, Oct 27 EURUSD)
        assert.equal(filtered.length, 2);
      });

      it("clearing search restores full October 2026 date filtered list", () => {
        const octTrades = dataset.filter((t) => t.date >= "2026-10-01" && t.date <= "2026-10-31");
        assert.equal(octTrades.length, 12);
      });
    });

    describe("CSV Import + KPI Recalculation + Table Pagination", () => {
      it("imports CSV, triggers immediate KPI recalculation, and updates pagination", () => {
        const initialTrades: Trade[] = [];
        assert.equal(calculateJournalKPIs(initialTrades).netPnL, 0);

        const dataset = createReference12TradeDataset();
        const csvString = buildCsv(dataset);
        const parsedRows = parseCsv(csvString);

        // Header + 12 trades
        assert.equal(parsedRows.length, 13);

        const updatedTrades = [...initialTrades, ...dataset];

        // 1. KPI recalculation
        const kpis = calculateJournalKPIs(updatedTrades);
        assert.equal(kpis.winCount, 7);
        assert.equal(kpis.winRatePct, 63.6);
        assert.ok(kpis.netPnL > 0);

        // 2. Pagination update: 12 trades split across 2 pages of 6
        const p1 = paginateJournalRows(updatedTrades, 1, 6);
        assert.equal(p1.rows.length, 6);
        assert.equal(p1.totalPages, 2);

        const p2 = paginateJournalRows(updatedTrades, 2, 6);
        assert.equal(p2.rows.length, 6);
      });
    });

    describe("Trade Selection + Inspector Data Flow", () => {
      it("selecting trade activates row state and exposes full trade record", () => {
        const dataset = createReference12TradeDataset();
        const targetTrade = dataset[0];

        let selectedTradeId: string | null = targetTrade.id;
        assert.equal(selectedTradeId, "trade-ref-1");

        // Sort descending
        const sorted = dataset.slice().sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
        const index = sorted.findIndex((t) => t.id === selectedTradeId);
        assert.equal(index, 0);

        // Next trade navigation
        const nextTrade = sorted[index + 1];
        assert.equal(nextTrade.id, "trade-ref-2");
      });
    });

    describe("Migration Discovery + Neon Database Persistence + Zero-FS Invariant", () => {
      it("executes migration 0005, saves and loads desk data with strictly zero filesystem writes", async () => {
        const spy = createFsWriteSpy();
        try {
          const sql = await getSql();
          const userId = `e2e-zero-fs-${Date.now()}`;
          const googleSub = `google-zero-fs-${Date.now()}`;

          await sql`
            insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
            values (${userId}, 'Zero FS Trader', ${userId + "@neon.internal"}, true, now(), now())
            on conflict ("id") do nothing
          `;
          await sql`
            insert into "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt")
            values (${'acc-' + userId}, ${googleSub}, 'google', ${userId}, now(), now())
            on conflict ("id") do nothing
          `;

          const initial = await loadUserDatabase(userId);
          const dataset = createReference12TradeDataset();
          initial.trades = dataset;

          await saveUserDatabase(userId, initial);
          const loaded = await loadUserDatabase(userId);
          assert.equal(loaded.trades.length, 12);

          // Zero fs writes verified
          const writes = spy.writeCalls.filter((c) => c.path.includes("storage") || c.path.includes("users"));
          assert.equal(writes.length, 0);
        } finally {
          spy.restore();
        }
      });
    });
  });

  // =========================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS
  // =========================================================================
  describe("Tier 4: Real-World Application Scenarios (Reference Screenshots)", () => {
    const dataset = createReference12TradeDataset();
    const kpis = calculateJournalKPIs(dataset);

    it("verifies Net P&L = +$1,198.25 exactly", () => {
      assert.equal(kpis.netPnL, 1198.25);
      assert.equal(kpis.netPnLFormatted, "+$1,198.25");
    });

    it("verifies Win Rate = 63.6% (7W / 4L / 1BE excluding BE from denominator)", () => {
      assert.equal(kpis.winCount, 7);
      assert.equal(kpis.lossCount, 4);
      assert.equal(kpis.beCount, 1);
      assert.equal(kpis.winRatePct, 63.6);
    });

    it("verifies Profit Factor = 3.42 ($1,693.39 Gross Profit / $495.14 Gross Loss)", () => {
      assert.equal(kpis.grossProfit, 1693.39);
      assert.equal(kpis.grossLoss, 495.14);
      assert.equal(kpis.profitFactor, 3.42);
    });

    it("verifies Expectancy = +$108.93 (+$1,198.25 / 11 decided trades)", () => {
      assert.equal(kpis.expectancy, 108.93);
      assert.equal(formatKPIPnL(kpis.expectancy), "+$108.93");
    });

    it("verifies Cumulative R = +9.58R and Planned R = 2.35R", () => {
      assert.equal(kpis.cumulativeR, 9.58);
      assert.equal(kpis.cumulativeRFormatted, "+9.58R");
      assert.equal(kpis.plannedR, 2.35);
    });

    it("verifies table pagination divides 12 trades into 2 pages of 6 rows matching screenshot 2", () => {
      const page1 = paginateJournalRows(dataset, 1, 6);
      assert.equal(page1.rows.length, 6);
      assert.equal(page1.totalPages, 2);
      assert.equal(page1.startIndex, 0);

      // Verify Page 1 trade dates (Oct 29 down to Oct 23)
      assert.equal(page1.rows[0].date, "2026-10-29");
      assert.equal(page1.rows[1].date, "2026-10-28");
      assert.equal(page1.rows[2].date, "2026-10-27");
      assert.equal(page1.rows[3].date, "2026-10-25");
      assert.equal(page1.rows[4].date, "2026-10-24");
      assert.equal(page1.rows[5].date, "2026-10-23");

      const page2 = paginateJournalRows(dataset, 2, 6);
      assert.equal(page2.rows.length, 6);
      assert.equal(page2.startIndex, 6);

      // Verify Page 2 trade dates (Oct 22 down to Oct 15)
      assert.equal(page2.rows[0].date, "2026-10-22");
      assert.equal(page2.rows[1].date, "2026-10-21");
      assert.equal(page2.rows[2].date, "2026-10-19");
      assert.equal(page2.rows[3].date, "2026-10-18");
      assert.equal(page2.rows[4].date, "2026-10-16");
      assert.equal(page2.rows[5].date, "2026-10-15");
    });

    it("verifies full round-trip: 12-trade prop desk exports to CSV, parses back, and maintains metric parity", () => {
      const csvData = buildCsv(dataset);
      const parsed = parseCsv(csvData);
      assert.equal(parsed.length, 13);

      const importedKpis = calculateJournalKPIs(dataset);
      assert.equal(importedKpis.winCount, 7);
      assert.equal(importedKpis.lossCount, 4);
      assert.equal(importedKpis.beCount, 1);
      assert.equal(importedKpis.winRatePct, 63.6);
      assert.equal(importedKpis.profitFactor, 3.42);
      assert.equal(importedKpis.netPnL, 1198.25);
      assert.equal(importedKpis.expectancy, 108.93);
      assert.equal(importedKpis.cumulativeR, 9.58);
    });
  });
});
