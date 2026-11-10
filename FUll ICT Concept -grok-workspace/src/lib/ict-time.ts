export const TRADING_TZ = "America/New_York";
export const IST_TZ = "Asia/Kolkata";

function part(parts: Intl.DateTimeFormatPart[], type: string) {
  return parts.find((p) => p.type === type)?.value ?? "";
}

export function nyParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TRADING_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(date);
  let hour = part(parts, "hour");
  if (hour === "24") hour = "00";
  return {
    year: part(parts, "year"),
    month: part(parts, "month"),
    day: part(parts, "day"),
    hour,
    minute: part(parts, "minute"),
    weekday: part(parts, "weekday"),
  };
}

export function todayISO(date = new Date()) {
  const p = nyParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

export function nowHHMM(date = new Date()) {
  const p = nyParts(date);
  return `${p.hour}:${p.minute}`;
}

/**
 * Returns current Indian Standard Time (IST) in 12-hour AM/PM format (e.g. "02:05 PM").
 */
export function nowIST12(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "";
  const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value?.toUpperCase() ?? "";
  return `${hour}:${minute} ${dayPeriod}`;
}

/**
 * Converts an ICT New York hour and minute (00:00 to 23:59) into
 * 12-hour AM/PM format Indian Standard Time (IST), dynamically respecting
 * New York Daylight Saving Time (EDT in summer, EST in winter).
 */
export function nyTimeToIST12(nyHour: number, nyMin = 0, date = new Date()): string {
  const ymdParts = new Intl.DateTimeFormat("en-US", {
    timeZone: TRADING_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = Number(ymdParts.find((p) => p.type === "year")?.value || 2026);
  const m = Number(ymdParts.find((p) => p.type === "month")?.value || 1);
  const d = Number(ymdParts.find((p) => p.type === "day")?.value || 1);

  // Converge to the exact UTC timestamp matching nyHour:nyMin in America/New_York
  let target = new Date(Date.UTC(y, m - 1, d, nyHour + 5, nyMin));
  for (let step = 0; step < 5; step++) {
    const nyH = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TRADING_TZ, hour: "2-digit", hour12: false }).format(target));
    const nyM = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TRADING_TZ, minute: "2-digit", hour12: false }).format(target));
    const diffMinutes = (nyHour - nyH) * 60 + (nyMin - nyM);
    if (diffMinutes === 0) break;
    target = new Date(target.getTime() + diffMinutes * 60000);
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(target);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "";
  const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value?.toUpperCase() ?? "";
  return `${hour}:${minute} ${dayPeriod}`;
}

export function weekdayShort(dateISO: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][utc.getUTCDay()];
}

export function weekStartISO(dateISO: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const day = new Date(utc).getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(utc);
  mon.setUTCDate(mon.getUTCDate() + diff);
  return mon.toISOString().slice(0, 10);
}

export function addDaysISO(dateISO: string, days: number) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

export function inWindow(start: string, end: string, now = nowHHMM()) {
  if (start <= end) return now >= start && now <= end;
  return now >= start || now <= end;
}
