import { addDaysISO } from "./ict-time.ts";
import type { Trade } from "./ict-types.ts";

export type ActivityDay = {
  date: string;
  checked: number;
  total: number;
  trades: number;
  netR: number;
  level: 0 | 1 | 2 | 3 | 4;
  isFuture: boolean;
};

export type ActivityCalendarInput = {
  endDate: string;
  weeks?: number;
  coreChecklistIds: string[];
  checks: Record<string, string[]>;
  trades: Pick<Trade, "date" | "result" | "rMultiple">[];
};

export function buildActivityCalendar({
  endDate,
  weeks = 26,
  coreChecklistIds,
  checks,
  trades,
}: ActivityCalendarInput): ActivityDay[][] {
  const weekCount = Number.isFinite(weeks) ? Math.max(1, Math.floor(weeks)) : 26;
  const endWeekday = new Date(`${endDate}T00:00:00.000Z`).getUTCDay();
  const lastDate = addDaysISO(endDate, 6 - endWeekday);
  const firstDate = addDaysISO(lastDate, 1 - weekCount * 7);
  const coreIds = new Set(coreChecklistIds);
  const tradesByDate = new Map<string, { count: number; netR: number }>();

  for (const trade of trades) {
    const day = tradesByDate.get(trade.date) ?? { count: 0, netR: 0 };
    day.count += 1;
    if (
      trade.result !== "open" &&
      typeof trade.rMultiple === "number" &&
      Number.isFinite(trade.rMultiple)
    ) {
      day.netR += trade.rMultiple;
    }
    tradesByDate.set(trade.date, day);
  }

  return Array.from({ length: weekCount }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const date = addDaysISO(firstDate, weekIndex * 7 + dayIndex);
      const isFuture = date > endDate;
      const checkedIds = new Set(checks[date] ?? []);
      const checked = isFuture
        ? 0
        : [...coreIds].filter((id) => checkedIds.has(id)).length;
      const activity = isFuture ? undefined : tradesByDate.get(date);
      const total = coreIds.size;
      const progressLevel = total > 0 ? Math.ceil((checked / total) * 4) : 0;
      const level = Math.min(4, Math.max(progressLevel, activity?.count ? 1 : 0)) as ActivityDay["level"];

      return {
        date,
        checked,
        total,
        trades: activity?.count ?? 0,
        netR: activity?.netR ?? 0,
        level,
        isFuture,
      };
    }),
  );
}