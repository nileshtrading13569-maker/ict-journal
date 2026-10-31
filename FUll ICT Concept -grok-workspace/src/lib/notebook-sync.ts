import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import type { NotebookEntry } from "@/lib/notebook-defaults";

const notebookEntrySchema = z.object({
  id: z.string(),
  folder: z.string(),
  title: z.string(),
  subDate: z.string().optional(),
  date: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  pinned: z.boolean(),
  tags: z.array(z.string()),
  content: z.string(),
  manualMetrics: z
    .object({
      netPnl: z.number(),
      grossPnl: z.number(),
      commissions: z.number(),
      totalTrades: z.number(),
      winners: z.number(),
      losers: z.number(),
      winrate: z.number(),
      volume: z.number(),
      profitFactor: z.number(),
    })
    .optional(),
});

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
    await saveUserNotebook(context.userId, data);
    return { saved: true };
  });
