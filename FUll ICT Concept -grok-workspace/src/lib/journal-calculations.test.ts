import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calcTradeMetrics, tradeDollarPnl } from "./ict-calc.ts";
import { getTradePnL } from "./tradezella-helpers.ts";
import { calculateJournalKPIs } from "./ict-stats.ts";
import { emptyTrade } from "./ict-defaults.ts";
import type { Trade } from "./ict-types.ts";

describe("Journal Calculations Verification (Exact User Screenshot Scenario)", () => {
  // Trade exactly matching the user's uploaded screenshot:
  // Nov 9, 01:50 PM ET, XAUUSD Long, Entry 4103, Exit 4147, SL 4100, Target 4147, Lots 0.1, Fees 1.75
  const userScreenshotTrade: Trade = {
    ...emptyTrade("2026-11-09", "13:50", 1),
    id: "tr-screenshot-gold",
    market: "XAUUSD",
    side: "long",
    entry: 4103,
    exitPrice: 4147,
    sl: 4100,
    tp1: 4147,
    targetPrice: 4147,
    lots: 0.1,
    fees: 1.75,
    result: "win",
    rMultiple: 14.67,
    maeR: -0.34,
    mfeR: 2.62,
  };

  it("calculates exact metrics via calcTradeMetrics for XAUUSD trade", () => {
    const metrics = calcTradeMetrics(userScreenshotTrade);
    assert.equal(metrics.risk, 30.0);
    assert.equal(metrics.grossPnL, 440.0);
    assert.equal(metrics.fees, 1.75);
    assert.equal(metrics.netPnL, 438.25);
    assert.equal(metrics.plannedR, 14.67);
    assert.equal(metrics.realizedR, 14.67);
  });

  it("tradeDollarPnl returns exact gross, fees, and net P&L", () => {
    const pnl = tradeDollarPnl(userScreenshotTrade);
    assert.equal(pnl.gross, 440.0);
    assert.equal(pnl.fees, 1.75);
    assert.equal(pnl.net, 438.25);
  });

  it("getTradePnL in tradezella-helpers returns exact +$438.25 instead of arbitrary risk multiplier", () => {
    // When netPnL is not explicitly set on trade
    const pnlUnset = getTradePnL(userScreenshotTrade);
    assert.equal(pnlUnset, 438.25, `Expected 438.25, got ${pnlUnset}`);

    // When netPnL is explicitly populated
    const tradeWithNet: Trade = { ...userScreenshotTrade, netPnL: 438.25, grossPnL: 440.0 };
    const pnlSet = getTradePnL(tradeWithNet);
    assert.equal(pnlSet, 438.25);
  });

  it("calculateJournalKPIs calculates exact net P&L and Profit Factor from actual dollar amounts", () => {
    const kpis = calculateJournalKPIs([userScreenshotTrade]);
    assert.equal(kpis.netPnL, 438.25, `Expected KPI Net P&L to be 438.25, got ${kpis.netPnL}`);
    assert.equal(kpis.grossProfit, 438.25);
    assert.equal(kpis.grossLoss, 0);
    assert.equal(kpis.winCount, 1);
    assert.equal(kpis.winRatePct, 100);
    assert.equal(kpis.avgRealizedR, 14.67);
  });
});
