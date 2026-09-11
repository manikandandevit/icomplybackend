const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const toIsoDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const parseIsoDate = (value) => {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const addDaysIso = (iso, days) => {
  const date = parseIsoDate(iso);
  if (!date) return "";
  date.setDate(date.getDate() + Number(days || 0));
  return toIsoDate(date);
};

const isAllCountry = (value) => {
  const next = String(value ?? "").trim().toLowerCase();
  return !next || next === "all";
};

export const holidayAppliesToCountry = (holiday, countryId) => {
  if (isAllCountry(holiday?.countryId)) return true;
  if (!countryId) return false;
  return String(holiday.countryId) === String(countryId);
};

export const expandHolidayDates = (holidays = [], countryId = "") => {
  const dates = new Set();
  for (const holiday of holidays) {
    if (!holidayAppliesToCountry(holiday, countryId)) continue;
    const start = parseIsoDate(holiday.startDate || holiday.date);
    const end = parseIsoDate(holiday.endDate || holiday.startDate || holiday.date) || start;
    if (!start || !end || end < start) continue;
    const cursor = new Date(start);
    while (cursor <= end) {
      dates.add(toIsoDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return dates;
};

export const expandHolidayMap = (holidays = [], countryId = "") => {
  const map = new Map();
  for (const holiday of holidays) {
    if (!holidayAppliesToCountry(holiday, countryId)) continue;
    const start = parseIsoDate(holiday.startDate || holiday.date);
    const end = parseIsoDate(holiday.endDate || holiday.startDate || holiday.date) || start;
    if (!start || !end || end < start) continue;
    const cursor = new Date(start);
    const title = holiday.title || holiday.name || holiday.values?.name || "Company Holiday";
    while (cursor <= end) {
      map.set(toIsoDate(cursor), title);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return map;
};

export const isWorkingDay = (iso, calendar = {}) => {
  const date = parseIsoDate(iso);
  if (!date) return false;
  const off = String(calendar.weekOffDay || "Sunday").trim().toLowerCase();
  if (WEEKDAY_NAMES[date.getDay()].toLowerCase() === off) return false;
  const holidays = calendar.holidayDates instanceof Set ? calendar.holidayDates : new Set(calendar.holidayDates || []);
  return !holidays.has(toIsoDate(date));
};

export const countCalendarDays = (startDate, endDate) => {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end || end < start) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
};

export const countWorkingDays = (startDate, endDate, calendar = {}) => {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end || end < start) return 0;
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    if (isWorkingDay(toIsoDate(cursor), calendar)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
};

export const endDateForWorkingDays = (startDate, workingCount, calendar = {}) => {
  const start = parseIsoDate(startDate);
  const need = Number(workingCount) || 0;
  if (!start || need <= 0) return String(startDate || "").slice(0, 10);
  let seen = 0;
  const cursor = new Date(start);
  for (let i = 0; i < 800; i += 1) {
    if (isWorkingDay(toIsoDate(cursor), calendar)) {
      seen += 1;
      if (seen >= need) return toIsoDate(cursor);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return toIsoDate(cursor);
};

export const SESSION_FULL = "full";
export const SESSION_FIRST_HALF = "first-half";
export const SESSION_SECOND_HALF = "second-half";

export const normalizeSession = (value) => {
  const raw = String(value || "full").trim().toLowerCase();
  if (raw === "first-half" || raw === "first") return SESSION_FIRST_HALF;
  if (raw === "second-half" || raw === "second") return SESSION_SECOND_HALF;
  return SESSION_FULL;
};

export const sessionLabel = (value) => {
  const session = normalizeSession(value);
  if (session === SESSION_FIRST_HALF) return "First half";
  if (session === SESSION_SECOND_HALF) return "Second half";
  return "Full day";
};

export const sessionsOverlap = (left, right) => {
  const a = normalizeSession(left);
  const b = normalizeSession(right);
  return a === SESSION_FULL || b === SESSION_FULL || a === b;
};

export const otherHalf = (value) => {
  const session = normalizeSession(value);
  if (session === SESSION_FIRST_HALF) return SESSION_SECOND_HALF;
  if (session === SESSION_SECOND_HALF) return SESSION_FIRST_HALF;
  return null;
};

export const countSessionDays = (startDate, endDate, session, calendar = {}) => {
  const kind = normalizeSession(session);
  if (kind !== SESSION_FULL) {
    if (String(startDate) !== String(endDate)) return 0;
    return isWorkingDay(startDate, calendar) ? 0.5 : 0;
  }
  return countWorkingDays(startDate, endDate, calendar);
};

export const remainingLeaveSlices = (leave, revoke, calendar = {}) => {
  const leaveSession = normalizeSession(leave?.session);
  const revokeSession = normalizeSession(revoke?.session);
  const leaveStart = String(leave?.startDate || "");
  const leaveEnd = String(leave?.endDate || "");
  const revokeStart = String(revoke?.startDate || "");
  const revokeEnd = String(revoke?.endDate || "");
  const slices = [];

  const push = (startDate, endDate, session) => {
    const days = countSessionDays(startDate, endDate, session, calendar);
    if (days > 0) slices.push({ startDate, endDate, session, days });
  };

  if (revokeSession !== SESSION_FULL && revokeStart && revokeStart === revokeEnd) {
    if (revokeStart < leaveStart || revokeStart > leaveEnd) return slices;
    if (leaveSession !== SESSION_FULL && leaveSession !== revokeSession) return slices;
    if (leaveSession !== SESSION_FULL) return slices;
    if (revokeStart > leaveStart) push(leaveStart, addDaysIso(revokeStart, -1), SESSION_FULL);
    const remain = otherHalf(revokeSession);
    if (remain) push(revokeStart, revokeStart, remain);
    if (revokeStart < leaveEnd) push(addDaysIso(revokeStart, 1), leaveEnd, SESSION_FULL);
    return slices;
  }

  if (revokeStart > leaveStart) {
    push(leaveStart, addDaysIso(revokeStart, -1), leaveSession);
  }
  if (revokeEnd < leaveEnd) {
    push(addDaysIso(revokeEnd, 1), leaveEnd, leaveSession);
  }
  return slices;
};

export const countLeaveDays = (startDate, endDate, calendar, session) =>
  session
    ? countSessionDays(startDate, endDate, session, calendar)
    : calendar
      ? countWorkingDays(startDate, endDate, calendar)
      : countCalendarDays(startDate, endDate);

