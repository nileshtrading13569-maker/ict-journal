import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  TRADING_TZ,
  IST_TZ,
  nowIST12,
  nyTimeToIST12,
  nowHHMM,
  todayISO,
  inWindow,
} from "./ict-time.ts";

describe("ICT Time & Dual Indian Time (IST) 12hr AM/PM Engine", () => {
  it("exports correct IANA time zones", () => {
    assert.equal(TRADING_TZ, "America/New_York");
    assert.equal(IST_TZ, "Asia/Kolkata");
  });

  it("nowIST12 formats time in 12-hour AM/PM format", () => {
    const formatted = nowIST12();
    // Expected format: HH:MM AM or HH:MM PM
    assert.match(
      formatted,
      /^(0[1-9]|1[0-2]):[0-5][0-9]\s(AM|PM)$/,
      `Expected 12hr AM/PM format, got: ${formatted}`
    );
  });

  it("converts Winter (EST, UTC-5) NY Kill Zones to IST accurately in 12hr AM/PM", () => {
    // Winter date: November 10, 2026 (EST, UTC-5)
    const winterDate = new Date("2026-11-10T12:00:00Z");

    // London Kill Zone: 02:00–05:00 NY -> 12:30 PM–03:30 PM IST (+10:30 offset)
    assert.equal(nyTimeToIST12(2, 0, winterDate), "12:30 PM");
    assert.equal(nyTimeToIST12(5, 0, winterDate), "03:30 PM");

    // NY AM Kill Zone: 07:00–10:00 NY -> 05:30 PM–08:30 PM IST
    assert.equal(nyTimeToIST12(7, 0, winterDate), "05:30 PM");
    assert.equal(nyTimeToIST12(10, 0, winterDate), "08:30 PM");

    // NY Continuation: 10:00–11:30 NY -> 08:30 PM–10:00 PM IST
    assert.equal(nyTimeToIST12(11, 30, winterDate), "10:00 PM");

    // NY PM Session: 13:30–16:00 NY -> 12:00 AM–02:30 AM IST
    assert.equal(nyTimeToIST12(13, 30, winterDate), "12:00 AM");
    assert.equal(nyTimeToIST12(16, 0, winterDate), "02:30 AM");

    // Asia Session: 19:00–00:00 NY -> 05:30 AM–10:30 AM IST
    assert.equal(nyTimeToIST12(19, 0, winterDate), "05:30 AM");
    assert.equal(nyTimeToIST12(0, 0, winterDate), "10:30 AM");
  });

  it("converts Summer (EDT, UTC-4) NY Kill Zones to IST accurately in 12hr AM/PM", () => {
    // Summer date: July 15, 2026 (EDT, UTC-4)
    const summerDate = new Date("2026-07-15T12:00:00Z");

    // London Kill Zone: 02:00–05:00 NY -> 11:30 AM–02:30 PM IST (+9:30 offset)
    assert.equal(nyTimeToIST12(2, 0, summerDate), "11:30 AM");
    assert.equal(nyTimeToIST12(5, 0, summerDate), "02:30 PM");

    // NY AM Kill Zone: 07:00–10:00 NY -> 04:30 PM–07:30 PM IST
    assert.equal(nyTimeToIST12(7, 0, summerDate), "04:30 PM");
    assert.equal(nyTimeToIST12(10, 0, summerDate), "07:30 PM");

    // NY Continuation: 10:00–11:30 NY -> 07:30 PM–09:00 PM IST
    assert.equal(nyTimeToIST12(11, 30, summerDate), "09:00 PM");

    // NY PM Session: 13:30–16:00 NY -> 11:00 PM–01:30 AM IST
    assert.equal(nyTimeToIST12(13, 30, summerDate), "11:00 PM");
    assert.equal(nyTimeToIST12(16, 0, summerDate), "01:30 AM");
  });

  it("verifies inWindow handles normal and overnight spans", () => {
    assert.equal(inWindow("02:00", "05:00", "03:30"), true);
    assert.equal(inWindow("02:00", "05:00", "01:30"), false);
    assert.equal(inWindow("19:00", "02:00", "23:00"), true);
    assert.equal(inWindow("19:00", "02:00", "01:00"), true);
    assert.equal(inWindow("19:00", "02:00", "15:00"), false);
  });
});

