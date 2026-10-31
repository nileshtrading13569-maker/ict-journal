import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import type { DeskData } from "@/lib/ict-types";

export function isDeskData(value: unknown): value is DeskData {
  if (typeof value !== "object" || value === null) return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.hasBootstrapped === "boolean" &&
    typeof data.accountName === "string" &&
    typeof data.phaseId === "number" &&
    typeof data.rules === "object" &&
    data.rules !== null &&
    (data.themeId === undefined || typeof data.themeId === "string") &&
    (data.accentColor === undefined || typeof data.accentColor === "string") &&
    Array.isArray(data.phases) &&
    Array.isArray(data.instruments) &&
    Array.isArray(data.models) &&
    (data.recentlyDeletedModels === undefined || Array.isArray(data.recentlyDeletedModels)) &&
    Array.isArray(data.trades) &&
    Array.isArray(data.missed) &&
    Array.isArray(data.weeklies) &&
    typeof data.dailyPlans === "object" &&
    data.dailyPlans !== null &&
    Array.isArray(data.liquidity) &&
    Array.isArray(data.checklistItems) &&
    typeof data.checks === "object" &&
    data.checks !== null &&
    Array.isArray(data.protocolDays) &&
    Array.isArray(data.newsEvents) &&
    Array.isArray(data.forceClosedDates) &&
    Array.isArray(data.forceOpenDates)
  );
}

const deskDataSchema = z.custom<DeskData>(isDeskData, "Invalid desk data");
const savePayloadSchema = deskDataSchema.refine((data) => JSON.stringify(data).length <= 1_000_000, {
  message: "Desk data exceeds the 1 MB limit",
});

export const loadDeskState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ state: unknown }>`
      select state
      from user_desk_state
      where user_id = ${context.userId}
      limit 1
    `;
    if (!rows[0]) return null;
    if (!isDeskData(rows[0].state)) {
      throw new Error("Stored desk state is invalid");
    }
    return rows[0].state;
  });

export const saveDeskState = createServerFn({ method: "POST" })
  .validator((input: unknown) => savePayloadSchema.parse(input))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into user_desk_state (user_id, state, updated_at)
      values (${context.userId}, ${JSON.stringify(data)}::jsonb, now())
      on conflict (user_id)
      do update set state = excluded.state, updated_at = now()
    `;
    return { saved: true };
  });

export async function syncDeskToServer(): Promise<{ saved: boolean }> {
  try {
    const { deskSnapshot } = await import("@/lib/ict-store");
    const snapshot = deskSnapshot();
    return await saveDeskState({ data: snapshot });
  } catch (error) {
    console.warn("[desk-sync] server sync notice:", error);
    return { saved: false };
  }
}
