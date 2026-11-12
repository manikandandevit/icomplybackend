import { 
  zoneForCountry, 
  todayIn, 
  minutesOfDayIn, 
  zonedDateTimeToUtc, 
  weekdayIn, 
  startOfDayUtc, 
  formatTimeInZone 
} from "../core/utils/timezone.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  } else {
    console.log("PASS:", message);
  }
}

console.log("=== Testing Timezone Helpers ===");

// 1. Country zone mapping
assert(zoneForCountry("1") === "Asia/Kolkata", "Country 1 is Asia/Kolkata");
assert(zoneForCountry("2") === "Asia/Singapore", "Country 2 is Asia/Singapore");
assert(zoneForCountry("3") === "Asia/Kuala_Lumpur", "Country 3 is Asia/Kuala_Lumpur");
assert(zoneForCountry("Singapore") === "Asia/Singapore", "Singapore string mapped");
assert(zoneForCountry("Malaysia") === "Asia/Kuala_Lumpur", "Malaysia string mapped");

// 2. zonedDateTimeToUtc:
// India 09:30 on 2026-11-13 is UTC 04:00
const inUtc = zonedDateTimeToUtc("2026-11-13", "09:30", "Asia/Kolkata");
assert(inUtc.toISOString() === "2026-11-13T04:00:00.000Z", "India 09:30 -> UTC 04:00");

// Singapore 09:30 on 2026-11-13 is UTC 01:30
const sgUtc = zonedDateTimeToUtc("2026-11-13", "09:30", "Asia/Singapore");
assert(sgUtc.toISOString() === "2026-11-13T01:30:00.000Z", "Singapore 09:30 -> UTC 01:30 (Acceptance Test 8)");

// Singapore 09:05 on 2026-11-13 is UTC 01:05
const myUtc = zonedDateTimeToUtc("2026-11-13", "09:05", "Asia/Kuala_Lumpur");
assert(myUtc.toISOString() === "2026-11-13T01:05:00.000Z", "Malaysia 09:05 -> UTC 01:05 (Acceptance Test 2)");

// 3. todayIn test:
// At 00:30 IST on 2026-11-13 (which is 19:00 UTC on 2026-11-12)
const dateAt0030Ist = new Date("2026-11-12T19:00:00.000Z");
assert(todayIn("Asia/Kolkata", dateAt0030Ist) === "2026-11-13", "India at 00:30 IST is 2026-11-13 (Acceptance Test 4)");

// 4. minutesOfDayIn:
assert(minutesOfDayIn("Asia/Kolkata", inUtc) === 9 * 60 + 30, "Minutes of 09:30 IST is 570");
assert(minutesOfDayIn("Asia/Singapore", sgUtc) === 9 * 60 + 30, "Minutes of 09:30 SGT is 570");

// 5. WeekdayIn test:
// 2026-11-15 is Sunday
assert(weekdayIn("Asia/Kolkata", "2026-11-15") === 0, "2026-11-15 is Sunday (0)");
// 2026-11-16 is Monday
assert(weekdayIn("Asia/Kolkata", "2026-11-16") === 1, "2026-11-16 is Monday (1)");

// 6. startOfDayUtc:
assert(startOfDayUtc("2026-11-13", "Asia/Kolkata").toISOString() === "2026-11-12T18:30:00.000Z", "India startOfDay UTC is 18:30 previous day");
assert(startOfDayUtc("2026-11-13", "Asia/Singapore").toISOString() === "2026-11-12T16:00:00.000Z", "Singapore startOfDay UTC is 16:00 previous day");

console.log("\nAll core timezone unit tests passed! 🎉");
