import { AppError } from "../../core/errors/AppError.js";
import { countryRepository } from "../Country/country.repository.js";
import { CURRENCIES } from "./pricing.constants.js";
import { pricingRepository } from "./pricing.repository.js";

const uniqueError = (error) => {
  if (error?.code === "23505") {
    throw new AppError("Pricing for this root country already exists", 409, "PRICING_EXISTS");
  }

  throw error;
};

export const pricingService = {
  list: () => pricingRepository.list(),
  currencies: () => CURRENCIES,

  async create(payload) {
    const country = await countryRepository.findById(payload.countryId);

    if (!country) {
      throw new AppError("Root country not found", 404, "COUNTRY_NOT_FOUND");
    }

    const listed = await countryRepository.list();
    const missing = listed.filter((item) => !(Number(payload.countryPrices?.[String(item.id)]) > 0));

    if (listed.length === 0 || missing.length > 0) {
      throw new AppError("Enter per user price for each country", 422, "COUNTRY_PRICES_REQUIRED");
    }

    const existing = await pricingRepository.findByCountryId(payload.countryId);

    if (existing) {
      throw new AppError("Pricing for this root country already exists", 409, "PRICING_EXISTS");
    }

    try {
      return await pricingRepository.create({
        ...payload,
        countryPrices: Object.fromEntries(listed.map((item) => [String(item.id), Number(payload.countryPrices[String(item.id)])])),
        perUserPrice: Number(payload.countryPrices[String(country.id)]),
      });
    } catch (error) {
      uniqueError(error);
    }
  },

  async update(id, payload) {
    const pricing = await pricingRepository.findById(id);

    if (!pricing) {
      throw new AppError("Pricing not found", 404, "PRICING_NOT_FOUND");
    }

    const country = await countryRepository.findById(payload.countryId);

    if (!country) {
      throw new AppError("Root country not found", 404, "COUNTRY_NOT_FOUND");
    }

    const listed = await countryRepository.list();
    const missing = listed.filter((item) => !(Number(payload.countryPrices?.[String(item.id)]) > 0));

    if (listed.length === 0 || missing.length > 0) {
      throw new AppError("Enter per user price for each country", 422, "COUNTRY_PRICES_REQUIRED");
    }

    const existing = await pricingRepository.findByCountryId(payload.countryId, id);

    if (existing) {
      throw new AppError("Pricing for this root country already exists", 409, "PRICING_EXISTS");
    }

    try {
      const updated = await pricingRepository.update(id, {
        ...payload,
        countryPrices: Object.fromEntries(listed.map((item) => [String(item.id), Number(payload.countryPrices[String(item.id)])])),
        perUserPrice: Number(payload.countryPrices[String(country.id)]),
      });

      if (!updated) {
        throw new AppError("Pricing not found", 404, "PRICING_NOT_FOUND");
      }

      return updated;
    } catch (error) {
      uniqueError(error);
    }
  },

  async remove(id) {
    const pricing = await pricingRepository.findById(id);

    if (!pricing) {
      throw new AppError("Pricing not found", 404, "PRICING_NOT_FOUND");
    }

    await pricingRepository.remove(id);
    return pricing;
  },
};
