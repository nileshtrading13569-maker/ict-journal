import type { PlaybookStructuredRule, SetupModel, Trade, TradeResult } from "./ict-types";

export type CandleBar = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isEntryBar?: boolean;
  isExitBar?: boolean;
};

/**
 * Standard dollar risk per trade if not explicitly specified (0.25% of $50,000 = $125).
 */
export const DEFAULT_RISK_DOLLARS = 250;

/**
 * Returns net dollar P&L for a trade.
 */
export function getTradePnL(trade: Trade, riskDollars = DEFAULT_RISK_DOLLARS): number {
  if (trade.netPnL != null) return trade.netPnL;
  if (trade.rMultiple != null) {
    return Math.round(trade.rMultiple * riskDollars * 100) / 100;
  }
  if (trade.entry != null && trade.exitPrice != null && trade.lots != null) {
    const diff = trade.side === "long" ? trade.exitPrice - trade.entry : trade.entry - trade.exitPrice;
    return Math.round(diff * trade.lots * 100 * 100) / 100;
  }
  return 0;
}

/**
 * Format dollar amount with sign and currency.
 */
export function formatCurrency(amount: number): string {
  const sign = amount > 0 ? "+" : amount < 0 ? "-" : "";
  const abs = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}$${abs}`;
}

/**
 * Returns holding duration string (e.g. "48m", "48m dur", "1h 14m", "1h 14m dur").
 * Formats durations cleanly and supports an optional withDurSuffix parameter.
 */
export function getTradeHoldDuration(trade: Trade, withDurSuffix = false): string {
  if (trade.holdDuration) {
    if (withDurSuffix && !trade.holdDuration.includes("dur")) {
      return `${trade.holdDuration} dur`;
    }
    return trade.holdDuration;
  }
  if (!trade.time || !trade.exitTime) return "—";

  let totalMinutes = 0;
  if (trade.date && trade.exitDate && trade.date !== trade.exitDate) {
    const start = Date.parse(`${trade.date}T${trade.time}:00Z`);
    const end = Date.parse(`${trade.exitDate}T${trade.exitTime}:00Z`);
    if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
      totalMinutes = Math.round((end - start) / 60000);
    }
  }

  if (totalMinutes === 0) {
    const [eh, em] = trade.time.split(":").map(Number);
    const [xh, xm] = trade.exitTime.split(":").map(Number);
    if (Number.isNaN(eh) || Number.isNaN(em) || Number.isNaN(xh) || Number.isNaN(xm)) {
      return "—";
    }

    totalMinutes = xh * 60 + xm - (eh * 60 + em);
    if (totalMinutes < 0) totalMinutes += 24 * 60; // Next day wrap
  }

  let formatted = "";
  if (totalMinutes < 60) {
    formatted = `${totalMinutes}m`;
  } else {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    formatted = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  return withDurSuffix ? `${formatted} dur` : formatted;
}

/**
 * Trade Efficiency % = Realized R / MFE R.
 * Indicates whether the trader extracted maximum value or left money on the table.
 */
export function getTradeEfficiency(trade: Trade): number {
  if (trade.tradeEfficiency != null) return trade.tradeEfficiency;
  if (trade.mfeR && trade.mfeR > 0 && trade.rMultiple != null && trade.rMultiple > 0) {
    return Math.min(100, Math.max(0, Math.round((trade.rMultiple / trade.mfeR) * 100)));
  }
  return trade.result === "win" ? 80 : 0;
}

/**
 * Return structured 5-phase rules for a setup model.
 * If not already set on the model, synthesizes standard ICT confluences.
 */
export function getPlaybookRules(model: SetupModel): PlaybookStructuredRule[] {
  if (model.rulesList && model.rulesList.length > 0) {
    return model.rulesList;
  }

  const rules: PlaybookStructuredRule[] = [];
  let order = 1;

  // Phase 1: Context & Pre-conditions
  rules.push({
    id: `${model.id}-r${order++}`,
    category: "context",
    text: model.htfNarrative ? `HTF Narrative: ${model.htfNarrative}` : "Higher timeframe bias and draw on liquidity confirmed",
    isMandatory: true,
  });
  rules.push({
    id: `${model.id}-r${order++}`,
    category: "context",
    text: model.requiredTiming ? `Timing Window: ${model.requiredTiming}` : "Session Killzone active (no red folder news within 15m)",
    isMandatory: true,
  });

  // Phase 2: Formation & Trigger
  rules.push({
    id: `${model.id}-r${order++}`,
    category: "trigger",
    text: model.liquidityCondition ? `Liquidity Raid: ${model.liquidityCondition}` : "Key liquidity pool swept (Buy-side / Sell-side)",
    isMandatory: true,
  });
  rules.push({
    id: `${model.id}-r${order++}`,
    category: "trigger",
    text: model.pdArray ? `PD Array: ${model.pdArray}` : "Fair Value Gap (FVG) or Order Block displacement confirmed",
    isMandatory: true,
  });
  rules.push({
    id: `${model.id}-r${order++}`,
    category: "trigger",
    text: model.trigger ? `Trigger: ${model.trigger}` : "Market Structure Shift (MSS) with energetic displacement candle body",
    isMandatory: true,
  });

  // Phase 3: Entry & Risk Rules
  rules.push({
    id: `${model.id}-r${order++}`,
    category: "entry_risk",
    text: "Order placed at limit within PD Array / OTE 62%–79% retracement",
    isMandatory: true,
  });
  rules.push({
    id: `${model.id}-r${order++}`,
    category: "entry_risk",
    text: model.invalidation ? `Stop Loss anchored: ${model.invalidation}` : "Stop loss strictly anchored behind displacement swing extreme",
    isMandatory: true,
  });

  // Phase 4: Management & Exit Rules
  rules.push({
    id: `${model.id}-r${order++}`,
    category: "management",
    text: model.target ? `Target Objective: ${model.target}` : "Primary profit target set at opposing dealing range liquidity",
    isMandatory: true,
  });
  rules.push({
    id: `${model.id}-r${order++}`,
    category: "management",
    text: "Partial profit taken at 1:2 R; stop moved to Breakeven",
    isMandatory: false,
  });

  // Phase 5: Invalidation Criteria
  rules.push({
    id: `${model.id}-r${order++}`,
    category: "invalidation",
    text: model.invalidation ? `Hard Invalidation: ${model.invalidation}` : "Candle body close through anchor candle invalidates setup before fill",
    isMandatory: true,
  });

  return rules;
}

export interface TradeRuleAdherence {
  adherencePct: number;
  followed: number;
  total: number;
  ratio: string;
  formatted: string;
  toString(): string;
}

/**
 * Formats trade rule adherence as a ratio string e.g. "9/10" or "8/8".
 */
export function formatTradeRuleAdherenceRatio(trade: Trade, model?: SetupModel): string {
  return calculateTradeRuleAdherence(trade, model).ratio;
}

/**
 * Calculates rule adherence percentage (0-100%) and ratio (e.g. "9/10") for a trade.
 */
export function calculateTradeRuleAdherence(
  trade: Trade,
  model?: SetupModel,
): TradeRuleAdherence {
  // 1. If rulesAssessment is populated on the trade
  if (trade.rulesAssessment && Object.keys(trade.rulesAssessment).length > 0) {
    let followed = 0;
    let total = 0;
    for (const key of Object.keys(trade.rulesAssessment)) {
      const val = trade.rulesAssessment[key];
      if (val === "followed") {
        followed += 1;
        total += 1;
      } else if (val === "not") {
        total += 1;
      }
    }
    if (total === 0) total = Object.keys(trade.rulesAssessment).length;
    const adherencePct = total > 0 ? Math.round((followed / total) * 100) : 100;
    const ratio = `${followed}/${total}`;
    return {
      adherencePct,
      followed,
      total,
      ratio,
      formatted: ratio,
      toString: () => ratio,
    };
  }

  // 2. If a model is provided with structured rules
  if (model) {
    const rules = getPlaybookRules(model);
    const checklist = trade.ruleChecklist ?? {};
    const keys = Object.keys(checklist);

    if (keys.length === 0) {
      const total = rules.length > 0 ? rules.length : 10;
      const defaultPct = trade.ruleFollowed ? 90 : 40;
      const followed = trade.ruleFollowed
        ? (total === 10 ? 9 : Math.max(1, total - 1))
        : Math.round((total * defaultPct) / 100);
      const adherencePct = total > 0 ? Math.round((followed / total) * 100) : 100;
      const ratio = `${followed}/${total}`;
      return {
        adherencePct,
        followed,
        total,
        ratio,
        formatted: ratio,
        toString: () => ratio,
      };
    }

    let followed = 0;
    for (const rule of rules) {
      if (checklist[rule.id] === true) followed += 1;
      else if (checklist[rule.id] === undefined && trade.ruleFollowed) followed += 1;
    }

    const total = rules.length;
    const adherencePct = total > 0 ? Math.round((followed / total) * 100) : 100;
    const ratio = `${followed}/${total}`;
    return {
      adherencePct,
      followed,
      total,
      ratio,
      formatted: ratio,
      toString: () => ratio,
    };
  }

  // 3. Fallback when model is not provided
  if (trade.ruleChecklist && Object.keys(trade.ruleChecklist).length > 0) {
    const keys = Object.keys(trade.ruleChecklist);
    const total = keys.length;
    const followed = keys.filter((k) => trade.ruleChecklist![k] === true).length;
    const adherencePct = total > 0 ? Math.round((followed / total) * 100) : 100;
    const ratio = `${followed}/${total}`;
    return {
      adherencePct,
      followed,
      total,
      ratio,
      formatted: ratio,
      toString: () => ratio,
    };
  }

  const total = 10;
  const followed = trade.ruleFollowed ? 9 : 5;
  const adherencePct = Math.round((followed / total) * 100);
  const ratio = `${followed}/${total}`;
  return {
    adherencePct,
    followed,
    total,
    ratio,
    formatted: ratio,
    toString: () => ratio,
  };
}

/**
 * Synthesizes realistic, clean OHLCV candlestick bars for a trade so the interactive
 * Canvas chart can plot exact entries, exits, stop loss, take profit, MFE, and MAE.
 */
export function generateTradeCandles(trade: Trade): CandleBar[] {
  if (trade.candlestickData && trade.candlestickData.length >= 10) {
    return trade.candlestickData.map((b) => ({
      ...b,
      volume: b.volume ?? 150,
    }));
  }

  const isLong = trade.side === "long";
  const entry = trade.entry ?? 3500;
  const sl = trade.sl ?? (isLong ? entry - 10 : entry + 10);
  const exit = trade.exitPrice ?? (trade.result === "win" ? (isLong ? entry + 20 : entry - 20) : sl);
  const riskDist = Math.abs(entry - sl) || 5;

  const mfeOffset = (trade.mfeR ?? (trade.result === "win" ? 2.2 : 0.4)) * riskDist;
  const maeOffset = Math.abs(trade.maeR ?? -0.35) * riskDist;

  const mfePrice = isLong ? entry + mfeOffset : entry - mfeOffset;
  const maePrice = isLong ? entry - maeOffset : entry + maeOffset;

  const bars: CandleBar[] = [];
  const baseMinutes = 24;
  const startTime = trade.time || "09:30";
  const [sh, sm] = startTime.split(":").map(Number);
  const startTotalMins = (Number.isNaN(sh) ? 9 : sh) * 60 + (Number.isNaN(sm) ? 30 : sm);

  // 1. Pre-entry setup bars (6 bars forming liquidity raid & displacement)
  let currentPrice = isLong ? entry - riskDist * 0.8 : entry + riskDist * 0.8;
  for (let i = 0; i < 6; i++) {
    const mins = startTotalMins - (6 - i) * 5;
    const h = String(Math.floor((mins + 1440) % 1440 / 60)).padStart(2, "0");
    const m = String(Math.floor((mins + 1440) % 60)).padStart(2, "0");

    const move = (isLong ? 1 : -1) * (riskDist * 0.15) * (i % 2 === 0 ? 1 : -0.5);
    const o = currentPrice;
    const c = o + move;
    const high = Math.max(o, c) + riskDist * 0.12;
    const low = Math.min(o, c) - riskDist * 0.12;
    currentPrice = c;

    bars.push({
      time: `${h}:${m}`,
      open: round(o),
      high: round(high),
      low: round(low),
      close: round(c),
      volume: Math.floor(120 + Math.random() * 80),
    });
  }

  // 2. Entry Bar (index 6)
  const entryOpen = isLong ? entry - riskDist * 0.2 : entry + riskDist * 0.2;
  bars.push({
    time: trade.time || "09:30",
    open: round(entryOpen),
    high: round(Math.max(entryOpen, entry) + riskDist * 0.1),
    low: round(Math.min(entryOpen, entry) - riskDist * 0.1),
    close: round(entry),
    volume: 340,
    isEntryBar: true,
  });

  // 3. In-trade bars (10 bars traversing MAE and MFE)
  currentPrice = entry;
  for (let i = 1; i <= 10; i++) {
    const mins = startTotalMins + i * 5;
    const h = String(Math.floor((mins + 1440) % 1440 / 60)).padStart(2, "0");
    const m = String(Math.floor((mins + 1440) % 60)).padStart(2, "0");

    let target = entry;
    if (i <= 3) {
      // Early position pulls into MAE
      target = maePrice;
    } else if (i <= 8) {
      // Moves toward MFE
      const progress = (i - 3) / 5;
      target = entry + (mfePrice - entry) * progress;
    } else {
      // Approaches exit
      target = exit;
    }

    const o = currentPrice;
    const c = target + (Math.random() - 0.5) * (riskDist * 0.2);
    const high = Math.max(o, c, isLong ? (i === 8 ? mfePrice : o) : o) + riskDist * 0.08;
    const low = Math.min(o, c, !isLong ? (i === 8 ? mfePrice : o) : (i === 2 ? maePrice : o)) - riskDist * 0.08;
    currentPrice = c;

    bars.push({
      time: `${h}:${m}`,
      open: round(o),
      high: round(high),
      low: round(low),
      close: round(c),
      volume: Math.floor(180 + Math.random() * 120),
    });
  }

  // 4. Exit Bar (index 17)
  const exitTime = trade.exitTime || "10:55";
  bars.push({
    time: exitTime,
    open: round(currentPrice),
    high: round(Math.max(currentPrice, exit) + riskDist * 0.1),
    low: round(Math.min(currentPrice, exit) - riskDist * 0.1),
    close: round(exit),
    volume: 290,
    isExitBar: true,
  });

  // 5. Post-exit follow-through (4 bars)
  currentPrice = exit;
  const [xh, xm] = exitTime.split(":").map(Number);
  const exitTotalMins = (Number.isNaN(xh) ? 10 : xh) * 60 + (Number.isNaN(xm) ? 55 : xm);

  for (let i = 1; i <= 4; i++) {
    const mins = exitTotalMins + i * 5;
    const h = String(Math.floor((mins + 1440) % 1440 / 60)).padStart(2, "0");
    const m = String(Math.floor((mins + 1440) % 60)).padStart(2, "0");

    const move = (Math.random() - 0.45) * (riskDist * 0.3);
    const o = currentPrice;
    const c = o + move;
    const high = Math.max(o, c) + riskDist * 0.1;
    const low = Math.min(o, c) - riskDist * 0.1;
    currentPrice = c;

    bars.push({
      time: `${h}:${m}`,
      open: round(o),
      high: round(high),
      low: round(low),
      close: round(c),
      volume: Math.floor(110 + Math.random() * 60),
    });
  }

  return bars;
}

function round(val: number): number {
  return Math.round(val * 100) / 100;
}
