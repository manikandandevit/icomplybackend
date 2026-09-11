import { AppError } from "../../core/errors/AppError.js";
import { caPayrollMasterRepository } from "./caPayrollMaster.repository.js";

export const caPayrollMasterService = {
  async list(companyId) {
    return caPayrollMasterRepository.list(companyId);
  },

  async create(companyId, payload) {
    if (!payload.name?.trim()) throw new AppError("Component name is required", 422, "VALIDATION_ERROR");
    if (payload.percentage == null || isNaN(Number(payload.percentage))) {
      throw new AppError("Percentage is required", 422, "VALIDATION_ERROR");
    }
    const component = await caPayrollMasterRepository.create(companyId, payload);
    if (!component) throw new AppError("Unable to create component", 500, "CREATE_FAILED");
    return component;
  },

  async update(id, companyId, payload) {
    if (!payload.name?.trim()) throw new AppError("Component name is required", 422, "VALIDATION_ERROR");
    if (payload.percentage == null || isNaN(Number(payload.percentage))) {
      throw new AppError("Percentage is required", 422, "VALIDATION_ERROR");
    }
    const existing = await caPayrollMasterRepository.findById(id, companyId);
    if (!existing) throw new AppError("Component not found", 404, "NOT_FOUND");
    const updated = await caPayrollMasterRepository.update(id, companyId, payload);
    if (!updated) throw new AppError("Unable to update component", 500, "UPDATE_FAILED");
    return updated;
  },

  async delete(id, companyId) {
    const existing = await caPayrollMasterRepository.findById(id, companyId);
    if (!existing) throw new AppError("Component not found", 404, "NOT_FOUND");
    const deleted = await caPayrollMasterRepository.delete(id, companyId);
    if (!deleted) throw new AppError("Unable to delete component", 500, "DELETE_FAILED");
  },
};
