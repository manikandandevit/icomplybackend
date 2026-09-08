const required = (value, label, errors, key) => {
  const next = String(value ?? "").trim();
  if (!next) errors[key] = `${label} is required`;
  return next;
};

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export const countLeaveDays = (startDate, endDate) => {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
};

export const prorateDays = (annualDays, joinDate, year = new Date().getFullYear()) => {
  const days = Number(annualDays) || 0;
  if (days <= 0) return 0;
  const raw = String(joinDate || "").slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return days;
  const joined = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (joined.getFullYear() < year) return days;
  if (joined.getFullYear() > year) return 0;
  return Math.round((days * (12 - joined.getMonth())) / 12);
};

export const validateLeaveRequestBody = (body = {}) => {
  const errors = {};
  const establishmentId = required(body.establishmentId, "Establishment", errors, "establishmentId");
  const employeeId = required(body.employeeId, "Employee", errors, "employeeId");
  const leaveTypeId = required(body.leaveTypeId, "Type of leave", errors, "leaveTypeId");
  const startDate = required(body.startDate, "Start date", errors, "startDate");
  const endDate = required(body.endDate, "End date", errors, "endDate");
  const reason = required(body.reason, "Reason", errors, "reason");

  if (startDate && !isIsoDate(startDate)) errors.startDate = "Start date is invalid";
  if (endDate && !isIsoDate(endDate)) errors.endDate = "End date is invalid";
  if (startDate && endDate && endDate < startDate) errors.endDate = "End date cannot be before start date";

  const days = startDate && endDate ? countLeaveDays(startDate, endDate) : 0;
  if (!errors.startDate && !errors.endDate && days <= 0) {
    errors.endDate = "Select a valid date range";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    value: { establishmentId, employeeId, leaveTypeId, startDate, endDate, reason, days },
  };
};
