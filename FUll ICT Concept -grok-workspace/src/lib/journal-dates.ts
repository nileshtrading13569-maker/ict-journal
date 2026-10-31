import type { MissedTrade, Trade } from "./ict-types";

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getQuarterStart(date: Date) {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}

export function getCalendarDays(month: Date): (Date | null)[] {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const cellCount = Math.ceil((mondayOffset + daysInMonth) / 7) * 7;

  return Array.from({ length: cellCount }, (_, index) => {
    const day = index - mondayOffset + 1;
    return day > 0 && day <= daysInMonth ? new Date(month.getFullYear(), month.getMonth(), day) : null;
  });
}

export function isDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export type DayEntryCounts = { taken: number; missed: number };

/** One pass over both journals so every calendar shares the same lookup. */
export function buildEntriesByDate(
  trades: Trade[],
  missed: MissedTrade[],
): Map<string, DayEntryCounts> {
  const entries = new Map<string, DayEntryCounts>();
  for (const trade of trades) {
    const counts = entries.get(trade.date) ?? { taken: 0, missed: 0 };
    counts.taken += 1;
    entries.set(trade.date, counts);
  }
  for (const trade of missed) {
    const counts = entries.get(trade.date) ?? { taken: 0, missed: 0 };
    counts.missed += 1;
    entries.set(trade.date, counts);
  }
  return entries;
}

export function netROf(trades: Trade[]) {
  return trades.reduce((total, trade) => total + (trade.rMultiple ?? 0), 0);
}

export function activeDayCount(trades: Trade[], missed: MissedTrade[]) {
  return new Set([...trades, ...missed].map((row) => row.date)).size;
}

export function formatLongDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
