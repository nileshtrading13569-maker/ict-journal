import { emptyTrade } from "./ict-defaults";
import type { DeskData, Side, Trade, TradeResult } from "./ict-types";
import { uid } from "./utils";
import { isDateKey } from "./journal-dates";

const EXPORT_COLUMNS: (keyof Trade)[] = [
  "date",
  "time",
  "market",
  "side",
  "result",
  "rMultiple",
  "entry",
  "sl",
  "exitPrice",
  "session",
  "killZone",
  "modelName",
  "ruleFollowed",
  "notes",
];

const REQUIRED_COLUMNS = ["date", "time", "market", "side", "result"];
const RESULTS: TradeResult[] = ["open", "win", "loss", "be"];

export function tradeKey(trade: Trade) {
  return [
    trade.date,
    trade.time,
    trade.market.toLowerCase(),
    trade.side,
    trade.entry ?? "",
    trade.result,
  ].join("|");
}

export function buildTradesCsv(trades: Trade[]) {
  const lines = [
    EXPORT_COLUMNS.join(","),
    ...trades.map((trade) => EXPORT_COLUMNS.map((column) => csvCell(trade[column])).join(",")),
  ];
  return lines.join("\r\n");
}

export function downloadText(content: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export type CsvImportResult = { trades: Trade[]; skipped: number };

/**
 * Parses an exported-trades CSV into new Trade rows. Rows that are malformed or
 * already present (same date, time, market, side, entry and result) are counted
 * as skipped rather than silently dropped.
 */
export function importTradesFromCsv(
  text: string,
  desk: Pick<DeskData, "models" | "rules">,
  existing: Trade[],
): CsvImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("CSV must include a header and at least one trade.");

  const headers = rows[0].map((header) => header.trim().replace(/^\uFEFF/, ""));
  if (REQUIRED_COLUMNS.some((header) => !headers.includes(header))) {
    throw new Error(`CSV must include these columns: ${REQUIRED_COLUMNS.join(", ")}.`);
  }

  const keys = new Set(existing.map(tradeKey));
  const imported: Trade[] = [];
  let skipped = 0;

  for (const row of rows.slice(1)) {
    if (!row.some((cell) => cell.trim())) continue;
    const record: Record<string, string> = Object.fromEntries(
      headers.map((header, index) => [header, row[index] ?? ""]),
    );

    const date = record.date.trim();
    const rawSide = record.side.trim().toLowerCase();
    const result = record.result.trim().toLowerCase();
    const valid =
      isDateKey(date) &&
      record.market.trim().length > 0 &&
      record.time.trim().length > 0 &&
      (rawSide === "long" || rawSide === "short") &&
      RESULTS.includes(result as TradeResult);

    if (!valid) {
      skipped += 1;
      continue;
    }

    const model = desk.models.find((candidate) => candidate.name === record.modelName?.trim());
    const trade = emptyTrade(date, record.time.trim(), desk.rules.normalRiskPct, model);
    trade.id = uid("trade");
    trade.market = record.market.trim();
    trade.side = rawSide as Side;
    trade.result = result as TradeResult;
    trade.rMultiple = csvNumber(record.rMultiple);
    trade.entry = csvNumber(record.entry);
    trade.sl = csvNumber(record.sl);
    trade.exitPrice = csvNumber(record.exitPrice);
    trade.session = (record.session?.trim() as Trade["session"]) || "";
    trade.killZone = (record.killZone?.trim() as Trade["killZone"]) || "";
    trade.ruleFollowed = record.ruleFollowed?.trim().toLowerCase() !== "false";
    trade.notes = record.notes?.trim() ?? "";

    const key = tradeKey(trade);
    if (keys.has(key)) {
      skipped += 1;
      continue;
    }
    keys.add(key);
    imported.push(trade);
  }

  if (!imported.length) {
    throw new Error("No valid new trades found. Check the required columns and row values.");
  }
  return { trades: imported, skipped };
}

function csvNumber(value: string | undefined) {
  if (!value?.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"' && cell.length === 0) quoted = true;
    else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else cell += character;
  }

  if (quoted) throw new Error("CSV contains an unterminated quoted value.");
  row.push(cell);
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}
