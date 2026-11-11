import { prorateDays } from "../../core/leave/entitlement.js";
import { addDaysIso, countCalendarDays, countLeaveDays, normalizeSession, SESSION_FULL } from "../../core/leave/workingDays.js";
import { sanitizeAttachment } from "../../core/storage/leaveAttachments.js";
import { normalizeLeaveDates, totalUnits } from "../../core/leave/leaveDates.js";

export { addDaysIso, countLeaveDays, prorateDays };

const required = (value, label, errors, key) => {
  const next = String(value ?? "").trim();
  if (!next) errors[key] = `${label} is required`;
  return next;
};

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export const validateLeaveRequestBody = (body = {}) => {
  const errors = {};
  const establishmentId = required(body.establishmentId, "Establishment", errors, "establishmentId");
  const employeeId = required(body.employeeId, "Employee", errors, "employeeId");
  const leaveTypeId = required(body.leaveTypeId, "Type of leave", errors, "leaveTypeId");
  const reason = required(body.reason, "Reason", errors, "reason");

  // Day lines: separate dates, each with its own session, in one request.
  const { dates: leaveDates, error: datesError } = normalizeLeaveDates(body.leaveDates);
  if (datesError) {
    errors.leaveDates = datesError;
  }
  if (leaveDates.length) {
    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      value: {
        establishmentId,
        employeeId,
        leaveTypeId,
        startDate: leaveDates[0].date,
        endDate: leaveDates[leaveDates.length - 1].date,
        reason,
        session: SESSION_FULL,
        days: totalUnits(leaveDates),
        leaveDates,
        ...sanitizeAttachment(body),
      },
    };
  }

  const startDate = required(body.startDate, "Start date", errors, "startDate");
  const endDate = required(body.endDate, "End date", errors, "endDate");
  const session = normalizeSession(body.session);

  if (startDate && !isIsoDate(startDate)) errors.startDate = "Start date is invalid";
  if (endDate && !isIsoDate(endDate)) errors.endDate = "End date is invalid";
  if (startDate && endDate && endDate < startDate) errors.endDate = "End date cannot be before start date";
  // One request = one leave year (balances are year-wise).
  if (startDate && endDate && startDate.slice(0, 4) !== endDate.slice(0, 4)) {
    errors.endDate = "Leave dates must be in the same year";
  }
  if (session !== SESSION_FULL && startDate && endDate && startDate !== endDate) {
    errors.endDate = "First half and second half apply to one day only";
  }

  const days = startDate && endDate ? countCalendarDays(startDate, endDate) : 0;
  if (!errors.startDate && !errors.endDate && days <= 0) {
    errors.endDate = "Select a valid date range";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    value: {
      establishmentId,
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      reason,
      session,
      days,
      leaveDates: [],
      ...sanitizeAttachment(body),
    },
  };
};
