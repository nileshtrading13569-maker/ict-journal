import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import type { NotebookEntry } from "@/lib/notebook-defaults";

const notebookEntrySchema = z
  .object({
    id: z.string(),
    folder: z.string().default("Daily Journal"),
    title: z.string().default("Untitled Note"),
    subDate: z.string().nullish(),
    date: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedAt: z.string().nullish(),
    pinned: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    content: z.string().default(""),
    manualMetrics: z
      .object({
        netPnl: z.number().nullish(),
        grossPnl: z.number().nullish(),
        commissions: z.number().nullish(),
        totalTrades: z.number().nullish(),
        winners: z.number().nullish(),
        losers: z.number().nullish(),
        winrate: z.number().nullish(),
        volume: z.number().nullish(),
        profitFactor: z.number().nullish(),
      })
      .partial()
      .nullish(),
  })
  .passthrough();

const notebookPayloadSchema = z.object({
  folders: z.array(z.string()),
  notes: z.array(notebookEntrySchema),
});

export const loadNotebookState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { loadUserNotebook } = await import("@/lib/storage/user-database.server");
    return loadUserNotebook(context.userId);
  });

export const saveNotebookState = createServerFn({ method: "POST" })
  .validator((input: unknown) => notebookPayloadSchema.parse(input))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { saveUserNotebook } = await import("@/lib/storage/user-database.server");
    await saveUserNotebook(context.userId, data as unknown as { folders: string[]; notes: NotebookEntry[] });
    return { saved: true };
  });
