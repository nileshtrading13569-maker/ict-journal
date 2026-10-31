export type Side = "long" | "short";
export type TradeResult = "open" | "win" | "loss" | "be";
export type Bias = "bullish" | "bearish" | "neutral";
export type Structure = "bullish" | "bearish" | "consolidation" | "expansion" | "reversal";
export type PremiumDiscount = "premium" | "discount" | "equilibrium";
export type LiquidityStatus = "untouched" | "taken";
export type InternalExternal = "internal" | "external";
export type PdCondition = "fresh" | "partial" | "mitigated" | "invalidated";
export type DisplacementQuality = "weak" | "normal" | "strong";
export type StructureBefore = "bullish" | "bearish" | "range" | "compression" | "expansion";
export type DeliveryStatus = "pre" | "early" | "mid" | "late" | "delivered";
export type EntryQuality = "early" | "optimal" | "late" | "chasing";
export type PhaseId = 1 | 2 | 3 | 4;
export type Impact = "high" | "medium" | "low";
export type Emotion =
  | "calm"
  | "confidence"
  | "hesitation"
  | "fomo"
  | "revenge"
  | "pressure";
export type Grade = "A+" | "A" | "A-" | "B" | "C" | "D" | "F";
export type DrawdownType = "static" | "trailing";
export type WeeklyProfile =
  | "normal"
  | "expansion"
  | "reversal"
  | "consolidation"
  | "double-distribution";

export const LIQUIDITY_TYPES = [
  "BSL",
  "SSL",
  "EQH",
  "EQL",
  "PDH",
  "PDL",
  "PWH",
  "PWL",
  "Asia High",
  "Asia Low",
  "London High",
  "London Low",
  "Session High",
  "Session Low",
  "Internal",
  "External",
] as const;
export type LiquidityType = (typeof LIQUIDITY_TYPES)[number];

export const PD_ARRAYS = [
  "Fair Value Gap",
  "Inverse Fair Value Gap",
  "Order Block",
  "Breaker Block",
  "Mitigation Block",
  "Rejection Block",
  "Balanced Price Range",
  "Volume Imbalance",
  "Liquidity Void",
  "Consequent Encroachment",
  "Previous Day FVG",
  "Previous Week FVG",
  "Session FVG",
  "HTF FVG",
] as const;
export type PdArray = (typeof PD_ARRAYS)[number];

export const TIMEFRAMES = ["1W", "1D", "4H", "1H", "15m", "5m", "1m"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const TRIGGERS = [
  "Liquidity sweep",
  "MSS",
  "BOS",
  "CISD",
  "Displacement",
  "FVG creation",
  "FVG retracement",
  "Breaker confirmation",
  "OB confirmation",
  "OTE confluence",
  "SMT + MSS",
  "Session opening manipulation",
] as const;
export type TriggerKind = (typeof TRIGGERS)[number];

export const SESSIONS = ["Asia", "London", "NY", "London–NY overlap"] as const;
export type SessionName = (typeof SESSIONS)[number];

export const KILL_ZONES = [
  "London Kill Zone",
  "NY AM Kill Zone",
  "NY PM",
  "London Close",
  "Other",
] as const;
export type KillZone = (typeof KILL_ZONES)[number];

export const TIME_MODELS = [
  "Pre-London",
  "London open",
  "London expansion",
  "NY pre-market",
  "NY open",
  "NY AM continuation",
  "NY AM reversal",
  "NY PM",
  "End of day",
] as const;
export type TimeModel = (typeof TIME_MODELS)[number];

export const DRAWS = [
  "PDH",
  "PDL",
  "PWH",
  "PWL",
  "EQH",
  "EQL",
  "FVG",
  "OB",
  "BSL",
  "SSL",
  "External",
  "Internal",
] as const;
export type DrawOnLiquidity = (typeof DRAWS)[number];

export const DELIVERIES = [
  "Expand higher",
  "Expand lower",
  "Raid then reverse",
  "Retrace then continue",
  "Consolidate",
] as const;
export type ExpectedDelivery = (typeof DELIVERIES)[number];

export const AMD_PHASES = ["Accumulation", "Manipulation", "Distribution"] as const;
export type AmdPhase = (typeof AMD_PHASES)[number];

export const EXIT_REASONS = [
  "TP",
  "SL",
  "Manual",
  "Time-based",
  "News",
  "Session end",
  "Narrative invalidated",
  "Partial",
  "Trailing stop",
] as const;
export type ExitReason = (typeof EXIT_REASONS)[number];

export const MANAGEMENT = [
  "No management",
  "BE",
  "Partial",
  "Trailed",
  "Scaled",
  "Discretionary",
] as const;
export type ManagementStyle = (typeof MANAGEMENT)[number];

export const ERRORS = [
  "Bias wrong",
  "Narrative wrong",
  "Liquidity read wrong",
  "Location wrong",
  "Timing wrong",
  "Trigger wrong",
  "Entry too early",
  "Entry too late",
  "Stop placement wrong",
  "Target wrong",
  "Management wrong",
  "Psychology",
  "No actual error",
] as const;
export type PrimaryError = (typeof ERRORS)[number];

export const MISS_REASONS = [
  "Hesitation",
  "Fear of loss",
  "Missed timing",
  "Too much analysis",
  "Already moved",
  "Distracted",
  "Outside rules",
  "Technical issue",
  "Unsure bias",
  "Other",
] as const;
export type MissReason = (typeof MISS_REASONS)[number];

export const MISS_OUTCOMES = ["Full TP", "Partial TP", "Stopped", "No follow-through"] as const;
export type MissOutcome = (typeof MISS_OUTCOMES)[number];

export const EMOTIONS: { value: Emotion; label: string }[] = [
  { value: "calm", label: "Calm" },
  { value: "confidence", label: "Confidence" },
  { value: "hesitation", label: "Hesitation" },
  { value: "fomo", label: "FOMO" },
  { value: "revenge", label: "Revenge" },
  { value: "pressure", label: "Pressure" },
];

export const DISQUALIFIERS = [
  "Mid-range",
  "No liquidity target",
  "Wrong session",
  "Counter-narrative",
  "Late entry",
  "Already delivered",
  "FVG fully mitigated",
  "Structure invalidated",
  "High-impact event too close",
  "Target already taken",
] as const;

export type Instrument = {
  id: string;
  symbol: string;
  tickSize: number;
  tickValuePerLot: number;
  digits: number;
};

export type AccountRules = {
  startingBalance: number;
  profitTargetPct: number;
  maxDailyLossPct: number;
  maxTotalDrawdownPct: number;
  drawdownType: DrawdownType;
  profitSplit: number;
  consistencyPct: number;
  minTradingDays: number;
  maxPositionLots: number;
  newsRestricted: boolean;
  weekendRestricted: boolean;
  scalingNote: string;
  payoutThresholdPct: number;
  normalRiskPct: number;
  highConvictionRiskPct: number;
  maxTrades: number;
  maxConsecutiveLosses: number;
  windowStart: string;
  windowEnd: string;
  protocolStartDate: string;
};

export type Phase = {
  id: PhaseId;
  name: string;
  goal: string;
  description: string;
};

export type DealingRange = {
  high: number | null;
  low: number | null;
  open?: number | null;
  close?: number | null;
  current?: number | null;
};

export type LiquidityMark = {
  type: LiquidityType;
  price: number | null;
  status: LiquidityStatus;
  note?: string;
};

export type WeeklyNarrative = {
  id: string;
  weekStart: string;
  market: string;
  dealingRange: DealingRange;
  structure: Structure;
  profile: WeeklyProfile;
  liquidity: LiquidityMark[];
  primaryDraw: DrawOnLiquidity | "";
  secondaryDraw: DrawOnLiquidity | "";
  beforeDraw: string;
  notes: string;
};

export type Alignments = {
  htf: boolean;
  liquidity: boolean;
  location: boolean;
  time: boolean;
  narrative: boolean;
};

export type DailyPlan = {
  date: string;
  market: string;
  htfStructure: Structure;
  previousDay: {
    pdh: number | null;
    pdl: number | null;
    pdc: number | null;
    dailyOpen: number | null;
    midnightOpen: number | null;
  };
  location: PremiumDiscount;
  liquidityCondition: "BSL available" | "SSL available" | "Both" | "One side raided";
  expectedDraw: DrawOnLiquidity | "";
  expectedDelivery: ExpectedDelivery | "";
  alignments: Alignments;
  amdPhase: AmdPhase | "";
  expectedManipulation: string;
  expectedDistribution: Bias | "";
  dealingRange: DealingRange;
  scenarios: string;
  maxTrades: number;
  maxDailyLossPct: number;
  riskPerTrade: number;
  notes: string;
  savedAt?: string;
};

export type LiquidityLevel = {
  id: string;
  date: string;
  market: string;
  timeframe: Timeframe;
  price: number | null;
  type: LiquidityType;
  scope: InternalExternal;
  status: LiquidityStatus;
  dateSwept: string;
  reaction: string;
  consequence: string;
};

export type Judas = {
  present: "yes" | "no" | "unclear";
  direction: "higher" | "lower" | "";
  aligned: boolean;
  after: "reversal" | "continuation" | "failed" | "";
};

export type Ote = {
  used: "used" | "not-used" | "invalid";
  swingHigh: number | null;
  swingLow: number | null;
  retracement: number | null;
  inside: boolean;
  confluence: boolean;
};

export type Smt = {
  present: "no" | "bullish" | "bearish";
  pair: "XAUUSD ↔ DXY" | "ES ↔ NQ" | "EURUSD ↔ GBPUSD" | "Other" | "";
  sweptMarket: string;
  failedMarket: string;
  beforeTrigger: boolean;
};

export type Crt = {
  used: boolean;
  reference: Timeframe | "";
  high: number | null;
  low: number | null;
  raidSide: "high" | "low" | "neither" | "";
  purge: boolean;
  reclaim: boolean;
  entryAfterReclaim: boolean;
  target: "Opposite side" | "Internal" | "External" | "";
};

export type Intermarket = {
  dxy: Bias | "";
  yields: string;
  silver: string;
  indices: string;
};

export type Trade = {
  id: string;
  date: string;
  time: string;
  market: string;
  side: Side;
  modelId: string;
  modelName: string;

  weeklyBias: Bias;
  dailyBias: Bias;
  drawOnLiquidity: DrawOnLiquidity | "";
  location: PremiumDiscount;
  dealingRange: DealingRange;
  dealingRangeLabel: "Weekly" | "Daily" | "Session" | "Intraday";

  taken: LiquidityType[];
  targetLiq: LiquidityType[];

  pdArray: PdArray | "";
  pdTimeframe: Timeframe | "";
  pdCondition: PdCondition | "";

  triggers: TriggerKind[];
  session: SessionName | "";
  killZone: KillZone | "";
  timeModel: TimeModel | "";
  structureBefore: StructureBefore | "";
  displacementQuality: DisplacementQuality | "";
  fvgCreated: boolean;
  fvgTimeframe: Timeframe | "";

  judas: Judas;
  ote: Ote;
  smt: Smt;
  crt: Crt;
  intermarket: Intermarket;

  entry: number | null;
  sl: number | null;
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;
  exitPrice: number | null;
  exitTime: string;
  exitReason: ExitReason | "";
  riskPct: number;
  lots: number | null;

  management: ManagementStyle;
  partialAtR: number | null;
  be: boolean;
  maeR: number | null;
  mfeR: number | null;

  narrativeCorrect: boolean | null;
  liquidityCorrect: boolean | null;
  locationCorrect: boolean | null;
  triggerCorrect: boolean | null;
  executionQuality: EntryQuality | "";
  managementQuality: "good" | "poor" | "n/a" | "";
  errors: PrimaryError[];
  primaryError: PrimaryError | "";
  deliveryStatus: DeliveryStatus | "";
  grade: Grade | "";
  emotion: Emotion;
  ruleFollowed: boolean;
  notes: string;
  screenshotHtf: string;
  screenshotExec: string;
  planSnapshot?: {
    capturedAt: string;
    plan: DailyPlan;
    warnings: string[];
  };

  result: TradeResult;
  rMultiple: number | null;
  fees?: number | null;
  exitDate?: string;
  targetPrice?: number | null;
  reviewed?: boolean;
  tags?: string[];
  setupTags?: string[];
  mistakeTags?: string[];
  rulesAssessment?: Record<string, "followed" | "not" | "na">;

  // TradeZella Enhancements
  netPnL?: number | null;
  grossPnL?: number | null;
  holdDuration?: string;
  tradeEfficiency?: number | null;
  ruleChecklist?: Record<string, boolean>;
  ruleAdherencePct?: number | null;
  preTradeNotes?: string;
  managementNotes?: string;
  postTradeNotes?: string;
  candlestickData?: Array<{ time: string; open: number; high: number; low: number; close: number; volume?: number }>;
};

export type MissedTrade = {
  id: string;
  date: string;
  time: string;
  market: string;
  side: Side;
  narrativeValid: boolean;
  liquiditySwept: boolean;
  pdArrayPresent: boolean;
  triggerOccurred: boolean;
  why: MissReason | "";
  outcome: MissOutcome | "";
  notes: string;
};

export type PlaybookRuleCategory = "context" | "trigger" | "entry_risk" | "management" | "invalidation";

export type PlaybookStructuredRule = {
  id: string;
  category: PlaybookRuleCategory;
  text: string;
  isMandatory: boolean;
};

export type SetupModel = {
  id: string;
  code: string;
  name: string;
  market: string;
  timeframe: string;
  htfNarrative: string;
  liquidityCondition: string;
  pdArray: string;
  trigger: string;
  invalidation: string;
  target: string;
  requiredTiming: string;
  validWhen: string[];
  invalidWhen: string[];
  active: boolean;

  // TradeZella Playbook Enhancements
  description?: string;
  tier?: "A+" | "A" | "B" | "C";
  direction?: "bullish" | "bearish" | "both";
  targetRR?: number;
  targetWinRate?: number;
  canvasBlueprint?: string;
  rulesList?: PlaybookStructuredRule[];
};

export type RecentlyDeletedModel = {
  model: SetupModel;
  deletedAt: string;
};

export type ChecklistItem = {
  id: string;
  group: "core" | "conditional" | "lifestyle";
  label: string;
};

export type ProtocolDay = {
  id: string;
  day: number;
  date: string;
  title: string;
  focus: string;
  phase: PhaseId;
  riskPct: number;
  maxTrades: number;
  completed: boolean;
  skipped: boolean;
  notes: string;
};

export type NewsEvent = {
  id: string;
  name: string;
  date: string;
  time: string;
  impact: Impact;
  notes: string;
  avoid: boolean;
};

export type DeskData = {
  hasBootstrapped: boolean;
  accountName: string;
  phaseId: PhaseId;
  phases: Phase[];
  rules: AccountRules;
  mantra: string;
  themeId?: string;
  accentColor?: string;
  instruments: Instrument[];
  models: SetupModel[];
  recentlyDeletedModels: RecentlyDeletedModel[];
  trades: Trade[];
  missed: MissedTrade[];
  weeklies: WeeklyNarrative[];
  dailyPlans: Record<string, DailyPlan>;
  liquidity: LiquidityLevel[];
  checklistItems: ChecklistItem[];
  checks: Record<string, string[]>;
  protocolDays: ProtocolDay[];
  newsEvents: NewsEvent[];
  forceClosedDates: string[];
  forceOpenDates: string[];
};

export function emptyJudas(): Judas {
  return { present: "unclear", direction: "", aligned: false, after: "" };
}
export function emptyOte(): Ote {
  return {
    used: "not-used",
    swingHigh: null,
    swingLow: null,
    retracement: null,
    inside: false,
    confluence: false,
  };
}
export function emptySmt(): Smt {
  return {
    present: "no",
    pair: "",
    sweptMarket: "",
    failedMarket: "",
    beforeTrigger: false,
  };
}
export function emptyCrt(): Crt {
  return {
    used: false,
    reference: "",
    high: null,
    low: null,
    raidSide: "",
    purge: false,
    reclaim: false,
    entryAfterReclaim: false,
    target: "",
  };
}
export function emptyIntermarket(): Intermarket {
  return { dxy: "", yields: "", silver: "", indices: "" };
}
export function emptyRange(): DealingRange {
  return { high: null, low: null, open: null, close: null, current: null };
}
