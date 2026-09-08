import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { carryForwardDays, prorateDays, yearEntitled } from "./entitlement.js";

describe("carry forward days", () => {
  it("is 0 when policy is No", () => {
    assert.equal(carryForwardDays(8, { carryForward: "no", carryForwardMax: 5 }), 0);
  });

  it("caps leftover at max when Yes", () => {
    assert.equal(carryForwardDays(5, { carryForward: "yes", carryForwardMax: 5 }), 5);
    assert.equal(carryForwardDays(8, { carryForward: "yes", carryForwardMax: 5 }), 5);
    assert.equal(carryForwardDays(3, { carryForward: "yes", carryForwardMax: 5 }), 3);
  });
});

describe("new year entitled", () => {
  it("lapses unused when carry is No", () => {
    assert.equal(
      yearEntitled({
        annualDays: 12,
        joinDate: "2024-01-10",
        year: 2026,
        carryForward: "no",
        usedByYear: { 2025: 7 },
      }),
      12,
    );
  });

  it("adds unused leftover when Yes and leftover <= max", () => {
    assert.equal(
      yearEntitled({
        annualDays: 12,
        joinDate: "2024-01-10",
        year: 2026,
        carryForward: "yes",
        carryForwardMax: 5,
        usedByYear: { 2025: 7 },
      }),
      17,
    );
  });

  it("caps carry at max when leftover is higher", () => {
    assert.equal(
      yearEntitled({
        annualDays: 12,
        joinDate: "2024-01-10",
        year: 2026,
        carryForward: "yes",
        carryForwardMax: 5,
        usedByYear: { 2025: 4 },
      }),
      17,
    );
  });

  it("does not carry in the join year", () => {
    assert.equal(
      yearEntitled({
        annualDays: 12,
        joinDate: "2026-04-01",
        year: 2026,
        carryForward: "yes",
        carryForwardMax: 5,
      }),
      prorateDays(12, "2026-04-01", 2026),
    );
  });
});
