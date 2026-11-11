import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildDailyJournalEntryFromTrades,
  computeNotebookDayMetrics,
  mergeJournalDatesIntoNotes,
} from "./notebook-journal-sync.ts";
import { calculateJournalKPIs } from "./ict-stats.ts";
import { DEFAULT_INSTRUMENTS, DEFAULT_MODELS, emptyTrade } from "./ict-defaults.ts";
import { SEED_NOTES } from "./notebook-defaults.ts";
import type { Trade } from "./ict-types.ts";

describe("Notebook <-> Journal Database Synchronization & Calculations", () => {
  const goldTrade: Trade = {
    ...emptyTrade("2026-11-09", "13:50", 1),
    id: "tr-nb-gold-1",
    market: "XAUUSD",
    side: "long",
    modelId: "model-a",
    modelName: "Sell-side raid reversal",
    entry: 4103,
    exitPrice: 4147,
    sl: 4100,
    tp1: 4147,
    targetPrice: 4147,
    lots: 0.1,
    fees: 1.75,
    result: "win",
    rMultiple: 14.67,
    notes: "Price is in Continuation in HTF H1 FVG Gap + 15min FVG gap",
  };

  it("computeNotebookDayMetrics matches Journal KPIs identically and preserves fractional 0.05 lot volume", () => {
    const halfLotTrade: Trade = { ...goldTrade, id: "tr-005", lots: 0.05 };
    const kpis = calculateJournalKPIs([halfLotTrade]);
    const nb = computeNotebookDayMetrics("2026-11-09", [halfLotTrade], DEFAULT_INSTRUMENTS);

    assert.ok(nb);
    assert.equal(nb.hasLiveTrades, true);
    assert.equal(nb.netPnl, kpis.netPnL);
    assert.equal(nb.netPnl, 218.25);
    assert.equal(nb.grossPnl, 220.0);
    assert.equal(nb.commissions, 1.75);
    assert.equal(nb.volume, 0.05, "Volume must preserve 0.05 lots instead of rounding to 0.1");
    assert.equal(nb.winrate, kpis.winRatePct);
    assert.equal(nb.profitFactor, kpis.profitFactor);
    assert.equal(nb.profitFactor, 99.99);
  });

  it("excludes open trades from winrate & realized P&L so Notebook aligns with Journal", () => {
    const openTrade: Trade = {
      ...emptyTrade("2026-11-09", "15:00", 1),
      id: "tr-open",
      market: "XAUUSD",
      lots: 0.05,
      fees: 0,
      result: "open",
      exitPrice: null,
    };
    const nb = computeNotebookDayMetrics(
      "2026-11-09",
      [goldTrade, openTrade],
      DEFAULT_INSTRUMENTS,
    );
    assert.ok(nb);
    assert.equal(nb.netPnl, 438.25);
    assert.equal(nb.totalTrades, 2);
    assert.equal(nb.winners, 1);
    assert.equal(nb.losers, 0);
    assert.equal(nb.winrate, 100);
    assert.equal(nb.volume, 0.15);
  });

  it("mergeJournalDatesIntoNotes automatically links missing Journal dates into Daily Journal without duplicating or resurrecting dismissed dates", () => {
    const { nextNotes, addedDates } = mergeJournalDatesIntoNotes(
      SEED_NOTES,
      [goldTrade],
      DEFAULT_INSTRUMENTS,
      DEFAULT_MODELS,
    );

    assert.deepEqual(addedDates, ["2026-11-09"]);
    const created = nextNotes.find((n) => n.date === "2026-11-09" && n.folder === "Daily Journal");
    assert.ok(created, "Daily Journal entry created for logged trade date");
    assert.equal(created.manualMetrics, undefined, "Synced note relies on live DB trades");
    assert.ok(created.content.includes("XAUUSD LONG"));
    assert.ok(created.content.includes("+$438.25"));
    assert.ok(created.content.includes("HTF H1 FVG Gap"));

    // Running merge again skips already-present Daily Journal date
    const secondRun = mergeJournalDatesIntoNotes(
      nextNotes,
      [goldTrade],
      DEFAULT_INSTRUMENTS,
      DEFAULT_MODELS,
    );
    assert.equal(secondRun.addedDates.length, 0);

    // Explicitly dismissed date is respected
    const dismissed = mergeJournalDatesIntoNotes(
      SEED_NOTES,
      [goldTrade],
      DEFAULT_INSTRUMENTS,
      DEFAULT_MODELS,
      new Set(["2026-11-09"]),
    );
    assert.equal(dismissed.addedDates.length, 0);
  });

  it("buildDailyJournalEntryFromTrades formats title accurately regardless of local timezone", () => {
    const entry = buildDailyJournalEntryFromTrades("2026-11-09", [goldTrade], DEFAULT_INSTRUMENTS, DEFAULT_MODELS);
    assert.ok(entry.title.includes("Nov") && entry.title.includes("2026"));
    assert.equal(entry.date, "2026-11-09");
  });
});

