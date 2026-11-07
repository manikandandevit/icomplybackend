import { AppError } from "../../core/errors/AppError.js";
import { caPayrollMasterRepository } from "./caPayrollMaster.repository.js";

export const caPayrollMasterService = {
  async list(companyId) {
    return caPayrollMasterRepository.list(companyId);
  },

  async create(companyId, payload) {
    if (!payload.name?.trim()) throw new AppError("Component name is required", 422, "VALIDATION_ERROR");
    const calcType = (payload.calculationType || "").trim().toLowerCase();
    if (payload.type === "Deduction") {
      payload.percentage = Number(payload.percentage) || 0;
      payload.fixedAmount = Number(payload.fixedAmount) || 0;
      if (!payload.dependsOn?.trim()) payload.dependsOn = "CTC";
    } else if (calcType === "fixed" || calcType === "fixed amount") {
      if (payload.fixedAmount == null || isNaN(Number(payload.fixedAmount))) {
        throw new AppError("Fixed Amount is required", 422, "VALIDATION_ERROR");
      }
      payload.calculationType = "Fixed Amount";
      payload.percentage = 0;
      if (!payload.dependsOn?.trim()) payload.dependsOn = "Fixed";
    } else if (calcType === "formula") {
      payload.calculationType = "Formula";
      payload.percentage = 0;
      payload.fixedAmount = 0;
    } else {
      if (payload.percentage == null || isNaN(Number(payload.percentage))) {
        throw new AppError("Percentage is required", 422, "VALIDATION_ERROR");
      }
      payload.calculationType = "Percentage";
      if (!payload.dependsOn?.trim()) payload.dependsOn = "Monthly CTC";
      payload.fixedAmount = 0;
    }
    const component = await caPayrollMasterRepository.create(companyId, payload);
    if (!component) throw new AppError("Unable to create component", 500, "CREATE_FAILED");
    return component;
  },

  async update(id, companyId, payload) {
    if (!payload.name?.trim()) throw new AppError("Component name is required", 422, "VALIDATION_ERROR");
    const calcType = (payload.calculationType || "").trim().toLowerCase();
    if (payload.type === "Deduction") {
      payload.percentage = Number(payload.percentage) || 0;
      payload.fixedAmount = Number(payload.fixedAmount) || 0;
      if (!payload.dependsOn?.trim()) payload.dependsOn = "CTC";
    } else if (calcType === "fixed" || calcType === "fixed amount") {
      if (payload.fixedAmount == null || isNaN(Number(payload.fixedAmount))) {
        throw new AppError("Fixed Amount is required", 422, "VALIDATION_ERROR");
      }
      payload.calculationType = "Fixed Amount";
      payload.percentage = 0;
      if (!payload.dependsOn?.trim()) payload.dependsOn = "Fixed";
    } else if (calcType === "formula") {
      payload.calculationType = "Formula";
      payload.percentage = 0;
      payload.fixedAmount = 0;
    } else {
      if (payload.percentage == null || isNaN(Number(payload.percentage))) {
        throw new AppError("Percentage is required", 422, "VALIDATION_ERROR");
      }
      payload.calculationType = "Percentage";
      if (!payload.dependsOn?.trim()) payload.dependsOn = "Monthly CTC";
      payload.fixedAmount = 0;
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
