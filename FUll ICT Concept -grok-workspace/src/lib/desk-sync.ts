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
    (data.customThemeColors === undefined ||
      (typeof data.customThemeColors === "object" && data.customThemeColors !== null)) &&
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

const deskDataSchema = z.custom<DeskData>(isDeskData, {
  message: "Invalid DeskData structure",
});

// Allow up to 50 MB payload to safely accommodate chart screenshots and map data
const savePayloadSchema = deskDataSchema.refine((data: DeskData) => JSON.stringify(data).length <= 50_000_000, {
  message: "Desk data exceeds the 50 MB limit",
});

export const loadDeskState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { loadUserDatabase } = await import("@/lib/storage/user-database.server");
    return loadUserDatabase(context.userId);
  });

export const saveDeskState = createServerFn({ method: "POST" })
  .validator((input: unknown) => savePayloadSchema.parse(input))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { saveUserDatabase } = await import("@/lib/storage/user-database.server");
    await saveUserDatabase(context.userId, data);
    return { saved: true };
  });

export const getIsolatedStorageInfo = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { resolveGoogleUserIdentity } = await import("@/lib/storage/user-database.server");
    return resolveGoogleUserIdentity(context.userId);
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
