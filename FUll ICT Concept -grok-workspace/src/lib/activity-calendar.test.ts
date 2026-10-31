import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildActivityCalendar } from "./activity-calendar.ts";

describe("buildActivityCalendar", () => {
  it("builds Sunday-first weeks and combines only core checklist and trade activity by date", () => {
    const weeks = buildActivityCalendar({
      endDate: "2026-06-17",
      weeks: 2,
      coreChecklistIds: ["core-a", "core-b"],
      checks: {
        "2026-06-17": ["core-a", "core-a", "lifestyle"],
        "2026-06-16": ["core-b"],
      },
      trades: [
        { date: "2026-06-17", result: "win", rMultiple: 1.25 },
        { date: "2026-06-17", result: "loss", rMultiple: -0.25 },
        { date: "2026-06-16", result: "open", rMultiple: 99 },
      ],
    });

    assert.equal(weeks.length, 2);
    assert.deepEqual(weeks[0].map((day) => day.date), [
      "2026-06-07",
      "2026-06-08",
      "2026-06-09",
      "2026-06-10",
      "2026-06-11",
      "2026-06-12",
      "2026-06-13",
    ]);

    const yesterday = weeks.flat().find((day) => day.date === "2026-06-16");
    assert.deepEqual(
      {
        checked: yesterday?.checked,
        total: yesterday?.total,
        trades: yesterday?.trades,
        netR: yesterday?.netR,
        level: yesterday?.level,
      },
      { checked: 1, total: 2, trades: 1, netR: 0, level: 2 },
    );

    const today = weeks.flat().find((day) => day.date === "2026-06-17");
    assert.deepEqual(
      {
        checked: today?.checked,
        total: today?.total,
        trades: today?.trades,
        netR: today?.netR,
        level: today?.level,
      },
      { checked: 1, total: 2, trades: 2, netR: 1, level: 2 },
    );

    const future = weeks.flat().find((day) => day.date === "2026-06-18");
    assert.equal(future?.isFuture, true);
    assert.equal(future?.level, 0);
  });

  it("returns an empty activity level for days with no core checklist items or trades", () => {
    const weeks = buildActivityCalendar({
      endDate: "2026-06-17",
      weeks: 1,
      coreChecklistIds: [],
      checks: {},
      trades: [],
    });

    assert.equal(weeks.length, 1);
    assert.equal(weeks[0][3].total, 0);
    assert.equal(weeks[0][3].level, 0);
  });
});