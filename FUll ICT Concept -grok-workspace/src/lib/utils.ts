import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { todayISO as nyToday } from "./ict-time.ts";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(prefix = "id") {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function todayISO() {
  return nyToday();
}

export function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPct(n: number, digits = 2) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export function formatR(n: number, digits = 2) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}R`;
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function parseNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
