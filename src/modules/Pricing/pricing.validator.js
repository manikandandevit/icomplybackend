import { currencyByCode } from "./pricing.constants.js";

const countryPricesFrom = (body) => {
  const source = body.countryPrices && typeof body.countryPrices === "object" && !Array.isArray(body.countryPrices)
    ? body.countryPrices
    : {};
  const next = {};

  for (const [id, value] of Object.entries(source)) {
    const countryId = String(id).trim();
    const price = Number(value);

    if (!countryId || !Number.isFinite(price) || price <= 0) {
      continue;
    }

    next[countryId] = Number(price.toFixed(2));
  }

  return next;
};

export const validatePricingBody = (body = {}) => {
  const errors = {};
  const countryId = String(body.countryId ?? "").trim();
  const currencyCode = String(body.currencyCode ?? "").trim().toUpperCase();
  const currency = currencyByCode(currencyCode);
  const countryPrices = countryPricesFrom(body);

  if (!countryId) {
    errors.countryId = "Root country is required";
  }

  if (!currencyCode) {
    errors.currencyCode = "Currency is required";
  } else if (!currency) {
    errors.currencyCode = "Select a valid currency";
  }

  if (Object.keys(countryPrices).length === 0) {
    errors.countryPrices = "Enter per user price for each country";
  }

  const perUserPrice = countryPrices[countryId] ?? Object.values(countryPrices)[0] ?? 0;

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    value: {
      countryId,
      currencyCode,
      currencySymbol: currency?.symbol ?? "",
      perUserPrice: Number(Number(perUserPrice).toFixed(2)),
      countryPrices,
    },
  };
};
