import {
  addDaysIso,
  countWorkingDays,
  isWorkingDay,
  normalizeSession,
  parseIsoDate,
  SESSION_FULL,
  toIsoDate,
} from "./workingDays.js";

/**
 * Checks if a date is sandwiched between leave days.
 * Returns {
 *   isSandwich: boolean,
 *   workingDays: number,
 *   sandwichDays: number,
 *   sandwichDates: string[],
 *   totalDays: number,
 *   paidDays: number,
 *   lopDays: number,
 *   deductions: Array<{ leaveTypeId: string, leaveTypeName: string, days: number }>,
 * }
 */
export const calculateSandwichLeave = ({
  startDate,
  endDate,
  session = SESSION_FULL,
  leaveType,
  calendar,
  existingLeaves = [],
  primaryBalance = 0,
  otherSandwichBalances = [],
}) => {
  const normSession = normalizeSession(session);
  const isSandwichEnabled =
    String(leaveType?.values?.sandwich || leaveType?.sandwich || "no").trim().toLowerCase() === "yes";

  const workingDays =
    normSession !== SESSION_FULL
      ? isWorkingDay(startDate, calendar) ? 0.5 : 0
      : countWorkingDays(startDate, endDate, calendar);

  // If sandwich is not enabled or it's a half-day session, standard working days apply
  if (!isSandwichEnabled || normSession !== SESSION_FULL) {
    const totalDays = workingDays;
    const paidDays = Math.min(primaryBalance, totalDays);
    const lopDays = Math.max(totalDays - paidDays, 0);
    return {
      isSandwich: false,
      workingDays,
      sandwichDays: 0,
      sandwichDates: [],
      totalDays,
      paidDays,
      lopDays,
      deductions: [
        {
          leaveTypeId: String(leaveType.id),
          leaveTypeName: leaveType.values?.name || leaveType.name || "Leave",
          days: paidDays,
        },
      ],
    };
  }

  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end || end < start) {
    return {
      isSandwich: false,
      workingDays: 0,
      sandwichDays: 0,
      sandwichDates: [],
      totalDays: 0,
      paidDays: 0,
      lopDays: 0,
      deductions: [],
    };
  }

  const sandwichDatesSet = new Set();

  // 1. Check intervening non-working days WITHIN the selected range
  const cursor = new Date(start);
  while (cursor <= end) {
    const iso = toIsoDate(cursor);
    if (!isWorkingDay(iso, calendar)) {
      // Check if there are working days before and after this non-working day within the range
      const hasWorkingBefore = countWorkingDays(startDate, addDaysIso(iso, -1), calendar) > 0;
      const hasWorkingAfter = countWorkingDays(addDaysIso(iso, 1), endDate, calendar) > 0;
      if (hasWorkingBefore && hasWorkingAfter) {
        sandwichDatesSet.add(iso);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  // 2. Check preceding non-working days (e.g. applying Monday, but took leave on Friday)
  const isExistingLeaveDate = (iso) =>
    existingLeaves.some(
      (l) =>
        (l.status === "Pending" || l.status === "Approved") &&
        l.startDate <= iso &&
        l.endDate >= iso
    );

  const precedingNonWorking = [];
  let prevCursor = new Date(start);
  prevCursor.setDate(prevCursor.getDate() - 1);
  for (let i = 0; i < 4; i++) {
    const iso = toIsoDate(prevCursor);
    if (!isWorkingDay(iso, calendar)) {
      precedingNonWorking.push(iso);
      prevCursor.setDate(prevCursor.getDate() - 1);
    } else {
      break;
    }
  }

  if (precedingNonWorking.length > 0) {
    const dayBeforeNonWorking = toIsoDate(prevCursor);
    if (isExistingLeaveDate(dayBeforeNonWorking)) {
      for (const iso of precedingNonWorking) {
        sandwichDatesSet.add(iso);
      }
    }
  }

  // 3. Check succeeding non-working days (e.g. applying Friday, but already took leave on Monday)
  const succeedingNonWorking = [];
  let nextCursor = new Date(end);
  nextCursor.setDate(nextCursor.getDate() + 1);
  for (let i = 0; i < 4; i++) {
    const iso = toIsoDate(nextCursor);
    if (!isWorkingDay(iso, calendar)) {
      succeedingNonWorking.push(iso);
      nextCursor.setDate(nextCursor.getDate() + 1);
    } else {
      break;
    }
  }

  if (succeedingNonWorking.length > 0) {
    const dayAfterNonWorking = toIsoDate(nextCursor);
    if (isExistingLeaveDate(dayAfterNonWorking)) {
      for (const iso of succeedingNonWorking) {
        sandwichDatesSet.add(iso);
      }
    }
  }

  const sandwichDates = Array.from(sandwichDatesSet).sort();
  const sandwichDays = sandwichDates.length;
  const isSandwich = sandwichDays > 0;
  const totalDays = workingDays + sandwichDays;

  // 4. Allocate balance & LOP
  let needed = totalDays;
  const deductions = [];

  // A. Primary Leave Type
  const primaryPaid = Math.min(Math.max(primaryBalance, 0), needed);
  if (primaryPaid > 0) {
    deductions.push({
      leaveTypeId: String(leaveType.id),
      leaveTypeName: leaveType.values?.name || leaveType.name || "Leave",
      days: primaryPaid,
    });
    needed -= primaryPaid;
  }

  // B. Other sandwich-enabled leave types
  if (needed > 0 && Array.isArray(otherSandwichBalances)) {
    for (const other of otherSandwichBalances) {
      if (String(other.leaveTypeId) === String(leaveType.id)) continue;
      const otherBal = Math.max(Number(other.remaining) || 0, 0);
      const cover = Math.min(otherBal, needed);
      if (cover > 0) {
        deductions.push({
          leaveTypeId: String(other.leaveTypeId),
          leaveTypeName: other.leaveTypeName || "Leave",
          days: cover,
        });
        needed -= cover;
        if (needed <= 0) break;
      }
    }
  }

  // C. Any remaining days become LOP (Loss of Pay)
  const lopDays = Math.max(needed, 0);
  const paidDays = totalDays - lopDays;

  return {
    isSandwich,
    workingDays,
    sandwichDays,
    sandwichDates,
    totalDays,
    paidDays,
    lopDays,
    deductions,
  };
};
