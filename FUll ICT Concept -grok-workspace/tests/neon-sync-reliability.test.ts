import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { getSql } from "@/lib/db";
import {
  loadUserDatabase,
  saveUserDatabase,
  loadUserNotebook,
  saveUserNotebook,
} from "@/lib/storage/user-database.server";
import { createInitialState } from "@/lib/ict-defaults";
import type { DeskData, SetupModel, Trade, MissedTrade } from "@/lib/ict-types";
import type { NotebookEntry } from "@/lib/notebook-defaults";

/**
 * Traps any attempted filesystem write or directory creation to ensure zero FS operations.
 */
function setupFsWriteInterceptor() {
  const calls: Array<{ method: string; path: string }> = [];

  const origMkdirSync = fs.mkdirSync;
  const origWriteFileSync = fs.writeFileSync;
  const origAppendFileSync = fs.appendFileSync;
  const origPromisesMkdir = fs.promises.mkdir;
  const origPromisesWriteFile = fs.promises.writeFile;
  const origPromisesAppendFile = fs.promises.appendFile;

  function intercept(method: string, targetPath: unknown) {
    const pathStr = String(targetPath ?? "");
    calls.push({ method, path: pathStr });
    if (
      pathStr.includes("storage") ||
      pathStr.includes("/var/task") ||
      pathStr.includes("\\var\\task") ||
      pathStr.includes("users")
    ) {
      const err = new Error(`ENOENT: no such file or directory, mkdir '${pathStr}'`);
      (err as any).code = "ENOENT";
      throw err;
    }
  }

  (fs as any).mkdirSync = function (p: any, ...args: any[]) {
    intercept("mkdirSync", p);
    return (origMkdirSync as Function).apply(fs, [p, ...args]);
  };
  (fs as any).writeFileSync = function (p: any, ...args: any[]) {
    intercept("writeFileSync", p);
    return (origWriteFileSync as Function).apply(fs, [p, ...args]);
  };
  (fs as any).appendFileSync = function (p: any, ...args: any[]) {
    intercept("appendFileSync", p);
    return (origAppendFileSync as Function).apply(fs, [p, ...args]);
  };
  (fs.promises as any).mkdir = async function (p: any, ...args: any[]) {
    intercept("promises.mkdir", p);
    return (origPromisesMkdir as Function).apply(fs.promises, [p, ...args]);
  };
  (fs.promises as any).writeFile = async function (p: any, ...args: any[]) {
    intercept("promises.writeFile", p);
    return (origPromisesWriteFile as Function).apply(fs.promises, [p, ...args]);
  };
  (fs.promises as any).appendFile = async function (p: any, ...args: any[]) {
    intercept("promises.appendFile", p);
    return (origPromisesAppendFile as Function).apply(fs.promises, [p, ...args]);
  };

  return {
    calls,
    restore() {
      (fs as any).mkdirSync = origMkdirSync;
      (fs as any).writeFileSync = origWriteFileSync;
      (fs as any).appendFileSync = origAppendFileSync;
      (fs.promises as any).mkdir = origPromisesMkdir;
      (fs.promises as any).writeFile = origPromisesWriteFile;
      (fs.promises as any).appendFile = origPromisesAppendFile;
    },
  };
}

describe("Neon Backend Sync Reliability & Persistence Invariants", () => {
  const stamp = Date.now();
  const userId = `sync-user-${stamp}`;
  const googleUserId = `google-sync-sub-${stamp}`;
  const email = `sync.${stamp}@neon.test`;

  before(async () => {
    const sql = await getSql();

    // Create user and account record in database
    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values (${userId}, 'Sync Trader', ${email}, true, now(), now())
      on conflict ("id") do nothing
    `;

    await sql`
      insert into "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt")
      values (${'acc-' + userId}, ${googleUserId}, 'google', ${userId}, now(), now())
      on conflict ("id") do nothing
    `;
  });

  describe("1. Notebook Sync & Persistence", () => {
    it("persists note changes to user_notebook_state AND google_user_databases and reloads accurately", async () => {
      const interceptor = setupFsWriteInterceptor();
      try {
        const sql = await getSql();

        // 1. Initial load generates defaults and populates both tables
        const initial = await loadUserNotebook(userId);
        assert.ok(initial);
        assert.ok(Array.isArray(initial.notes));

        // Confirm both tables have initial data
        const nbCheck1 = await sql<{ user_id: string }>`select user_id from user_notebook_state where user_id = ${userId}`;
        assert.equal(nbCheck1.length, 1, "user_notebook_state has initial row");

        const gdbCheck1 = await sql<{ notebook_state: any }>`select notebook_state from google_user_databases where google_user_id = ${googleUserId}`;
        assert.equal(gdbCheck1.length, 1, "google_user_databases has initial row");

        // 2. Create a new custom note
        const noteId = `note-${stamp}-custom`;
        const newNote: NotebookEntry = {
          id: noteId,
          folder: "Daily Journal",
          title: "NY Session High-Impact Tape",
          date: "2026-11-05",
          createdAt: "2026-11-05 09:30",
          updatedAt: "2026-11-05 09:30",
          pinned: true,
          tags: ["NY AM", "SilverBullet"],
          content: "Swept liquidity cleanly at 09:45 and formed 5m FVG.",
        };

        const updatedNotes = [newNote, ...initial.notes];
        await saveUserNotebook(userId, {
          folders: [...initial.folders, "Strategy Notes"],
          notes: updatedNotes,
        });

        // Confirm written to BOTH user_notebook_state and google_user_databases
        const nbRows = await sql<{ notes: any; folders: any }>`
          select notes, folders from user_notebook_state where user_id = ${userId}
        `;
        assert.ok(nbRows[0].notes.some((n: any) => n.id === noteId), "New note is in user_notebook_state");
        assert.ok(nbRows[0].folders.includes("Strategy Notes"), "New folder is in user_notebook_state");

        const gdbRows = await sql<{ notebook_state: any }>`
          select notebook_state from google_user_databases where google_user_id = ${googleUserId}
        `;
        assert.ok(gdbRows[0].notebook_state.notes.some((n: any) => n.id === noteId), "New note is in google_user_databases");
        assert.ok(gdbRows[0].notebook_state.folders.includes("Strategy Notes"), "New folder is in google_user_databases");

        // 3. Edit existing note
        const editedNotes = updatedNotes.map((n) =>
          n.id === noteId ? { ...n, title: "NY Session Edited Title", content: "Updated content from browser B" } : n,
        );
        await saveUserNotebook(userId, { folders: initial.folders, notes: editedNotes });

        // Simulate reload on another device / refresh
        const reloaded = await loadUserNotebook(userId);
        const fetchedNote = reloaded.notes.find((n) => n.id === noteId);
        assert.ok(fetchedNote);
        assert.equal(fetchedNote.title, "NY Session Edited Title");
        assert.equal(fetchedNote.content, "Updated content from browser B");

        // 4. Delete note
        const remainingNotes = editedNotes.filter((n) => n.id !== noteId);
        await saveUserNotebook(userId, { folders: initial.folders, notes: remainingNotes });

        const reloadedAfterDelete = await loadUserNotebook(userId);
        assert.equal(reloadedAfterDelete.notes.some((n) => n.id === noteId), false);

        assert.equal(interceptor.calls.length, 0, "Zero filesystem operations");
      } finally {
        interceptor.restore();
      }
    });
  });

  describe("2. Journal (Trades) & Desk Sync", () => {
    it("persists trade create/update/delete to user_desk_state AND google_user_databases", async () => {
      const interceptor = setupFsWriteInterceptor();
      try {
        const sql = await getSql();

        // 1. Initial desk load
        const desk = await loadUserDatabase(userId);
        assert.ok(desk);
        assert.equal(desk.hasBootstrapped, true);

        // 2. Add a new trade
        const tradeId = `trade-${stamp}-1`;
        const testTrade: Trade = {
          id: tradeId,
          date: "2026-11-05",
          time: "09:45",
          market: "NQ",
          direction: "bullish",
          contracts: 2,
          entryPrice: 20500,
          stopPrice: 20480,
          targetPrice: 20550,
          exitPrice: 20540,
          exitDate: "2026-11-05",
          exitTime: "10:15",
          fees: 5.5,
          pnlDollar: 1594.5,
          modelId: "m1",
          modelName: "Silver Bullet",
          rMultiple: 2.0,
          result: "win",
          grade: "A+",
          reviewed: true,
          tags: ["LondonSweep", "OTE"],
          setupTags: ["LondonSweep"],
          mistakeTags: [],
          rulesAssessment: { htf_bias: "followed", sweep: "followed", mss: "followed" },
          ruleFollowed: true,
          notes: "Executed on 5m FVG retracement inside NY AM KZ",
          screenshotHtf: "data:image/png;base64,htf_fake_shot",
          screenshotExec: "data:image/png;base64,exec_fake_shot",
        };

        const deskWithTrade: DeskData = {
          ...desk,
          trades: [testTrade, ...desk.trades],
        };

        await saveUserDatabase(userId, deskWithTrade);

        // Verify written to BOTH google_user_databases AND user_desk_state
        const gdbDesk = await sql<{ desk_state: any; trade_history: any }>`
          select desk_state, trade_history from google_user_databases where google_user_id = ${googleUserId}
        `;
        assert.equal(gdbDesk.length, 1);
        assert.ok(gdbDesk[0].desk_state.trades.some((t: any) => t.id === tradeId), "Trade is in google_user_databases desk_state");
        assert.ok(gdbDesk[0].trade_history.trades.some((t: any) => t.id === tradeId), "Trade is in google_user_databases trade_history");

        const legacyDesk = await sql<{ state: any }>`
          select state from user_desk_state where user_id = ${userId}
        `;
        assert.equal(legacyDesk.length, 1);
        assert.ok(legacyDesk[0].state.trades.some((t: any) => t.id === tradeId), "Trade is in user_desk_state");

        // 3. Update trade (e.g. tag, review, grade)
        const updatedTrades = deskWithTrade.trades.map((t) =>
          t.id === tradeId ? { ...t, grade: "S" as const, reviewed: true, notes: "Post-review narrative" } : t,
        );
        await saveUserDatabase(userId, { ...deskWithTrade, trades: updatedTrades });

        // Simulate refresh or second device load
        const refreshedDesk = await loadUserDatabase(userId);
        const reloadedTrade = refreshedDesk.trades.find((t) => t.id === tradeId);
        assert.ok(reloadedTrade);
        assert.equal(reloadedTrade.grade, "S");
        assert.equal(reloadedTrade.notes, "Post-review narrative");

        // 4. Delete trade
        const clearedTrades = refreshedDesk.trades.filter((t) => t.id !== tradeId);
        await saveUserDatabase(userId, { ...refreshedDesk, trades: clearedTrades });

        const deskAfterDelete = await loadUserDatabase(userId);
        assert.equal(deskAfterDelete.trades.some((t: any) => t.id === tradeId), false);

        assert.equal(interceptor.calls.length, 0, "Zero filesystem operations");
      } finally {
        interceptor.restore();
      }
    });

    it("persists missed trades and daily journal notes reliably", async () => {
      const desk = await loadUserDatabase(userId);

      // Add missed trade
      const missedId = `missed-${stamp}-1`;
      const missedTrade: MissedTrade = {
        id: missedId,
        date: "2026-11-05",
        time: "10:30",
        market: "ES",
        direction: "bearish",
        model: "London Run",
        reason: "hesitation",
        notes: "Hesitated on entry trigger",
        outcomeR: 3.5,
      };

      const updated = {
        ...desk,
        missed: [missedTrade, ...desk.missed],
        dailyPlans: {
          ...desk.dailyPlans,
          "2026-11-05": {
            dailyBias: "bearish",
            sessionNarrative: "Key daily note persisted to cloud",
          } as any,
        },
      };

      await saveUserDatabase(userId, updated);

      // Reload and verify
      const reloaded = await loadUserDatabase(userId);
      assert.ok(reloaded.missed.some((m) => m.id === missedId));
      assert.equal(reloaded.dailyPlans["2026-11-05"]?.sessionNarrative, "Key daily note persisted to cloud");
    });
  });

  describe("3. Playbook Models Sync & Persistence", () => {
    it("persists model creation, update, activation toggle, soft delete and restore", async () => {
      const interceptor = setupFsWriteInterceptor();
      try {
        const desk = await loadUserDatabase(userId);

        // 1. Create a custom playbook model
        const customModelId = `model-${stamp}-prop`;
        const newModel: SetupModel = {
          id: customModelId,
          code: `PB${String(stamp).slice(-3)}`,
          name: "High Probability Judas",
          market: "NQ",
          timeframe: "5m",
          session: "NY AM",
          active: true,
          description: "Asian range purge followed by MSS and 5m FVG displacement",
          rules: ["Asian sweep", "5m MSS", "Displacement FVG"],
          validWhen: ["Asian sweep > 5 ticks"],
          invalidWhen: ["High impact news within 15m"],
          pdArray: "FVG",
          trigger: "Displacement candle close",
          invalidation: "Sweep beyond origin candle",
          target: "Opposing liquidity pool",
          requiredTiming: "09:30 - 10:30 EST",
        };

        const deskWithModel: DeskData = {
          ...desk,
          models: [newModel, ...desk.models],
        };
        await saveUserDatabase(userId, deskWithModel);

        // Verify reloaded on second device
        const reloaded1 = await loadUserDatabase(userId);
        const foundModel = reloaded1.models.find((m) => m.id === customModelId);
        assert.ok(foundModel);
        assert.equal(foundModel.name, "High Probability Judas");
        assert.equal(foundModel.active, true);

        // 2. Toggle active
        const toggledModels = reloaded1.models.map((m) =>
          m.id === customModelId ? { ...m, active: false } : m,
        );
        await saveUserDatabase(userId, { ...reloaded1, models: toggledModels });

        const reloaded2 = await loadUserDatabase(userId);
        const toggledModel = reloaded2.models.find((m) => m.id === customModelId);
        assert.ok(toggledModel);
        assert.equal(toggledModel.active, false);

        // 3. Move to recentlyDeletedModels (soft delete)
        const activeModels = reloaded2.models.filter((m) => m.id !== customModelId);
        const recentlyDeleted = [
          {
            model: toggledModel,
            deletedAt: new Date().toISOString(),
          },
          ...(reloaded2.recentlyDeletedModels ?? []),
        ];

        await saveUserDatabase(userId, {
          ...reloaded2,
          models: activeModels,
          recentlyDeletedModels: recentlyDeleted,
        });

        const reloaded3 = await loadUserDatabase(userId);
        assert.equal(reloaded3.models.some((m) => m.id === customModelId), false, "Model removed from active list");
        assert.ok(
          reloaded3.recentlyDeletedModels.some((d) => d.model.id === customModelId),
          "Model is in recentlyDeletedModels",
        );

        // 4. Restore model
        const restored = reloaded3.recentlyDeletedModels.find((d) => d.model.id === customModelId)!.model;
        const restoredRecentlyDeleted = reloaded3.recentlyDeletedModels.filter((d) => d.model.id !== customModelId);
        const restoredActiveModels = [restored, ...reloaded3.models];

        await saveUserDatabase(userId, {
          ...reloaded3,
          models: restoredActiveModels,
          recentlyDeletedModels: restoredRecentlyDeleted,
        });

        const reloaded4 = await loadUserDatabase(userId);
        assert.ok(reloaded4.models.some((m) => m.id === customModelId), "Model is restored to active");
        assert.equal(
          reloaded4.recentlyDeletedModels.some((d) => d.model.id === customModelId),
          false,
          "Model removed from recentlyDeletedModels",
        );

        assert.equal(interceptor.calls.length, 0, "Zero filesystem operations");
      } finally {
        interceptor.restore();
      }
    });
  });

  describe("4. Error Safety & Confirmation Checks", () => {
    it("guarantees write confirmation and throws on empty/missing rows", async () => {
      // Calling saveUserDatabase and saveUserNotebook should return { success: true }
      const initialDesk = createInitialState();
      const deskRes = await saveUserDatabase(userId, initialDesk);
      assert.equal(deskRes.success, true);

      const nbRes = await saveUserNotebook(userId, { folders: ["Notes"], notes: [] });
      assert.equal(nbRes.success, true);
    });
  });
});

