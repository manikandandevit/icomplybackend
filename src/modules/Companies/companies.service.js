import bcrypt from "bcryptjs";
import { AppError } from "../../core/errors/AppError.js";
import { countryRepository } from "../Country/country.repository.js";
import { pricingRepository } from "../Pricing/pricing.repository.js";
import { companiesRepository } from "./companies.repository.js";
import { companiesStorage } from "./companies.storage.js";

const withBilling = async (payload) => {
  const country = await countryRepository.findById(payload.billingCountryId);

  if (!country) {
    throw new AppError("Select a valid country", 422, "COUNTRY_REQUIRED");
  }

  const pricing = await pricingRepository.findByCountryId(payload.billingCountryId);

  if (!pricing) {
    throw new AppError("Add pricing for this country first", 422, "PRICING_REQUIRED");
  }

  return {
    ...payload,
    billingCountryId: String(payload.billingCountryId),
    billingCurrencyCode: pricing.currencyCode,
    billingCurrencySymbol: pricing.currencySymbol,
    billingPerUserPrice: pricing.perUserPrice,
    billingCountryPrices: Object.fromEntries(
      Object.entries(pricing.countryPrices ?? {}).map(([id, price]) => [String(id), Number(price)])
    ),
  };
};

const withOperationCountries = async (payload) => {
  const listed = await countryRepository.list();
  const allowed = new Set(listed.map((country) => String(country.id)));
  const countries = payload.countries.filter((id) => allowed.has(String(id)));

  if (countries.length === 0 || countries.length !== payload.countries.length) {
    throw new AppError("Select a valid country of operation", 422, "COUNTRIES_INVALID");
  }

  return { ...payload, countries };
};

const sheetRateOf = (prices, countryId) => {
  const id = String(countryId);

  for (const [key, value] of Object.entries(prices ?? {})) {
    if (String(key) === id) {
      const rate = Number(value);
      if (Number.isFinite(rate) && rate > 0) {
        return rate;
      }
    }
  }

  return 0;
};

const usersOf = (countryUsers, countryId) => {
  const id = String(countryId);

  if (!countryUsers || typeof countryUsers !== "object") {
    return undefined;
  }

  if (countryUsers[countryId] != null) {
    return countryUsers[countryId];
  }

  if (countryUsers[id] != null) {
    return countryUsers[id];
  }

  for (const [key, value] of Object.entries(countryUsers)) {
    if (String(key) === id) {
      return value;
    }
  }

  return undefined;
};

const withSubscription = async (payload) => {
  if (payload.plan !== "Standard") {
    return {
      ...payload,
      users: 0,
      monthlyValue: null,
      countryUsers: {},
    };
  }

  const prices = payload.billingCountryPrices ?? {};
  const saved = {};
  let users = 0;
  let monthly = 0;

  for (const countryId of payload.countries) {
    const count = Number.parseInt(String(usersOf(payload.countryUsers, countryId) ?? ""), 10);
    const rate = sheetRateOf(prices, countryId);

    if (!Number.isInteger(count) || count < 1) {
      throw new AppError("Enter licensed users for each country of operation", 422, "USERS_REQUIRED");
    }

    if (!Number.isFinite(rate) || rate <= 0) {
      throw new AppError("Add pricing for each country of operation in the billing country", 422, "PRICING_REQUIRED");
    }

    users += count;
    monthly += rate * count;
    saved[String(countryId)] = count;
  }

  return {
    ...payload,
    users,
    monthlyValue: Number(monthly.toFixed(2)),
    trialDaysLeft: null,
    countryUsers: saved,
  };
};

export const companiesService = {
  list: () => companiesRepository.list(),

  uploadLogo: (file) => companiesStorage.upload(file),

  async logoById(id) {
    const key = await companiesRepository.findLogoKey(id);

    if (!key) {
      throw new AppError("Company logo not found", 404, "LOGO_NOT_FOUND");
    }

    return companiesStorage.get(key);
  },

  async get(id) {
    const company = await companiesRepository.findById(id);

    if (!company) {
      throw new AppError("Company not found", 404, "COMPANY_NOT_FOUND");
    }

    return company;
  },

  async create(payload) {
    const existing = await companiesRepository.findByPan(payload.pan);

    if (existing) {
      throw new AppError("A company with this PAN already exists", 409, "COMPANY_EXISTS");
    }

    const billed = await withSubscription(await withBilling(await withOperationCountries(payload)));
    const passwordHash = await bcrypt.hash(payload.password, 10);
    return companiesRepository.create({ ...billed, passwordHash });
  },

  async update(id, payload) {
    const company = await companiesRepository.findById(id);

    if (!company) {
      throw new AppError("Company not found", 404, "COMPANY_NOT_FOUND");
    }

    const existing = await companiesRepository.findByPan(payload.pan, id);

    if (existing) {
      throw new AppError("A company with this PAN already exists", 409, "COMPANY_EXISTS");
    }

    const billed = await withSubscription(await withBilling(await withOperationCountries(payload)));
    const passwordHash = payload.password ? await bcrypt.hash(payload.password, 10) : null;
    return companiesRepository.update(id, { ...billed, passwordHash });
  },

  async updateStatus(id, status) {
    const company = await companiesRepository.findById(id);

    if (!company) {
      throw new AppError("Company not found", 404, "COMPANY_NOT_FOUND");
    }

    const next = status === "Active" ? "Active" : "Inactive";
    const updated = await companiesRepository.updateStatus(id, next);

    if (!updated) {
      throw new AppError("Company not found", 404, "COMPANY_NOT_FOUND");
    }

    return updated;
  },
};
