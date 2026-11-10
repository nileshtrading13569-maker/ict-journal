import { create } from "zustand";
import { persist } from "zustand/middleware";
import { addDaysISO } from "./ict-time";
import { calcTradeMetrics } from "./ict-calc";
import {
  type CustomThemeColors,
  getCustomThemeColors,
  saveCustomThemeColors,
} from "./color-themes";
import type {
  AccountRules,
  ChecklistItem,
  DailyPlan,
  DeskData,
  LiquidityLevel,
  MissedTrade,
  NewsEvent,
  Phase,
  PlanQuestion,
  ProtocolDay,
  RecentlyDeletedModel,
  SetupModel,
  Trade,
  WeeklyNarrative,
} from "./ict-types";
import { createInitialState, createResetState, emptyDesk, DEFAULT_PLAN_QUESTIONS } from "./ict-defaults";
import { uid } from "./utils";

type DeskActions = {
  bootstrapIfNeeded: () => void;
  resetAll: (data?: DeskData) => void;
  replaceAll: (data: DeskData) => void;
  patchAccount: (
    patch: Partial<Pick<DeskData, "accountName" | "phaseId" | "mantra">> & Partial<AccountRules>,
  ) => void;
  setPhaseId: (id: Phase["id"]) => void;
  updatePhase: (phase: Phase) => void;
  upsertTrade: (trade: Trade) => void;
  removeTrade: (id: string) => void;
  updateTradeReview: (id: string, reviewed: boolean) => void;
  updateTradeRule: (id: string, ruleKey: string, status: "followed" | "not" | "na") => void;
  updateTradeGrade: (id: string, grade: Trade["grade"]) => void;
  updateTradeTags: (id: string, setupTags: string[], mistakeTags: string[]) => void;
  updateTradePlaybook: (id: string, modelId: string, modelName: string) => void;
  updateTradeScreenshots: (
    id: string,
    patch: Partial<Pick<Trade, "screenshotHtf" | "screenshotExec">>,
  ) => void;
  upsertMissed: (row: MissedTrade) => void;
  removeMissed: (id: string) => void;
  upsertWeekly: (row: WeeklyNarrative) => void;
  removeWeekly: (id: string) => void;
  setPlan: (date: string, plan: DailyPlan) => void;
  setDailyJournalNote: (date: string, note: string) => void;
  upsertLiquidity: (row: LiquidityLevel) => void;
  removeLiquidity: (id: string) => void;
  upsertModel: (model: SetupModel) => void;
  removeModel: (id: string) => void;
  restoreModel: (id: string) => boolean;
  permanentlyDeleteModel: (id: string) => void;
  upsertChecklistItem: (item: ChecklistItem) => void;
  removeChecklistItem: (id: string) => void;
  toggleCheck: (date: string, id: string) => void;
  upsertNews: (event: NewsEvent) => void;
  removeNews: (id: string) => void;
  upsertProtocolDay: (day: ProtocolDay) => void;
  addProtocolDay: () => void;
  closeToday: (date: string) => void;
  openToday: (date: string) => void;
  rebuildProtocolDates: (startDate: string) => void;
  setThemeId: (id: string) => void;
  setAccentColor: (color: string) => void;
  setCustomThemeColors: (colors: Partial<CustomThemeColors>) => void;
  setPlanQuestions: (questions: PlanQuestion[]) => void;
};

export type DeskStore = DeskData & DeskActions;

function upsert<T extends { id: string }>(list: T[], item: T) {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const next = list.slice();
  next[i] = item;
  return next;
}

export const useDeskStore = create<DeskStore>()(
  persist(
    (set, get) => ({
      ...emptyDesk(),
      bootstrapIfNeeded: () => {
        if (!get().hasBootstrapped) set(createInitialState());
      },
      resetAll: (data = createResetState()) => set({ ...data, hasBootstrapped: true }),
      replaceAll: (data) => {
        const instruments = data.instruments ?? [];
        const normalizedTrades = (data.trades ?? []).map((t) => {
          if (
            t.result !== "open" &&
            t.entry != null &&
            t.exitPrice != null &&
            t.lots != null &&
            t.lots > 0 &&
            (t.netPnL == null || t.grossPnL == null)
          ) {
            const inst = instruments.find(
              (i) => i.symbol.toLowerCase() === (t.market || "").toLowerCase()
            );
            const metrics = calcTradeMetrics(t, inst);
            if (metrics.netPnL != null) {
              return {
                ...t,
                grossPnL: t.grossPnL ?? metrics.grossPnL,
                netPnL: t.netPnL ?? metrics.netPnL,
                rMultiple: t.rMultiple ?? metrics.realizedR,
              };
            }
          }
          return t;
        });
        set({ ...data, trades: normalizedTrades, hasBootstrapped: true });
      },
      patchAccount: (patch) =>
        set((s) => {
          const { accountName, phaseId, mantra, ...rest } = patch;
          return {
            accountName: accountName ?? s.accountName,
            phaseId: phaseId ?? s.phaseId,
            mantra: mantra ?? s.mantra,
            rules: { ...s.rules, ...rest },
          };
        }),
      setPhaseId: (id) => set({ phaseId: id }),
      updatePhase: (phase) =>
        set((s) => ({ phases: s.phases.map((p) => (p.id === phase.id ? phase : p)) })),
      upsertTrade: (trade) =>
        set((s) => {
          let t = trade;
          if (
            t.result !== "open" &&
            t.entry != null &&
            t.exitPrice != null &&
            t.lots != null &&
            t.lots > 0 &&
            (t.netPnL == null || t.grossPnL == null)
          ) {
            const inst = s.instruments.find(
              (i) => i.symbol.toLowerCase() === (t.market || "").toLowerCase()
            );
            const metrics = calcTradeMetrics(t, inst);
            if (metrics.netPnL != null) {
              t = {
                ...t,
                grossPnL: t.grossPnL ?? metrics.grossPnL,
                netPnL: t.netPnL ?? metrics.netPnL,
                rMultiple: t.rMultiple ?? metrics.realizedR,
              };
            }
          }
          return { trades: upsert(s.trades, t) };
        }),
      removeTrade: (id) => set((s) => ({ trades: s.trades.filter((x) => x.id !== id) })),
      updateTradeReview: (id, reviewed) =>
        set((s) => ({
          trades: s.trades.map((t) => (t.id === id ? { ...t, reviewed } : t)),
        })),
      updateTradeRule: (id, ruleKey, status) =>
        set((s) => ({
          trades: s.trades.map((t) =>
            t.id === id
              ? {
                  ...t,
                  rulesAssessment: {
                    ...(t.rulesAssessment ?? {}),
                    [ruleKey]: status,
                  },
                }
              : t,
          ),
        })),
      updateTradeGrade: (id, grade) =>
        set((s) => ({
          trades: s.trades.map((t) => (t.id === id ? { ...t, grade } : t)),
        })),
      updateTradeTags: (id, setupTags, mistakeTags) =>
        set((s) => ({
          trades: s.trades.map((t) => (t.id === id ? { ...t, setupTags, mistakeTags } : t)),
        })),
      updateTradePlaybook: (id, modelId, modelName) =>
        set((s) => ({
          trades: s.trades.map((t) => (t.id === id ? { ...t, modelId, modelName } : t)),
        })),
      updateTradeScreenshots: (id, patch) =>
        set((s) => ({
          trades: s.trades.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      upsertMissed: (row) => set((s) => ({ missed: upsert(s.missed, row) })),
      removeMissed: (id) => set((s) => ({ missed: s.missed.filter((x) => x.id !== id) })),
      upsertWeekly: (row) => set((s) => ({ weeklies: upsert(s.weeklies, row) })),
      removeWeekly: (id) => set((s) => ({ weeklies: s.weeklies.filter((x) => x.id !== id) })),
      setPlan: (date, plan) => set((s) => ({ dailyPlans: { ...s.dailyPlans, [date]: plan } })),
      setDailyJournalNote: (date, note) =>
        set((s) => {
          const currentPlan = s.dailyPlans[date] ?? {
            date,
            market: "XAUUSD",
            htfStructure: "consolidation" as const,
            previousDay: { pdh: null, pdl: null, pdc: null, dailyOpen: null, midnightOpen: null },
            location: "equilibrium" as const,
            liquidityCondition: "Both" as const,
            expectedDraw: "",
            expectedDelivery: "",
            alignments: { htf: false, liquidity: false, location: false, time: false, narrative: false },
            amdPhase: "",
            expectedManipulation: "",
            expectedDistribution: "",
            dealingRange: { high: null, low: null, open: null, close: null, current: null },
            scenarios: "",
            maxTrades: s.rules.maxTrades,
            maxDailyLossPct: s.rules.maxDailyLossPct,
            riskPerTrade: s.rules.normalRiskPct,
            notes: "",
          };
          const now = new Date();
          const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
          return {
            dailyPlans: {
              ...s.dailyPlans,
              [date]: {
                ...currentPlan,
                notes: note,
                savedAt: timeStr,
              },
            },
          };
        }),
      upsertLiquidity: (row) => set((s) => ({ liquidity: upsert(s.liquidity, row) })),
      removeLiquidity: (id) => set((s) => ({ liquidity: s.liquidity.filter((x) => x.id !== id) })),
      upsertModel: (model) => set((s) => ({ models: upsert(s.models, model) })),
      removeModel: (id) =>
        set((s) => {
          const model = s.models.find((item) => item.id === id);
          if (!model) return {};
          const deleted: RecentlyDeletedModel = { model, deletedAt: new Date().toISOString() };
          return {
            models: s.models.filter((item) => item.id !== id),
            recentlyDeletedModels: [
              ...(s.recentlyDeletedModels ?? []).filter((item) => item.model.id !== id),
              deleted,
            ],
          };
        }),
      restoreModel: (id) => {
        const current = get();
        const deleted = (current.recentlyDeletedModels ?? []).find((item) => item.model.id === id);
        if (!deleted) return false;
        const codeInUse = current.models.some(
          (model) => model.id !== id && model.code.toLowerCase() === deleted.model.code.toLowerCase(),
        );
        if (codeInUse) return false;
        set((s) => ({
          models: [...s.models, deleted.model],
          recentlyDeletedModels: (s.recentlyDeletedModels ?? []).filter((item) => item.model.id !== id),
        }));
        return true;
      },
      permanentlyDeleteModel: (id) =>
        set((s) => ({
          recentlyDeletedModels: (s.recentlyDeletedModels ?? []).filter((item) => item.model.id !== id),
        })),
      upsertChecklistItem: (item) =>
        set((s) => ({ checklistItems: upsert(s.checklistItems, item) })),
      removeChecklistItem: (id) =>
        set((s) => ({ checklistItems: s.checklistItems.filter((x) => x.id !== id) })),
      toggleCheck: (date, id) =>
        set((s) => {
          const cur = new Set(s.checks[date] ?? []);
          if (cur.has(id)) cur.delete(id);
          else cur.add(id);
          return { checks: { ...s.checks, [date]: [...cur] } };
        }),
      setPlanQuestions: (questions) => set({ planQuestions: questions }),
      upsertNews: (event) => set((s) => ({ newsEvents: upsert(s.newsEvents, event) })),
      removeNews: (id) => set((s) => ({ newsEvents: s.newsEvents.filter((x) => x.id !== id) })),
      upsertProtocolDay: (day) => set((s) => ({ protocolDays: upsert(s.protocolDays, day) })),
      addProtocolDay: () =>
        set((s) => {
          const last = s.protocolDays[s.protocolDays.length - 1];
          const day = (last?.day ?? 0) + 1;
          const date = s.rules.protocolStartDate
            ? addDaysISO(s.rules.protocolStartDate, day - 1)
            : addDaysISO(new Date().toISOString().slice(0, 10), day - 1);
          const next: ProtocolDay = {
            id: uid("day"),
            day,
            date,
            title: `Custom · Day ${day}`,
            focus: "Write the job for this day.",
            phase: last?.phase ?? 1,
            riskPct: last?.riskPct ?? s.rules.normalRiskPct,
            maxTrades: last?.maxTrades ?? s.rules.maxTrades,
            completed: false,
            skipped: false,
            notes: "",
          };
          return { protocolDays: [...s.protocolDays, next] };
        }),
      closeToday: (date) =>
        set((s) => ({
          forceClosedDates: s.forceClosedDates.includes(date)
            ? s.forceClosedDates
            : [...s.forceClosedDates, date],
          forceOpenDates: s.forceOpenDates.filter((d) => d !== date),
        })),
      openToday: (date) =>
        set((s) => ({
          forceOpenDates: s.forceOpenDates.includes(date)
            ? s.forceOpenDates
            : [...s.forceOpenDates, date],
          forceClosedDates: s.forceClosedDates.filter((d) => d !== date),
        })),
      rebuildProtocolDates: (startDate) =>
        set((s) => ({
          rules: { ...s.rules, protocolStartDate: startDate },
          protocolDays: s.protocolDays.map((d, i) => ({
            ...d,
            date: addDaysISO(startDate, (d.day || i + 1) - 1),
          })),
        })),
      setThemeId: (id) => set({ themeId: id }),
      setAccentColor: (color) => set({ accentColor: color }),
      setCustomThemeColors: (colors) =>
        set((s) => {
          const merged = {
            ...(s.customThemeColors ?? getCustomThemeColors()),
            ...colors,
          };
          saveCustomThemeColors(merged);
          return { customThemeColors: merged };
        }),
    }),
    {
      name: "ict-narrative-desk",
      skipHydration: true,
      version: 2,
      migrate: (persistedState, version) => {
        if (version >= 2 || typeof persistedState !== "object" || persistedState === null) {
          return persistedState as DeskData;
        }
        const state = persistedState as Partial<DeskData>;
        if (!state.instruments) return state as DeskData;
        return {
          ...state,
          instruments: state.instruments.map((instrument) =>
            instrument.id === "xau" &&
            instrument.symbol === "XAUUSD" &&
            instrument.tickSize === 0.01 &&
            instrument.tickValuePerLot === 100
              ? { ...instrument, tickValuePerLot: 1 }
              : instrument,
          ),
        } as DeskData;
      },
      partialize: (state) => ({
        hasBootstrapped: state.hasBootstrapped,
        accountName: state.accountName,
        phaseId: state.phaseId,
        phases: state.phases,
        rules: state.rules,
        mantra: state.mantra,
        themeId: state.themeId,
        accentColor: state.accentColor,
        customThemeColors: state.customThemeColors,
        instruments: state.instruments,
        models: state.models,
        recentlyDeletedModels: state.recentlyDeletedModels ?? [],
        trades: state.trades,
        missed: state.missed,
        weeklies: state.weeklies,
        dailyPlans: state.dailyPlans,
        liquidity: state.liquidity,
        checklistItems: state.checklistItems,
        checks: state.checks,
        planQuestions: state.planQuestions ?? DEFAULT_PLAN_QUESTIONS,
        protocolDays: state.protocolDays,
        newsEvents: state.newsEvents,
        forceClosedDates: state.forceClosedDates,
        forceOpenDates: state.forceOpenDates,
      }),
    },
  ),
);

export function deskSnapshot(): DeskData {
  const state = useDeskStore.getState();
  return {
    hasBootstrapped: state.hasBootstrapped,
    accountName: state.accountName,
    phaseId: state.phaseId,
    phases: state.phases,
    rules: state.rules,
    mantra: state.mantra,
    themeId: state.themeId,
    accentColor: state.accentColor,
    customThemeColors: state.customThemeColors,
    instruments: state.instruments,
    models: state.models,
    recentlyDeletedModels: state.recentlyDeletedModels ?? [],
    trades: state.trades,
    missed: state.missed,
    weeklies: state.weeklies,
    dailyPlans: state.dailyPlans,
    liquidity: state.liquidity,
    checklistItems: state.checklistItems,
    checks: state.checks,
    planQuestions: state.planQuestions ?? DEFAULT_PLAN_QUESTIONS,
    protocolDays: state.protocolDays,
    newsEvents: state.newsEvents,
    forceClosedDates: state.forceClosedDates,
    forceOpenDates: state.forceOpenDates,
  };
}
