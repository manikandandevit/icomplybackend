import { AppError } from "../../core/errors/AppError.js";
import { minutesOfDayIn, utcOffsetMinutesFor } from "../../core/utils/timezone.js";

/** Check-in opens this many minutes before the shift starts. */
export const CHECK_IN_EARLY_MINUTES = 10;

/** Check-in up to this many minutes after shift start is not late. */
export const CHECK_IN_GRACE_MINUTES = 10;

/** Check-out up to this many minutes after shift end is not OT.
 *  Past it, OT counts from the shift end (7:15 out on a 6:30 shift → 45 min). */
export const OT_THRESHOLD_MINUTES = 10;

const DAY = 24 * 60;
const mod = (n) => ((n % DAY) + DAY) % DAY;

/** "09:30", "9:30 AM", "18:30:00" → minutes of the day (null if not a time). */
const minutesOf = (value) => {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return null;
  let h = Number(match[1]);
  const m = Number(match[2]);
  const ampm = (match[3] || "").toUpperCase();
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
};

const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** 560 → "9:20 AM" */
const label = (min) => {
  const h = Math.floor(min / 60);
  const m = String(min % 60).padStart(2, "0");
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${suffix}`;
};

/** Minutes of the day in target timezone (default Asia/Kolkata). */
export const nowMinutesIST = (now = new Date(), zone = "Asia/Kolkata") => {
  return minutesOfDayIn(zone, now);
};

/**
 * When the employee may check in today:
 * from (shift start − 10 min) until shift end. Late check-in is allowed until
 * the shift ends (it is flagged as lateCheckIn). Night shifts that cross
 * midnight are handled. No shift → no restriction.
 */
export const punchWindowFor = (shift, now = new Date(), zone = "Asia/Kolkata") => {
  const start = minutesOf(shift?.shift_start_time);
  const end = minutesOf(shift?.shift_end_time);
  const base = {
    earlyMinutes: CHECK_IN_EARLY_MINUTES,
    graceMinutes: CHECK_IN_GRACE_MINUTES,
    otThresholdMinutes: OT_THRESHOLD_MINUTES,
    serverTime: now.toISOString(),
    timeZone: zone,
    utcOffsetMinutes: utcOffsetMinutesFor(zone, now),
  };

  if (start == null || end == null) {
    return { ...base, hasShift: false, isOpen: true, state: "open" };
  }

  const opens = mod(start - CHECK_IN_EARLY_MINUTES);
  const span = (end <= start ? end + DAY : end) - (start - CHECK_IN_EARLY_MINUTES);
  const nowMin = minutesOfDayIn(zone, now);
  const sinceOpen = mod(nowMin - opens);
  const isOpen = span >= DAY || sinceOpen <= span;

  // Not open: closer to the last shift end → "closed", else waiting → "early".
  const afterEnd = mod(nowMin - end);
  const untilOpen = mod(opens - nowMin);
  const state = isOpen ? "open" : afterEnd < untilOpen ? "closed" : "early";

  return {
    ...base,
    hasShift: true,
    isOpen,
    state,
    shiftStartTime: hhmm(start),
    shiftStartLabel: label(start),
    shiftEndTime: hhmm(end),
    graceEndsAt: hhmm(mod(start + CHECK_IN_GRACE_MINUTES)),
    graceEndsAtLabel: label(mod(start + CHECK_IN_GRACE_MINUTES)),
    opensAt: hhmm(opens),
    opensAtLabel: label(opens),
    closesAt: hhmm(end),
    closesAtLabel: label(end),
  };
};

/** Throws a 422 with a clear message when check-in is not allowed right now. */
export const assertCheckInOpen = (window) => {
  if (!window || window.isOpen) return;
  if (window.state === "early") {
    throw new AppError(`Check in opens at ${window.opensAtLabel}`, 422, "CHECK_IN_TOO_EARLY");
  }
  throw new AppError(
    `Your shift ended at ${window.closesAtLabel}. Apply regularization for today.`,
    422,
    "CHECK_IN_CLOSED",
  );
};
