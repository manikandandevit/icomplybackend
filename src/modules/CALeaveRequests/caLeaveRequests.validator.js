import { prorateDays } from "../../core/leave/entitlement.js";
import { addDaysIso, countCalendarDays, countLeaveDays, normalizeSession, SESSION_FULL } from "../../core/leave/workingDays.js";
import { sanitizeAttachment } from "../../core/storage/leaveAttachments.js";

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
  const startDate = required(body.startDate, "Start date", errors, "startDate");
  const endDate = required(body.endDate, "End date", errors, "endDate");
  const reason = required(body.reason, "Reason", errors, "reason");
  const session = normalizeSession(body.session);

  if (startDate && !isIsoDate(startDate)) errors.startDate = "Start date is invalid";
  if (endDate && !isIsoDate(endDate)) errors.endDate = "End date is invalid";
  if (startDate && endDate && endDate < startDate) errors.endDate = "End date cannot be before start date";
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
      ...sanitizeAttachment(body),
    },
  };
};
