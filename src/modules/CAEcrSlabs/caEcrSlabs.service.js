import { caEcrSlabsRepository } from "./caEcrSlabs.repository.js";
import { AppError } from "../../core/errors/AppError.js";

export const caEcrSlabsService = {
  async list(companyId) {
    return caEcrSlabsRepository.list(companyId);
  },

  async create(companyId, payload) {
    if (!payload.wageType) throw new AppError("Wage Type is required", 400);
    return caEcrSlabsRepository.create(companyId, payload);
  },

  async update(id, companyId, payload) {
    if (!payload.wageType) throw new AppError("Wage Type is required", 400);
    const updated = await caEcrSlabsRepository.update(id, companyId, payload);
    if (!updated) throw new AppError("Slab not found", 404);
    return updated;
  },

  async delete(id, companyId) {
    const deleted = await caEcrSlabsRepository.delete(id, companyId);
    if (!deleted) throw new AppError("Slab not found", 404);
    return { success: true };
  },

  async bulkSave(companyId, wageType, slabs) {
    if (!wageType) throw new AppError("Wage Type is required", 400);
    if (!Array.isArray(slabs)) throw new AppError("Slabs must be an array", 400);
    return caEcrSlabsRepository.bulkSave(companyId, wageType, slabs);
  }
};
