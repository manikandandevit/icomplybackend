import { currencyByCode } from "./pricing.constants.js";

export const validatePricingBody = (body = {}) => {
  const errors = {};
  const countryId = String(body.countryId ?? "").trim();
  const currencyCode = String(body.currencyCode ?? "").trim().toUpperCase();
  const rawPrice = String(body.perUserPrice ?? "").trim();
  const currency = currencyByCode(currencyCode);
  const perUserPrice = Number(rawPrice);

  if (!countryId) {
    errors.countryId = "Country is required";
  }

  if (!currencyCode) {
    errors.currencyCode = "Currency is required";
  } else if (!currency) {
    errors.currencyCode = "Select a valid currency";
  }

  if (!rawPrice) {
    errors.perUserPrice = "Per user pricing is required";
  } else if (!Number.isFinite(perUserPrice) || perUserPrice <= 0) {
    errors.perUserPrice = "Enter a valid per user price";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    value: {
      countryId,
      currencyCode,
      currencySymbol: currency?.symbol ?? "",
      perUserPrice: Number(perUserPrice.toFixed(2)),
    },
  };
};
