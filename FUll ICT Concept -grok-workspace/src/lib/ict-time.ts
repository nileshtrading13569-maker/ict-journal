export const TRADING_TZ = "America/New_York";

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
