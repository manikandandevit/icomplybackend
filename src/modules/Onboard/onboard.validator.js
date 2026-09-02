export const validateOnboardBody = (body = {}) => {
  const errors = {};
  const countryId = String(body.countryId ?? "").trim();
  const amount = Number(body.amount);

  if (!countryId) {
    errors.countryId = "Country is required";
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = "Enter onboard amount";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    value: {
      countryId,
      amount: Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0,
    },
  };
};
