const required = (value, label, errors, key) => {
  const next = String(value ?? "").trim();
  if (!next) errors[key] = `${label} is required`;
  return next;
};

export const validateRevokeBody = (body = {}) => {
  const errors = {};
  const leaveRequestId = required(body.leaveRequestId, "Approved leave", errors, "leaveRequestId");
  const reason = required(body.reason, "Reason", errors, "reason");

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    value: { leaveRequestId, reason },
  };
};
