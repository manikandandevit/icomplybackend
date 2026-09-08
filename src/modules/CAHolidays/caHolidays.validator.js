const required = (value, label, errors, key) => {
  const next = String(value ?? "").trim();
  if (!next) errors[key] = `${label} is required`;
  return next;
};

const toIsoDate = (value) => {
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!dmy) return raw;
  return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
};

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const countDays = (startDate, endDate) => {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
};

export const validateHolidayBody = (body = {}) => {
  const errors = {};
  const name = required(body.name, "Holiday name", errors, "name");
  const startDate = toIsoDate(required(body.startDate || body.date, "Start date", errors, "startDate"));
  const endDate = toIsoDate(required(body.endDate || body.startDate || body.date, "End date", errors, "endDate"));
  const holidayTypeId = required(body.holidayTypeId, "Holiday type", errors, "holidayTypeId");
  const countryId = String(body.countryId ?? "all").trim() || "all";
  const countryName = String(body.countryName ?? "").trim() || (countryId === "all" ? "All" : "");

  if (startDate && !isIsoDate(startDate)) errors.startDate = "Start date is invalid";
  if (endDate && !isIsoDate(endDate)) errors.endDate = "End date is invalid";
  if (startDate && endDate && endDate < startDate) errors.endDate = "End date cannot be before start date";

  const days = startDate && endDate ? countDays(startDate, endDate) : 0;
  if (!errors.startDate && !errors.endDate && days <= 0) {
    errors.endDate = "Select a valid date range";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    value: { name, startDate, endDate, date: startDate, days, holidayTypeId, countryId, countryName },
  };
};
