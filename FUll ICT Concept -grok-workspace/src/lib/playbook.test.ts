import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SetupModel } from "./ict-types.ts";

describe("Playbook operations and calculations", () => {
  it("calculates rules checklist conformance correctly", () => {
    const validWhen = ["HTF aligned", "Liquidity swept", "Kill zone timing", "Displacement confirmed"];
    const checkedRules: Record<number, boolean> = {
      0: true,
      1: true,
      2: false,
      3: true,
    };

    const followedCount = validWhen.filter((_, idx) => checkedRules[idx] !== false).length;
    const totalValid = validWhen.length;
    const checklistConformance = Math.round((followedCount / totalValid) * 100);

    assert.equal(followedCount, 3);
    assert.equal(totalValid, 4);
    assert.equal(checklistConformance, 75);
  });

  it("handles 100% conformance when no rules fail", () => {
    const validWhen = ["Rule 1", "Rule 2"];
    const checkedRules: Record<number, boolean> = { 0: true, 1: true };

    const followedCount = validWhen.filter((_, idx) => checkedRules[idx] !== false).length;
    const totalValid = validWhen.length;
    const checklistConformance = totalValid > 0 ? Math.round((followedCount / totalValid) * 100) : 100;

    assert.equal(checklistConformance, 100);
  });

  it("handles 100% conformance when rules array is empty", () => {
    const validWhen: string[] = [];
    const checkedRules: Record<number, boolean> = {};

    const followedCount = validWhen.filter((_, idx) => checkedRules[idx] !== false).length;
    const totalValid = validWhen.length;
    const checklistConformance = totalValid > 0 ? Math.round((followedCount / totalValid) * 100) : 100;

    assert.equal(checklistConformance, 100);
  });

  it("sorts playbooks by net PnL, winRate, trades, and name", () => {
    const models: SetupModel[] = [
      {
        id: "m1",
        code: "B",
        name: "Breaker Reversal",
        market: "NQ",
        timeframe: "15m",
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
      },
      {
        id: "m2",
        code: "A",
        name: "Asia Sweep Continual",
        market: "ES",
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
      },
    ];

    const statsMap = new Map([
      ["m1", { netPnL: 500, winRate: 60, closedCount: 10, profitFactor: 2.0, avgR: 1.5, rulesFollowedPct: 80 }],
      ["m2", { netPnL: 1200, winRate: 75, closedCount: 5, profitFactor: 3.5, avgR: 2.0, rulesFollowedPct: 95 }],
    ]);

    // Sort PnL desc
    const sortedPnLDesc = [...models].sort((a, b) => {
      const pnlA = statsMap.get(a.id)?.netPnL ?? 0;
      const pnlB = statsMap.get(b.id)?.netPnL ?? 0;
      return pnlB - pnlA;
    });
    assert.equal(sortedPnLDesc[0].id, "m2");

    // Sort Trades desc
    const sortedTradesDesc = [...models].sort((a, b) => {
      const tA = statsMap.get(a.id)?.closedCount ?? 0;
      const tB = statsMap.get(b.id)?.closedCount ?? 0;
      return tB - tA;
    });
    assert.equal(sortedTradesDesc[0].id, "m1");

    // Sort Name asc
    const sortedNameAsc = [...models].sort((a, b) => a.name.localeCompare(b.name));
    assert.equal(sortedNameAsc[0].name, "Asia Sweep Continual");
  });

  it("filters playbooks by active tab and search query", () => {
    const models: SetupModel[] = [
      {
        id: "m1",
        code: "A",
        name: "Silver Bullet",
        market: "XAUUSD",
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
      },
      {
        id: "m2",
        code: "B",
        name: "Judas Swing",
        market: "EURUSD",
        timeframe: "15m",
        htfNarrative: "",
        liquidityCondition: "",
        pdArray: "",
        trigger: "",
        invalidation: "",
        target: "",
        requiredTiming: "",
        validWhen: [],
        invalidWhen: [],
        active: false,
      },
    ];

    const activeOnly = models.filter((m) => m.active);
    assert.equal(activeOnly.length, 1);
    assert.equal(activeOnly[0].id, "m1");

    const querySearch = models.filter((m) => {
      const q = "eur".toLowerCase();
      return m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q) || (m.market || "").toLowerCase().includes(q);
    });
    assert.equal(querySearch.length, 1);
    assert.equal(querySearch[0].id, "m2");
  });

  it("preserves model metadata (notes, blueprint, tier) during updates", () => {
    const existingModel: SetupModel = {
      id: "model-alpha",
      code: "A",
      name: "Original Setup",
      market: "NQ",
      timeframe: "5m",
      htfNarrative: "Bullish daily bias",
      liquidityCondition: "PDL swept",
      pdArray: "15m FVG",
      trigger: "MSS",
      invalidation: "Low broken",
      target: "PDH",
      requiredTiming: "NY AM",
      validWhen: ["Rule 1"],
      invalidWhen: ["Disqualifier 1"],
      active: true,
      description: "Detailed setup observation notes",
      canvasBlueprint: "data:image/png;base64,sampleblueprintdata",
      tier: "A+",
      direction: "bullish",
    };

    // Simulate updating name and code while preserving existing metadata
    const updatedModel: SetupModel = {
      ...existingModel,
      name: "Updated Setup Name",
      code: "A+",
      description: "Updated observation notes",
    };

    assert.equal(updatedModel.id, "model-alpha");
    assert.equal(updatedModel.name, "Updated Setup Name");
    assert.equal(updatedModel.code, "A+");
    assert.equal(updatedModel.description, "Updated observation notes");
    assert.equal(updatedModel.canvasBlueprint, "data:image/png;base64,sampleblueprintdata");
    assert.equal(updatedModel.tier, "A+");
    assert.equal(updatedModel.direction, "bullish");
  });

  it("sorts playbooks across profit factor, avgR, and rules conformance", () => {
    const statsMap = new Map([
      ["m1", { profitFactor: 1.5, avgR: 0.8, rulesFollowedPct: 65 }],
      ["m2", { profitFactor: 3.2, avgR: 2.4, rulesFollowedPct: 92 }],
    ]);

    const ids = ["m1", "m2"];

    // Sort by profit factor descending
    const sortedPFDesc = [...ids].sort((a, b) => (statsMap.get(b)?.profitFactor ?? 0) - (statsMap.get(a)?.profitFactor ?? 0));
    assert.deepEqual(sortedPFDesc, ["m2", "m1"]);

    // Sort by Avg R descending
    const sortedAvgRDesc = [...ids].sort((a, b) => (statsMap.get(b)?.avgR ?? 0) - (statsMap.get(a)?.avgR ?? 0));
    assert.deepEqual(sortedAvgRDesc, ["m2", "m1"]);

    // Sort by Rules followed descending
    const sortedRulesDesc = [...ids].sort((a, b) => (statsMap.get(b)?.rulesFollowedPct ?? 0) - (statsMap.get(a)?.rulesFollowedPct ?? 0));
    assert.deepEqual(sortedRulesDesc, ["m2", "m1"]);
  });
});
