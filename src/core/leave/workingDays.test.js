import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SESSION_FIRST_HALF,
  SESSION_FULL,
  SESSION_SECOND_HALF,
  countSessionDays,
  countWorkingDays,
  remainingLeaveSlices,
  sessionsOverlap,
} from "./workingDays.js";

const calendar = { weekOffDay: "Sunday", holidayDates: new Set(["2026-01-26"]) };

describe("working days", () => {
  it("skips week off", () => {
    assert.equal(countWorkingDays("2026-01-09", "2026-01-12", calendar), 3);
  });

  it("skips holidays", () => {
    assert.equal(countWorkingDays("2026-01-26", "2026-01-27", calendar), 1);
  });
});

describe("half day sessions", () => {
  it("counts 0.5 on a working day", () => {
    assert.equal(countSessionDays("2026-01-09", "2026-01-09", SESSION_FIRST_HALF, calendar), 0.5);
    assert.equal(countSessionDays("2026-01-09", "2026-01-09", SESSION_SECOND_HALF, calendar), 0.5);
  });

  it("rejects half day on week off or holiday", () => {
    assert.equal(countSessionDays("2026-01-11", "2026-01-11", SESSION_FIRST_HALF, calendar), 0);
    assert.equal(countSessionDays("2026-01-26", "2026-01-26", SESSION_SECOND_HALF, calendar), 0);
  });

  it("requires a single day for half sessions", () => {
    assert.equal(countSessionDays("2026-01-08", "2026-01-09", SESSION_FIRST_HALF, calendar), 0);
  });
});

describe("session overlap", () => {
  it("allows first and second half on the same day", () => {
    assert.equal(sessionsOverlap(SESSION_FIRST_HALF, SESSION_SECOND_HALF), false);
  });

  it("blocks full day against either half", () => {
    assert.equal(sessionsOverlap(SESSION_FULL, SESSION_FIRST_HALF), true);
    assert.equal(sessionsOverlap(SESSION_SECOND_HALF, SESSION_FULL), true);
  });
});

describe("remaining leave slices after revoke", () => {
  it("splits a full range around a full revoke", () => {
    const slices = remainingLeaveSlices(
      { startDate: "2026-01-07", endDate: "2026-01-09", session: SESSION_FULL },
      { startDate: "2026-01-08", endDate: "2026-01-08", session: SESSION_FULL },
      calendar,
    );
    assert.deepEqual(
      slices.map((item) => `${item.startDate}:${item.endDate}:${item.session}:${item.days}`),
      ["2026-01-07:2026-01-07:full:1", "2026-01-09:2026-01-09:full:1"],
    );
  });

  it("keeps the other half when revoking first half of a full day", () => {
    const slices = remainingLeaveSlices(
      { startDate: "2026-01-08", endDate: "2026-01-08", session: SESSION_FULL },
      { startDate: "2026-01-08", endDate: "2026-01-08", session: SESSION_FIRST_HALF },
      calendar,
    );
    assert.equal(slices.length, 1);
    assert.equal(slices[0].session, SESSION_SECOND_HALF);
    assert.equal(slices[0].days, 0.5);
  });

  it("splits prefix, other half, and suffix for a mid-range half revoke", () => {
    const slices = remainingLeaveSlices(
      { startDate: "2026-01-07", endDate: "2026-01-09", session: SESSION_FULL },
      { startDate: "2026-01-08", endDate: "2026-01-08", session: SESSION_FIRST_HALF },
      calendar,
    );
    assert.deepEqual(
      slices.map((item) => `${item.startDate}:${item.session}:${item.days}`),
      ["2026-01-07:full:1", "2026-01-08:second-half:0.5", "2026-01-09:full:1"],
    );
  });
});
