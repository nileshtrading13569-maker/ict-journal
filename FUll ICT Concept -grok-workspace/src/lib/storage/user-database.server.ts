import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getSql } from "../db.ts";
import { createResetState, ensureMinimumDeskData } from "../ict-defaults.ts";
import type { DeskData, LiquidityLevel, DailyPlan, WeeklyNarrative, Trade, MissedTrade } from "../ict-types.ts";
import { DEFAULT_FOLDERS, SEED_NOTES, type NotebookEntry } from "../notebook-defaults.ts";

export type GoogleUserIdentity = {
  googleUserId: string;
  userId: string;
  email: string | null;
  name: string | null;
  picture: string | null;
};

export type PartitionedTradeHistory = {
  trades: Trade[];
  missed: MissedTrade[];
};

export type PartitionedMapData = {
  liquidity: LiquidityLevel[];
  dailyPlans: Record<string, DailyPlan>;
  weeklies: WeeklyNarrative[];
};

export type PartitionedScreenshots = {
  tradeScreenshots: Array<{
    tradeId: string;
    screenshotHtf: string;
    screenshotExec: string;
  }>;
};

/**
 * Base root directory for server-side file storage per Google account.
 */
function getStorageRoot(): string {
  // Vercel / serverless pe filesystem writable nahi hota
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return join("/tmp", "storage", "users");
  }
  const root = process.cwd();
  return join(root, "storage", "users");
}

/**
 * Sanitize Google User ID for safe filesystem folder naming.
 */
function sanitizeFolderId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Ensure the user's isolated filesystem directory structure exists.
 */
export function ensureUserStorageDirectory(googleUserId: string): string {
  const safeId = sanitizeFolderId(googleUserId);
  const dir = join(getStorageRoot(), safeId);

  // Serverless pe sirf /tmp use karo, fail hone do mat
  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const screenshotsDir = join(dir, "screenshots");
    if (!existsSync(screenshotsDir)) {
      mkdirSync(screenshotsDir, { recursive: true });
    }
  } catch (err) {
    console.warn("[user-database] filesystem storage unavailable (serverless):", err);
  }

  return dir;
}

/**
 * Resolve the Google User ID (unique Google account `sub` claim) from the authenticated Better Auth userId.
 */
export async function resolveGoogleUserIdentity(userId: string): Promise<GoogleUserIdentity> {
  const sql = await getSql();

  // Check account table for Google OAuth account (direct Google or Grok-brokered Google)
  const accountRows = await sql<{ accountId: string; providerId: string }>`
    select "accountId", "providerId"
    from "account"
    where "userId" = ${userId} and "providerId" in ('google', 'grok-google')
    limit 1
  `;

  // Fetch user profile info
  const userRows = await sql<{ email: string; name: string; image: string | null }>`
    select "email", "name", "image"
    from "user"
    where "id" = ${userId}
    limit 1
  `;

  const user = userRows[0];
  const email = user?.email ?? null;
  const name = user?.name ?? null;
  const picture = user?.image ?? null;

  if (accountRows[0]?.accountId) {
    return {
      googleUserId: accountRows[0].accountId,
      userId,
      email,
      name,
      picture,
    };
  }

  // If user signed in through email or other fallback, use user id as unique isolation key
  return {
    googleUserId: `account_${userId}`,
    userId,
    email,
    name,
    picture,
  };
}

/**
 * Load desk state from the user's completely isolated Google account database and storage.
 */
export async function loadUserDatabase(userId: string): Promise<DeskData> {
  const identity = await resolveGoogleUserIdentity(userId);
  const { googleUserId } = identity;
  const sql = await getSql();

  // Query the isolated google_user_databases table
  const rows = await sql<{
    trade_history: unknown;
    map_data: unknown;
    screenshots: unknown;
    desk_state: unknown;
  }>`
    select trade_history, map_data, screenshots, desk_state
    from google_user_databases
    where google_user_id = ${googleUserId}
    limit 1
  `;

  if (rows[0] && rows[0].desk_state && typeof rows[0].desk_state === "object") {
    const rawDeskState = rows[0].desk_state as Partial<DeskData>;
    const rawTradeHistory = (rows[0].trade_history ?? {}) as Partial<PartitionedTradeHistory> | Trade[];
    const rawMapData = (rows[0].map_data ?? {}) as Partial<PartitionedMapData> | LiquidityLevel[];

    const trades = Array.isArray((rawTradeHistory as any).trades)
      ? (rawTradeHistory as any).trades
      : Array.isArray(rawTradeHistory)
        ? rawTradeHistory
        : Array.isArray(rawDeskState.trades)
          ? rawDeskState.trades
          : [];

    const missed = Array.isArray((rawTradeHistory as any).missed)
      ? (rawTradeHistory as any).missed
      : Array.isArray(rawDeskState.missed)
        ? rawDeskState.missed
        : [];

    const liquidity = Array.isArray((rawMapData as any).liquidity)
      ? (rawMapData as any).liquidity
      : Array.isArray(rawMapData)
        ? rawMapData
        : Array.isArray(rawDeskState.liquidity)
          ? rawDeskState.liquidity
          : [];

    const dailyPlans =
      rawMapData && typeof (rawMapData as any).dailyPlans === "object"
        ? (rawMapData as any).dailyPlans
        : rawDeskState.dailyPlans && typeof rawDeskState.dailyPlans === "object"
          ? rawDeskState.dailyPlans
          : {};

    const weeklies = Array.isArray((rawMapData as any).weeklies)
      ? (rawMapData as any).weeklies
      : Array.isArray(rawDeskState.weeklies)
        ? rawDeskState.weeklies
        : [];

    // Reconstruct full desk data with guaranteed isolation
    const reconstructed: DeskData = {
      ...createResetState(),
      ...rawDeskState,
      trades,
      missed,
      liquidity,
      dailyPlans,
      weeklies,
    };

    return ensureMinimumDeskData(reconstructed);
  }

  // Fallback: check filesystem storage if database row was not found yet
  const userDir = ensureUserStorageDirectory(googleUserId);
  const deskStateFile = join(userDir, "desk-state.json");
  const tradesFile = join(userDir, "trades.json");
  const mapDataFile = join(userDir, "map-data.json");

  if (existsSync(deskStateFile)) {
    try {
      const content = readFileSync(deskStateFile, "utf-8");
      const parsed = JSON.parse(content);
      const normalized = ensureMinimumDeskData(parsed);
      // Synchronize back to database
      await saveUserDatabase(userId, normalized);
      return normalized;
    } catch (e) {
      console.warn("[user-database] fallback file parse warning:", e);
    }
  } else if (existsSync(tradesFile) || existsSync(mapDataFile)) {
    try {
      let parsedTrades: Trade[] = [];
      let parsedMissed: MissedTrade[] = [];
      let parsedLiquidity: LiquidityLevel[] = [];
      let parsedPlans: Record<string, DailyPlan> = {};
      let parsedWeeklies: WeeklyNarrative[] = [];

      if (existsSync(tradesFile)) {
        const rawT = JSON.parse(readFileSync(tradesFile, "utf-8"));
        if (Array.isArray(rawT)) parsedTrades = rawT;
        else if (rawT && typeof rawT === "object") {
          parsedTrades = Array.isArray(rawT.trades) ? rawT.trades : [];
          parsedMissed = Array.isArray(rawT.missed) ? rawT.missed : [];
        }
      }
      if (existsSync(mapDataFile)) {
        const rawM = JSON.parse(readFileSync(mapDataFile, "utf-8"));
        if (Array.isArray(rawM)) parsedLiquidity = rawM;
        else if (rawM && typeof rawM === "object") {
          parsedLiquidity = Array.isArray(rawM.liquidity) ? rawM.liquidity : [];
          parsedPlans = rawM.dailyPlans && typeof rawM.dailyPlans === "object" ? rawM.dailyPlans : {};
          parsedWeeklies = Array.isArray(rawM.weeklies) ? rawM.weeklies : [];
        }
      }

      const reconstructed: DeskData = {
        ...createResetState(),
        trades: parsedTrades,
        missed: parsedMissed,
        liquidity: parsedLiquidity,
        dailyPlans: parsedPlans,
        weeklies: parsedWeeklies,
      };
      const normalized = ensureMinimumDeskData(reconstructed);
      await saveUserDatabase(userId, normalized);
      return normalized;
    } catch (fsFallbackErr) {
      console.warn("[user-database] filesystem fallback reconstruction warning:", fsFallbackErr);
    }
  }

  // First time login for this Google account: Automatically initialize isolated database & storage!
  const initialState = ensureMinimumDeskData(createResetState());
  await saveUserDatabase(userId, initialState);
  return initialState;
}

/**
 * Save desk state into the user's isolated Google account database and filesystem storage.
 */
export async function saveUserDatabase(userId: string, data: DeskData): Promise<void> {
  const identity = await resolveGoogleUserIdentity(userId);
  const { googleUserId, email, name, picture } = identity;
  const sql = await getSql();

  // Partition the data for granular isolation
  const tradeHistory: PartitionedTradeHistory = {
    trades: data.trades ?? [],
    missed: data.missed ?? [],
  };

  const mapData: PartitionedMapData = {
    liquidity: data.liquidity ?? [],
    dailyPlans: data.dailyPlans ?? {},
    weeklies: data.weeklies ?? [],
  };

  const screenshots: PartitionedScreenshots = {
    tradeScreenshots: (data.trades ?? [])
      .filter((t) => Boolean(t.screenshotHtf || t.screenshotExec))
      .map((t) => ({
        tradeId: t.id,
        screenshotHtf: t.screenshotHtf ?? "",
        screenshotExec: t.screenshotExec ?? "",
      })),
  };

  // Base desk state without huge arrays for streamlined indexing
  const deskState: Partial<DeskData> = {
    hasBootstrapped: data.hasBootstrapped,
    accountName: data.accountName,
    phaseId: data.phaseId,
    phases: data.phases,
    rules: data.rules,
    mantra: data.mantra,
    themeId: data.themeId,
    accentColor: data.accentColor,
    instruments: data.instruments,
    models: data.models,
    recentlyDeletedModels: data.recentlyDeletedModels ?? [],
    checklistItems: data.checklistItems,
    checks: data.checks,
    protocolDays: data.protocolDays,
    newsEvents: data.newsEvents,
    forceClosedDates: data.forceClosedDates,
    forceOpenDates: data.forceOpenDates,
  };

  const tradeHistoryJson = JSON.stringify(tradeHistory);
  const mapDataJson = JSON.stringify(mapData);
  const screenshotsJson = JSON.stringify(screenshots);
  const deskStateJson = JSON.stringify(data); // Complete state for fast restore

  // 1. Atomically persist to isolated google_user_databases SQL table
  await sql`
    insert into google_user_databases (
      google_user_id,
      user_id,
      email,
      name,
      picture,
      trade_history,
      map_data,
      screenshots,
      desk_state,
      updated_at
    )
    values (
      ${googleUserId},
      ${userId},
      ${email},
      ${name},
      ${picture},
      ${tradeHistoryJson}::jsonb,
      ${mapDataJson}::jsonb,
      ${screenshotsJson}::jsonb,
      ${deskStateJson}::jsonb,
      now()
    )
    on conflict (google_user_id)
    do update set
      user_id = excluded.user_id,
      email = excluded.email,
      name = excluded.name,
      picture = excluded.picture,
      trade_history = excluded.trade_history,
      map_data = excluded.map_data,
      screenshots = excluded.screenshots,
      desk_state = excluded.desk_state,
      updated_at = now()
  `;

  // 2. Synchronize to user_desk_state for backward compatibility
  await sql`
    insert into user_desk_state (user_id, state, updated_at)
    values (${userId}, ${deskStateJson}::jsonb, now())
    on conflict (user_id)
    do update set state = excluded.state, updated_at = now()
  `;

  // 3. Atomically persist to the user's isolated filesystem directory
  try {
    const userDir = ensureUserStorageDirectory(googleUserId);
    writeFileSync(join(userDir, "manifest.json"), JSON.stringify(identity, null, 2), "utf-8");
    writeFileSync(join(userDir, "trades.json"), tradeHistoryJson, "utf-8");
    writeFileSync(join(userDir, "map-data.json"), mapDataJson, "utf-8");
    writeFileSync(join(userDir, "screenshots.json"), screenshotsJson, "utf-8");
    writeFileSync(join(userDir, "desk-state.json"), deskStateJson, "utf-8");

    // Also persist decoded screenshot image files in user's screenshots/ directory
    saveScreenshotFiles(userDir, screenshots);
  } catch (fsErr) {
    console.warn("[user-database] filesystem storage notice:", fsErr);
  }
}

/**
 * Write binary screenshot images into the user's isolated screenshots directory.
 */
function saveScreenshotFiles(userDir: string, screenshots: PartitionedScreenshots): void {
  const screenshotsDir = join(userDir, "screenshots");
  if (!existsSync(screenshotsDir)) {
    mkdirSync(screenshotsDir, { recursive: true });
  }

  for (const item of screenshots.tradeScreenshots) {
    const safeTradeId = sanitizeFolderId(item.tradeId);
    if (item.screenshotHtf && item.screenshotHtf.startsWith("data:image/")) {
      try {
        const matches = item.screenshotHtf.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
          const buffer = Buffer.from(matches[2], "base64");
          writeFileSync(join(screenshotsDir, `${safeTradeId}_htf.${ext}`), buffer);
        }
      } catch (err) {
        console.warn("[user-database] failed to write htf screenshot file:", err);
      }
    }
    if (item.screenshotExec && item.screenshotExec.startsWith("data:image/")) {
      try {
        const matches = item.screenshotExec.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
          const buffer = Buffer.from(matches[2], "base64");
          writeFileSync(join(screenshotsDir, `${safeTradeId}_exec.${ext}`), buffer);
        }
      } catch (err) {
        console.warn("[user-database] failed to write exec screenshot file:", err);
      }
    }
  }
}

/**
 * Load isolated notebook data (folders and notes) for a specific user.
 */
export async function loadUserNotebook(
  userId: string,
): Promise<{ folders: string[]; notes: NotebookEntry[] }> {
  const identity = await resolveGoogleUserIdentity(userId);
  const { googleUserId } = identity;
  const sql = await getSql();

  // 1. Check user_notebook_state table
  try {
    const nbRows = await sql<{ folders: unknown; notes: unknown }>`
      select folders, notes
      from user_notebook_state
      where user_id = ${userId}
      limit 1
    `;
    if (nbRows[0] && Array.isArray(nbRows[0].notes)) {
      return {
        folders:
          Array.isArray(nbRows[0].folders) && nbRows[0].folders.length > 0
            ? (nbRows[0].folders as string[])
            : [...DEFAULT_FOLDERS],
        notes: nbRows[0].notes as NotebookEntry[],
      };
    }
  } catch (err) {
    console.warn("[user-database] user_notebook_state query warning:", err);
  }

  // 2. Check google_user_databases table
  try {
    const rows = await sql<{ notebook_state: unknown }>`
      select notebook_state
      from google_user_databases
      where google_user_id = ${googleUserId}
      limit 1
    `;
    if (rows[0]?.notebook_state && typeof rows[0].notebook_state === "object") {
      const nb = rows[0].notebook_state as { folders?: string[]; notes?: NotebookEntry[]; initialized?: boolean };
      // Only treat as valid user state if explicitly initialized or has notes
      if (nb.initialized === true || (Array.isArray(nb.notes) && nb.notes.length > 0)) {
        return {
          folders: Array.isArray(nb.folders) && nb.folders.length > 0 ? nb.folders : [...DEFAULT_FOLDERS],
          notes: Array.isArray(nb.notes) ? nb.notes : [],
        };
      }
    }
  } catch (err) {
    console.warn("[user-database] google_user_databases notebook query warning:", err);
  }

  // 3. Fallback: check filesystem storage
  const userDir = ensureUserStorageDirectory(googleUserId);
  const notebookFile = join(userDir, "notebook.json");
  if (existsSync(notebookFile)) {
    try {
      const content = readFileSync(notebookFile, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.notes)) {
        const result = {
          folders: Array.isArray(parsed.folders) && parsed.folders.length > 0 ? parsed.folders : [...DEFAULT_FOLDERS],
          notes: parsed.notes as NotebookEntry[],
        };
        await saveUserNotebook(userId, result);
        return result;
      }
    } catch (fsErr) {
      console.warn("[user-database] filesystem notebook parse warning:", fsErr);
    }
  }

  // 4. First time initialization for this account
  const initial = {
    folders: [...DEFAULT_FOLDERS],
    notes: SEED_NOTES,
  };
  await saveUserNotebook(userId, initial);
  return initial;
}

/**
 * Save isolated notebook data (folders and notes) for a specific user to both SQL database and filesystem storage.
 */
export async function saveUserNotebook(
  userId: string,
  data: { folders: string[]; notes: NotebookEntry[] },
): Promise<void> {
  const identity = await resolveGoogleUserIdentity(userId);
  const { googleUserId, email, name, picture } = identity;
  const sql = await getSql();

  const cleanFolders =
    Array.isArray(data.folders) && data.folders.length > 0 ? data.folders : [...DEFAULT_FOLDERS];
  const cleanNotes = Array.isArray(data.notes) ? data.notes : [];
  const payload = { folders: cleanFolders, notes: cleanNotes, initialized: true };
  const jsonStr = JSON.stringify(payload);

  // 1. Atomically upsert to user_notebook_state
  try {
    await sql`
      insert into user_notebook_state (user_id, folders, notes, updated_at)
      values (${userId}, ${JSON.stringify(cleanFolders)}::jsonb, ${JSON.stringify(cleanNotes)}::jsonb, now())
      on conflict (user_id)
      do update set
        folders = excluded.folders,
        notes = excluded.notes,
        updated_at = now()
    `;
  } catch (err) {
    console.warn("[user-database] failed to update user_notebook_state:", err);
  }

  // 2. Upsert to google_user_databases table notebook_state
  try {
    await sql`
      insert into google_user_databases (
        google_user_id,
        user_id,
        email,
        name,
        picture,
        trade_history,
        map_data,
        screenshots,
        desk_state,
        notebook_state,
        updated_at
      )
      values (
        ${googleUserId},
        ${userId},
        ${email},
        ${name},
        ${picture},
        '[]'::jsonb,
        '{}'::jsonb,
        '{}'::jsonb,
        '{}'::jsonb,
        ${jsonStr}::jsonb,
        now()
      )
      on conflict (google_user_id)
      do update set
        notebook_state = excluded.notebook_state,
        updated_at = now()
    `;
  } catch (err) {
    console.warn("[user-database] failed to update google_user_databases notebook_state:", err);
  }

  // 3. Atomically persist to filesystem storage/users/<googleUserId>/notebook.json
  try {
    const userDir = ensureUserStorageDirectory(googleUserId);
    writeFileSync(join(userDir, "notebook.json"), jsonStr, "utf-8");
  } catch (fsErr) {
    console.warn("[user-database] failed to write notebook.json file:", fsErr);
  }
}
