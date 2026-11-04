import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateWeeklyProfileStats,
  computeWeekInfo,
  exportWeeklyProfilesToCSV,
  INITIAL_WEEKLY_PROFILES,
  registerProfileSyncHandler,
  useWeeklyProfileStore,
  type WeeklyProfileRecord,
} from "./weekly-profile-store.ts";

describe("Weekly Profile Tracker Calculations and State", () => {
  it("computes correct week and cycle metadata from date strings", () => {
    const oct26 = computeWeekInfo("2026-10-26");
    assert.equal(oct26.mondayISO, "2026-10-26");
    assert.equal(oct26.fridayISO, "2026-10-30");
    assert.equal(oct26.weekNumber, "W44");
    assert.equal(oct26.dateLabel, "Oct 26");
    assert.equal(oct26.monthWeekLabel, "Oct W4");
    assert.match(oct26.cycleLabel, /Oct W4 \(Oct 26 – Oct 30, 2026\)/);

    // If a Wednesday date is passed, it correctly snaps to Monday of that week
    const wednesdaySnap = computeWeekInfo("2026-10-28");
    assert.equal(wednesdaySnap.mondayISO, "2026-10-26");
    assert.equal(wednesdaySnap.fridayISO, "2026-10-30");

    // Fallback for empty or invalid date
    const fallback = computeWeekInfo("");
    assert.equal(fallback.mondayISO, "2026-10-26");
  });

  it("verifies initial seed dataset has 61 records with top 6 matching HTML mockup exactly", () => {
    assert.equal(INITIAL_WEEKLY_PROFILES.length, 61);

    const w44 = INITIAL_WEEKLY_PROFILES.find((r) => r.weekNumber === "W44");
    assert.ok(w44);
    assert.equal(w44.howDay, "Tuesday");
    assert.equal(w44.lowDay, "Thursday");
    assert.equal(w44.monType, "Ranging");
    assert.equal(w44.tueType, "Made HOW");
    assert.equal(w44.amd, true);

    const w43 = INITIAL_WEEKLY_PROFILES.find((r) => r.weekNumber === "W43");
    assert.ok(w43);
    assert.equal(w43.howDay, "Monday");
    assert.equal(w43.lowDay, "Wednesday");
    assert.equal(w43.monType, "Expansion");
    assert.equal(w43.tueType, "Made LOW");
    assert.equal(w43.amd, false);

    const w39 = INITIAL_WEEKLY_PROFILES.find((r) => r.weekNumber === "W39");
    assert.ok(w39);
    assert.equal(w39.howDay, "Thursday");
    assert.equal(w39.lowDay, "Monday");
    assert.equal(w39.tueType, "Equilibrium Tap");
    assert.equal(w39.amd, false);
  });

  it("calculates statistics baseline matching terminal mockup numbers", () => {
    const stats = calculateWeeklyProfileStats(INITIAL_WEEKLY_PROFILES);

    // Baseline: 61 tracked weekly profiles
    assert.equal(stats.totalWeeks, 61);
    // 42 of 61 weeks Tuesday HOW
    assert.equal(stats.howFormationCount, 42);
    assert.equal(stats.howFormationPct, 68.4);
    // 49 of 61 weeks Monday Accumulation
    assert.equal(stats.monAccumulationCount, 49);
    assert.equal(stats.monAccumulationPct, 81.2);
    // 38 of 61 weeks Midweek LOW
    assert.equal(stats.dominantLowCount, 38);
    assert.equal(stats.dominantLowPct, 62.3);
    assert.equal(stats.dominantHowDay, "Tuesday");
    assert.equal(stats.dominantLowDay, "Wed / Thu");
  });

  it("dynamically adjusts stats when new cycles are added, modified, or cleared", () => {
    const extraRecord: WeeklyProfileRecord = {
      id: "w45-test",
      weekNumber: "W45",
      dateLabel: "Nov 02",
      startDate: "2026-11-02",
      endDate: "2026-11-06",
      cycleLabel: "Nov W1 (Nov 02 – Nov 06, 2026)",
      howDay: "Tuesday",
      lowDay: "Thursday",
      monType: "Ranging",
      tueType: "Made HOW",
      amd: true,
      notes: "Test cycle",
      createdAt: new Date().toISOString(),
    };

    const statsAfterAdd = calculateWeeklyProfileStats([extraRecord, ...INITIAL_WEEKLY_PROFILES]);
    assert.equal(statsAfterAdd.totalWeeks, 62);
    assert.equal(statsAfterAdd.howFormationCount, 43);
    assert.equal(statsAfterAdd.monAccumulationCount, 50);
    assert.equal(statsAfterAdd.dominantLowCount, 39);

    // Gracefully handles empty array
    const emptyStats = calculateWeeklyProfileStats([]);
    assert.equal(emptyStats.totalWeeks, 0);
    assert.equal(emptyStats.howFormationCount, 0);
    assert.equal(emptyStats.howFormationPct, 0);
  });

  it("adds, updates, and deletes records in the store", () => {
    const store = useWeeklyProfileStore.getState();
    store.resetToDefaults();

    const initialLen = useWeeklyProfileStore.getState().records.length;
    assert.equal(initialLen, 61);

    const added = store.addRecord({
      startDate: "2026-11-02",
      endDate: "2026-11-06",
      weekNumber: "W45",
      dateLabel: "Nov 02",
      cycleLabel: "Nov W1 (Nov 02 – Nov 06, 2026)",
      howDay: "Tuesday",
      lowDay: "Friday",
      monType: "Ranging",
      tueType: "Made HOW",
      amd: true,
      notes: "Unit test record addition",
    });

    assert.equal(useWeeklyProfileStore.getState().records.length, initialLen + 1);
    assert.equal(useWeeklyProfileStore.getState().selectedWeekId, added.id);

    // Update
    store.updateRecord(added.id, { notes: "Updated note text" });
    const updated = useWeeklyProfileStore.getState().records.find((r) => r.id === added.id);
    assert.equal(updated?.notes, "Updated note text");

    // Delete
    store.deleteRecord(added.id);
    assert.equal(useWeeklyProfileStore.getState().records.length, initialLen);
  });

  it("handles CSV export safely in headless environment", () => {
    assert.doesNotThrow(() => {
      exportWeeklyProfilesToCSV(INITIAL_WEEKLY_PROFILES.slice(0, 5));
    });
  });

  it("dispatches profile sync events to registered handler", () => {
    const syncLog: Array<{ action: string; id: string }> = [];
    registerProfileSyncHandler((record, action) => {
      syncLog.push({ action, id: record.id });
    });

    const store = useWeeklyProfileStore.getState();
    const created = store.addRecord({
      startDate: "2026-11-09",
      endDate: "2026-11-13",
      weekNumber: "W46",
      dateLabel: "Nov 09",
      cycleLabel: "Nov W2 (Nov 09 – Nov 13, 2026)",
      howDay: "Tuesday",
      lowDay: "Thursday",
      monType: "Ranging",
      tueType: "Made HOW",
      amd: true,
      notes: "Sync test note",
    });

    assert.equal(syncLog.some((e) => e.action === "upsert" && e.id === created.id), true);

    store.deleteRecord(created.id);
    assert.equal(syncLog.some((e) => e.action === "delete" && e.id === created.id), true);

    registerProfileSyncHandler(null);
  });
});
