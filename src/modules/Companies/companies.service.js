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
    billingCountryId: payload.billingCountryId,
    billingCurrencyCode: pricing.currencyCode,
    billingCurrencySymbol: pricing.currencySymbol,
    billingPerUserPrice: pricing.perUserPrice,
  };
};

const withOperationCountries = async (payload) => {
  const listed = await countryRepository.list();
  const allowed = new Set(listed.map((country) => country.id));
  const countries = payload.countries.filter((id) => allowed.has(String(id)));

  if (countries.length === 0 || countries.length !== payload.countries.length) {
    throw new AppError("Select a valid country of operation", 422, "COUNTRIES_INVALID");
  }

  return { ...payload, countries };
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

  const rate = Number(payload.billingPerUserPrice);
  const saved = {};
  let users = 0;

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new AppError("Add pricing for this country first", 422, "PRICING_REQUIRED");
  }

  for (const countryId of payload.countries) {
    const count = Number.parseInt(String(payload.countryUsers?.[countryId] ?? ""), 10);

    if (!Number.isInteger(count) || count < 1) {
      throw new AppError("Enter licensed users for each country of operation", 422, "USERS_REQUIRED");
    }

    users += count;
    saved[countryId] = count;
  }

  return {
    ...payload,
    users,
    monthlyValue: Number((rate * users).toFixed(2)),
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
