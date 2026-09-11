export const prorateDays = (
  annualDays,
  joinDate,
  year = new Date().getFullYear(),
  proratePolicy = "yes",
) => {
  const days = Number(annualDays) || 0;
  if (days <= 0) return 0;
  if (String(proratePolicy || "yes").trim().toLowerCase() === "no") {
    return days;
  }
  const raw = String(joinDate || "").slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return days;
  const joined = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (joined.getFullYear() < year) return days;
  if (joined.getFullYear() > year) return 0;
  const remainingMonths = 12 - joined.getMonth();
  return Math.round((days * remainingMonths) / 12);
};

export const joinYearOf = (joinDate) => {
  const match = String(joinDate || "").slice(0, 10).match(/^(\d{4})-/);
  const year = match ? Number(match[1]) : 0;
  return year > 0 ? year : null;
};

export const isCarryForwardYes = (value) => {
  const next = String(value ?? "").trim().toLowerCase();
  return next === "yes" || next === "y" || next === "true" || next === "1";
};

export const carryPolicyOf = (leaveType = {}) => {
  const values = leaveType.values || leaveType;
  return {
    carryForward: isCarryForwardYes(values.carryForward) ? "yes" : "no",
    carryForwardMax: Number(values.carryForwardMax) || 0,
  };
};

export const carryForwardDays = (unused, policy = {}) => {
  const values = policy.values || policy;
  if (!isCarryForwardYes(values.carryForward)) return 0;
  const max = Number(values.carryForwardMax);
  if (!Number.isFinite(max) || max <= 0) return 0;
  return Math.min(Math.max(Number(unused) || 0, 0), max);
};

/** Walk join year → target year with current carry policy and approved usage. */
export const yearEntitled = ({
  annualDays,
  joinDate,
  year,
  prorate = "yes",
  carryForward = "no",
  carryForwardMax = 0,
  usedByYear = {},
} = {}) => {
  const target = Number(year) || new Date().getFullYear();
  const joined = joinYearOf(joinDate);
  const start = joined && joined <= target ? joined : target;
  const policy = { carryForward, carryForwardMax };
  let entitled = 0;
  for (let y = start; y <= target; y += 1) {
    const annual = prorateDays(annualDays, joinDate, y, prorate);
    const carried =
      y === start ? 0 : carryForwardDays(Math.max(entitled - (Number(usedByYear[y - 1]) || 0), 0), policy);
    entitled = annual + carried;
  }
  return entitled;
};
