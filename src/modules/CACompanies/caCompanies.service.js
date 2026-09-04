import { AppError } from "../../core/errors/AppError.js";
import { matchesCompanyAccess } from "../../core/access/companyAccess.js";
import { companiesRepository } from "../Companies/companies.repository.js";
import { countryRepository } from "../Country/country.repository.js";
import { companiesStorage, LOGO_KEY_PATTERN } from "../Companies/companies.storage.js";
import { caCompaniesRepository } from "./caCompanies.repository.js";
import { caEstablishmentsRepository } from "../CAEstablishments/caEstablishments.repository.js";

const LEGACY_COUNTRY_CODES = {
  in: "india",
  sg: "singapore",
  my: "malaysia",
  th: "thailand",
  vn: "vietnam",
};

const ownedBy = (company, companyId) => String(company?.createdByCompanyId) === String(companyId);

const countryIdFrom = (value, listed) => {
  const next = String(value ?? "").trim();

  if (!next) {
    return "";
  }

  const ids = new Set(listed.map((country) => String(country.id)));

  if (ids.has(next)) {
    return next;
  }

  const asId = Number.parseInt(next, 10);
  if (Number.isInteger(asId) && asId > 0 && ids.has(String(asId))) {
    return String(asId);
  }

  const byName = new Map(listed.map((country) => [String(country.name).trim().toLowerCase(), String(country.id)]));
  const fromName = byName.get(next.toLowerCase());

  if (fromName) {
    return fromName;
  }

  const fromCode = LEGACY_COUNTRY_CODES[next.toLowerCase()];
  return fromCode ? byName.get(fromCode) ?? "" : "";
};

const operationCountryIds = (parent, listed) => {
  const saved = Array.isArray(parent?.countries) ? parent.countries : [];
  return [...new Set(saved.map((value) => countryIdFrom(value, listed)).filter(Boolean))];
};

const resolveAddressCountryId = (parent, addressCountryId, listed) => {
  const resolved = countryIdFrom(addressCountryId, listed);

  if (!resolved) {
    return "";
  }

  const allowed = operationCountryIds(parent, listed);
  return allowed.length === 0 || allowed.includes(resolved) ? resolved : "";
};

const storageKeyFrom = (stored) => {
  const value = String(stored || "");

  if (LOGO_KEY_PATTERN.test(value)) {
    return value;
  }

  const match = value.match(/(ca-companies|companies)\/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|svg)/i);
  return match ? match[0] : null;
};

const throwIfUniquePan = (error) => {
  if (error?.code === "23505") {
    throw new AppError("A company with this PAN already exists", 409, "COMPANY_EXISTS");
  }

  throw error;
};

export const caCompaniesService = {
  uploadLogo: (file) => companiesStorage.upload(file, { prefix: "ca-companies" }),

  async logoById(id) {
    const stored = await caCompaniesRepository.findLogoKey(id);
    const key = storageKeyFrom(stored);

    if (!key) {
      throw new AppError("Company logo not found", 404, "LOGO_NOT_FOUND");
    }

    return companiesStorage.get(key);
  },

  async list(companyId, companyAccess) {
    const parent = await companiesRepository.findById(companyId);
    const listed = await countryRepository.list();
    const companies = await caCompaniesRepository.listByCreator(companyId);
    const counts = await caEstablishmentsRepository.countsByCreator(companyId);
    const countOf = (source, id) => counts[`${source}:${id}`] || 0;

    const parentRow = parent ? { ...parent, establishments: countOf("parent", parent.id) } : null;
    const childRows = companies.map((company) => ({
      ...company,
      establishments: countOf("ca", company.id),
    }));

    const operationCountries = [
      ...operationCountryIds(parent, listed),
      countryIdFrom(parent?.addressCountryId, listed),
      countryIdFrom(parent?.billingCountryId, listed),
    ].filter(Boolean);

    return {
      parent: parentRow && matchesCompanyAccess(companyAccess, parentRow.legalName, parentRow.tradeName, parentRow.name)
        ? parentRow
        : null,
      companies: childRows.filter((company) =>
        matchesCompanyAccess(companyAccess, company.legalName, company.tradeName, company.name),
      ),
      operationCountries: [...new Set(operationCountries)],
    };
  },

  async get(id, companyId) {
    const company = await caCompaniesRepository.findById(id);

    if (!company || !ownedBy(company, companyId)) {
      throw new AppError("Company not found", 404, "COMPANY_NOT_FOUND");
    }

    return company;
  },

  async create(companyId, payload) {
    const parent = await companiesRepository.findById(companyId);

    if (!parent) {
      throw new AppError("Parent company not found", 404, "COMPANY_NOT_FOUND");
    }

    const existing = await caCompaniesRepository.findByPan(payload.pan);

    if (existing) {
      throw new AppError("A company with this PAN already exists", 409, "COMPANY_EXISTS");
    }

    const creatorId = Number.parseInt(String(companyId), 10);

    if (!Number.isInteger(creatorId) || creatorId < 1) {
      throw new AppError("Parent company not found", 404, "COMPANY_NOT_FOUND");
    }

    const listed = await countryRepository.list();
    const addressCountryId = resolveAddressCountryId(parent, payload.addressCountryId, listed);

    if (!addressCountryId) {
      throw new AppError("Select a country from countries of operation", 422, "COUNTRY_REQUIRED");
    }

    try {
      return await caCompaniesRepository.create({
        ...payload,
        addressCountryId,
        createdByCompanyId: creatorId,
        createdByCompanyName: parent.legalName || parent.name,
      });
    } catch (error) {
      throwIfUniquePan(error);
    }
  },

  async update(id, companyId, payload) {
    const company = await caCompaniesRepository.findById(id);

    if (!company || !ownedBy(company, companyId)) {
      throw new AppError("Company not found", 404, "COMPANY_NOT_FOUND");
    }

    const existing = await caCompaniesRepository.findByPan(payload.pan, id);

    if (existing) {
      throw new AppError("A company with this PAN already exists", 409, "COMPANY_EXISTS");
    }

    const parent = await companiesRepository.findById(companyId);

    if (!parent) {
      throw new AppError("Parent company not found", 404, "COMPANY_NOT_FOUND");
    }

    const listed = await countryRepository.list();
    const addressCountryId = resolveAddressCountryId(parent, payload.addressCountryId, listed);

    if (!addressCountryId) {
      throw new AppError("Select a country from countries of operation", 422, "COUNTRY_REQUIRED");
    }

    try {
      const updated = await caCompaniesRepository.update(id, { ...payload, addressCountryId });

      if (!updated) {
        throw new AppError("Company not found", 404, "COMPANY_NOT_FOUND");
      }

      return updated;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throwIfUniquePan(error);
    }
  },

  async updateStatus(id, companyId, status) {
    const company = await caCompaniesRepository.findById(id);

    if (!company || !ownedBy(company, companyId)) {
      throw new AppError("Company not found", 404, "COMPANY_NOT_FOUND");
    }

    const next = status === "Active" ? "Active" : "Inactive";
    const updated = await caCompaniesRepository.updateStatus(id, next);

    if (!updated) {
      throw new AppError("Company not found", 404, "COMPANY_NOT_FOUND");
    }

    return updated;
  },
};
