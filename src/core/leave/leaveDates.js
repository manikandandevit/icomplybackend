import {
  addDaysIso,
  isWorkingDay,
  normalizeSession,
  parseIsoDate,
  SESSION_FIRST_HALF,
  SESSION_FULL,
  SESSION_SECOND_HALF,
} from "./workingDays.js";

/**
 * Leave "day lines": one leave request can hold separate dates, each with its
 * own session (full / first-half / second-half). Stored as JSON on the request:
 *   [{ "date": "2026-11-03", "session": "full" }, { "date": "2026-11-05", "session": "first-half" }]
 * Requests without day lines keep the old start_date–end_date range behaviour.
 */

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

export const sessionUnits = (session) => (normalizeSession(session) === SESSION_FULL ? 1 : 0.5);

/** Halves taken by a session: full → both, first-half → first, second-half → second. */
const halvesOf = (session) => {
  const kind = normalizeSession(session);
  if (kind === SESSION_FIRST_HALF) return ["first"];
  if (kind === SESSION_SECOND_HALF) return ["second"];
  return ["first", "second"];
};

const sessionFromHalves = (halves) => {
  if (halves.has("first") && halves.has("second")) return SESSION_FULL;
  if (halves.has("first")) return SESSION_FIRST_HALF;
  if (halves.has("second")) return SESSION_SECOND_HALF;
  return null;
};

/**
 * Validates and normalises a dates list from a request body.
 * Returns { dates, error } — dates sorted by date, one entry per date.
 */
export const normalizeLeaveDates = (input) => {
  if (!Array.isArray(input) || input.length === 0) return { dates: [], error: "" };
  const seen = new Set();
  const dates = [];
  for (const item of input) {
    const date = String(item?.date || "").trim();
    if (!isIsoDate(date) || !parseIsoDate(date)) return { dates: [], error: "Leave date is invalid" };
    if (seen.has(date)) return { dates: [], error: `${date} is selected more than once` };
    seen.add(date);
    dates.push({ date, session: normalizeSession(item?.session) });
  }
  dates.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const year = dates[0].date.slice(0, 4);
  if (dates.some((item) => item.date.slice(0, 4) !== year)) {
    return { dates: [], error: "Leave dates must be in the same year" };
  }
  return { dates, error: "" };
};

/** Reads stored day lines (JSONB) safely. */
export const leaveDatesOf = (request) => {
  const raw = request?.leaveDates ?? request?.leave_dates;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && isIsoDate(item.date))
    .map((item) => ({ date: String(item.date), session: normalizeSession(item.session) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
};

export const totalUnits = (dates) => dates.reduce((sum, item) => sum + sessionUnits(item.session), 0);

/**
 * Date → Set of halves a request occupies.
 * Day-line requests use their dates; range requests cover every date in the range.
 */
export const slotsOf = (request) => {
  const map = new Map();
  const add = (date, session) => {
    const set = map.get(date) || new Set();
    for (const half of halvesOf(session)) set.add(half);
    map.set(date, set);
  };
  const lines = leaveDatesOf(request);
  if (lines.length) {
    for (const item of lines) add(item.date, item.session);
    return map;
  }
  if (!request?.startDate || !request?.endDate) return map;
  for (let d = request.startDate; d && d <= request.endDate; d = addDaysIso(d, 1)) add(d, request.session);
  return map;
};

/** First date both slot maps share (same half), or null. */
export const firstOverlap = (left, right) => {
  for (const [date, halves] of left) {
    const other = right.get(date);
    if (!other) continue;
    for (const half of halves) if (other.has(half)) return date;
  }
  return null;
};

/** Day lines left after taking `revokeSlots` out of `dates`. */
export const subtractSlots = (dates, revokeSlots) => {
  const result = [];
  for (const item of dates) {
    const halves = new Set(halvesOf(item.session));
    for (const half of revokeSlots.get(item.date) || []) halves.delete(half);
    const session = sessionFromHalves(halves);
    if (session) result.push({ date: item.date, session });
  }
  return result;
};

/** True when every slot in `inner` is part of `outer`. */
export const isSubset = (inner, outer) => {
  for (const [date, halves] of inner) {
    const other = outer.get(date);
    if (!other) return false;
    for (const half of halves) if (!other.has(half)) return false;
  }
  return true;
};

/**
 * Sandwich rule for day lines: week offs / holidays that sit between two
 * picked full days (with nothing else in between) are charged as leave.
 */
export const bridgedOffDays = (dates, calendar = {}) => {
  const result = [];
  for (let i = 1; i < dates.length; i += 1) {
    const prev = dates[i - 1];
    const next = dates[i];
    if (normalizeSession(prev.session) !== SESSION_FULL || normalizeSession(next.session) !== SESSION_FULL) continue;
    const gap = [];
    let onlyOffDays = true;
    for (let d = addDaysIso(prev.date, 1); d && d < next.date; d = addDaysIso(d, 1)) {
      if (isWorkingDay(d, calendar)) {
        onlyOffDays = false;
        break;
      }
      gap.push(d);
    }
    if (onlyOffDays) result.push(...gap);
  }
  return result;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (iso) => {
  const d = parseIsoDate(iso);
  return d ? `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : iso;
};
const sessionShort = (session) => {
  const kind = normalizeSession(session);
  if (kind === SESSION_FIRST_HALF) return "First half";
  if (kind === SESSION_SECOND_HALF) return "Second half";
  return "Full day";
};

/** "03 Nov 2026 (Full day), 05 Nov 2026 (First half)" — or null for range requests. */
export const formatLeaveDates = (request) => {
  const lines = leaveDatesOf(request);
  if (!lines.length) return null;
  return lines.map((item) => `${shortDate(item.date)} (${sessionShort(item.session)})`).join(", ");
};
