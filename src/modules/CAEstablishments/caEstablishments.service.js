import { AppError } from "../../core/errors/AppError.js";
import { isAllCompanyAccess, matchesCompanyAccess } from "../../core/access/companyAccess.js";
import { companiesRepository } from "../Companies/companies.repository.js";
import { countryRepository } from "../Country/country.repository.js";
import { caCompaniesRepository } from "../CACompanies/caCompanies.repository.js";
import { caEstablishmentsRepository } from "./caEstablishments.repository.js";

const LEGACY_COUNTRY_CODES = {
  in: "india",
  sg: "singapore",
  my: "malaysia",
  th: "thailand",
  vn: "vietnam",
};

const ownedBy = (row, companyId) => String(row?.createdByCompanyId) === String(companyId);

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

const countryNameFrom = (id, listed) => {
  const match = listed.find((country) => String(country.id) === String(id));
  return match?.name || "";
};

const resolveCompany = async (companyId, companySource, jwtCompanyId) => {
  if (companySource === "parent") {
    if (String(companyId) !== String(jwtCompanyId)) {
      throw new AppError("Parent company not found", 404, "COMPANY_NOT_FOUND");
    }

    const parent = await companiesRepository.findById(companyId);

    if (!parent) {
      throw new AppError("Parent company not found", 404, "COMPANY_NOT_FOUND");
    }

    return {
      name: parent.legalName || parent.name,
      addressCountryId: parent.addressCountryId || parent.billingCountryId || "",
      countries: Array.isArray(parent.countries) ? parent.countries : [],
    };
  }

  const company = await caCompaniesRepository.findById(companyId);

  if (!company || String(company.createdByCompanyId) !== String(jwtCompanyId)) {
    throw new AppError("Parent company not found", 404, "COMPANY_NOT_FOUND");
  }

  const parent = await companiesRepository.findById(jwtCompanyId);

  return {
    name: company.tradeName || company.legalName || company.name,
    addressCountryId: company.addressCountryId || parent?.addressCountryId || "",
    countries: Array.isArray(parent?.countries) ? parent.countries : [],
  };
};

const allowedCountryIds = (company, listed) => {
  const ids = [
    countryIdFrom(company.addressCountryId, listed),
    ...company.countries.map((value) => countryIdFrom(value, listed)),
  ].filter(Boolean);

  return [...new Set(ids)];
};

const resolveCountry = (company, countryId, listed) => {
  const resolved = countryIdFrom(countryId, listed);
  if (resolved) {
    return resolved;
  }

  return allowedCountryIds(company, listed)[0] || "";
};

const allowedCompanyKeys = async (companyId, companyAccess) => {
  if (isAllCompanyAccess(companyAccess)) {
    return null;
  }

  const parent = await companiesRepository.findById(companyId);
  const children = await caCompaniesRepository.listByCreator(companyId);
  const keys = new Set();

  if (parent && matchesCompanyAccess(companyAccess, parent.legalName, parent.tradeName, parent.name)) {
    keys.add(`parent:${parent.id}`);
  }

  for (const company of children) {
    if (matchesCompanyAccess(companyAccess, company.legalName, company.tradeName, company.name)) {
      keys.add(`ca:${company.id}`);
    }
  }

  return keys;
};

const inCompanyScope = (keys, row, companyAccess) => {
  if (!keys) {
    return true;
  }
  if (keys.has(`${row.companySource}:${row.companyId}`)) {
    return true;
  }
  return matchesCompanyAccess(companyAccess, row.companyName);
};

const denyCompanyScope = async (companyId, companyAccess, row) => {
  const keys = await allowedCompanyKeys(companyId, companyAccess);
  if (inCompanyScope(keys, row, companyAccess)) {
    return;
  }
  throw new AppError("You can only access your assigned company data", 403, "FORBIDDEN");
};

export const caEstablishmentsService = {
  async list(companyId, companyAccess) {
    const rows = await caEstablishmentsRepository.listByCreator(companyId);
    const keys = await allowedCompanyKeys(companyId, companyAccess);
    return rows.filter((row) => inCompanyScope(keys, row, companyAccess));
  },

  async get(id, companyId, companyAccess) {
    const establishment = await caEstablishmentsRepository.findById(id);

    if (!establishment || !ownedBy(establishment, companyId)) {
      throw new AppError("Establishment not found", 404, "ESTABLISHMENT_NOT_FOUND");
    }

    await denyCompanyScope(companyId, companyAccess, establishment);
    return establishment;
  },

  async create(companyId, payload, companyAccess) {
    const parent = await companiesRepository.findById(companyId);

    if (!parent) {
      throw new AppError("Parent company not found", 404, "COMPANY_NOT_FOUND");
    }

    const company = await resolveCompany(payload.companyId, payload.companySource, companyId);
    await denyCompanyScope(companyId, companyAccess, {
      companySource: payload.companySource,
      companyId: payload.companyId,
      companyName: company.name,
    });
    const listed = await countryRepository.list();
    const countryId = resolveCountry(company, payload.countryId, listed);

    if (!countryId) {
      throw new AppError("Country is required for the selected company", 422, "COUNTRY_REQUIRED");
    }

    const creatorId = Number.parseInt(String(companyId), 10);

    return caEstablishmentsRepository.create({
      ...payload,
      companyName: company.name,
      countryId,
      countryName: countryNameFrom(countryId, listed),
      createdByCompanyId: creatorId,
    });
  },

  async update(id, companyId, payload, companyAccess) {
    const existing = await caEstablishmentsRepository.findById(id);

    if (!existing || !ownedBy(existing, companyId)) {
      throw new AppError("Establishment not found", 404, "ESTABLISHMENT_NOT_FOUND");
    }

    await denyCompanyScope(companyId, companyAccess, existing);
    const company = await resolveCompany(payload.companyId, payload.companySource, companyId);
    await denyCompanyScope(companyId, companyAccess, {
      companySource: payload.companySource,
      companyId: payload.companyId,
      companyName: company.name,
    });
    const listed = await countryRepository.list();
    const countryId = resolveCountry(company, payload.countryId, listed);

    if (!countryId) {
      throw new AppError("Country is required for the selected company", 422, "COUNTRY_REQUIRED");
    }

    const updated = await caEstablishmentsRepository.update(id, {
      ...payload,
      companyName: company.name,
      countryId,
      countryName: countryNameFrom(countryId, listed),
    });

    if (!updated) {
      throw new AppError("Establishment not found", 404, "ESTABLISHMENT_NOT_FOUND");
    }

    return updated;
  },

  async updateStatus(id, companyId, status, companyAccess) {
    const existing = await caEstablishmentsRepository.findById(id);

    if (!existing || !ownedBy(existing, companyId)) {
      throw new AppError("Establishment not found", 404, "ESTABLISHMENT_NOT_FOUND");
    }

    await denyCompanyScope(companyId, companyAccess, existing);

    const next = status === "Active" ? "Active" : "Inactive";
    const updated = await caEstablishmentsRepository.updateStatus(id, next);

    if (!updated) {
      throw new AppError("Establishment not found", 404, "ESTABLISHMENT_NOT_FOUND");
    }

    return updated;
  },
};
