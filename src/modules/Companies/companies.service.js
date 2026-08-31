import bcrypt from "bcryptjs";
import { AppError } from "../../core/errors/AppError.js";
import { companiesRepository } from "./companies.repository.js";
import { companiesStorage } from "./companies.storage.js";

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

    const passwordHash = await bcrypt.hash(payload.password, 10);
    return companiesRepository.create({ ...payload, passwordHash });
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

    const passwordHash = payload.password ? await bcrypt.hash(payload.password, 10) : null;
    return companiesRepository.update(id, { ...payload, passwordHash });
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
