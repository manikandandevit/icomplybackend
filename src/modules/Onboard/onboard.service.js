import { AppError } from "../../core/errors/AppError.js";
import { countryRepository } from "../Country/country.repository.js";
import { pricingRepository } from "../Pricing/pricing.repository.js";
import { currencyForCountryName } from "../Pricing/pricing.constants.js";
import { onboardRepository } from "./onboard.repository.js";

const uniqueError = (error) => {
  if (error?.code === "23505") {
    throw new AppError("Onboard amount for this country already exists", 409, "ONBOARD_EXISTS");
  }

  throw error;
};

const withCountryCurrency = async (payload) => {
  const country = await countryRepository.findById(payload.countryId);

  if (!country) {
    throw new AppError("Select a valid country", 422, "COUNTRY_REQUIRED");
  }

  const pricing = await pricingRepository.findByCountryId(payload.countryId);
  const currency = pricing
    ? { code: pricing.currencyCode, symbol: pricing.currencySymbol }
    : currencyForCountryName(country.name);

  if (!currency?.code) {
    throw new AppError("Add pricing for this country first", 422, "PRICING_REQUIRED");
  }

  return {
    ...payload,
    currencyCode: currency.code,
    currencySymbol: currency.symbol,
  };
};

export const onboardService = {
  list: () => onboardRepository.list(),

  async create(payload) {
    const billed = await withCountryCurrency(payload);
    const existing = await onboardRepository.findByCountryId(billed.countryId);

    if (existing) {
      throw new AppError("Onboard amount for this country already exists", 409, "ONBOARD_EXISTS");
    }

    try {
      return await onboardRepository.create(billed);
    } catch (error) {
      uniqueError(error);
    }
  },

  async update(id, payload) {
    const onboard = await onboardRepository.findById(id);

    if (!onboard) {
      throw new AppError("Onboard not found", 404, "ONBOARD_NOT_FOUND");
    }

    const billed = await withCountryCurrency(payload);
    const existing = await onboardRepository.findByCountryId(billed.countryId, id);

    if (existing) {
      throw new AppError("Onboard amount for this country already exists", 409, "ONBOARD_EXISTS");
    }

    try {
      const updated = await onboardRepository.update(id, billed);

      if (!updated) {
        throw new AppError("Onboard not found", 404, "ONBOARD_NOT_FOUND");
      }

      return updated;
    } catch (error) {
      uniqueError(error);
    }
  },

  async remove(id) {
    const onboard = await onboardRepository.findById(id);

    if (!onboard) {
      throw new AppError("Onboard not found", 404, "ONBOARD_NOT_FOUND");
    }

    await onboardRepository.remove(id);
    return onboard;
  },
};
