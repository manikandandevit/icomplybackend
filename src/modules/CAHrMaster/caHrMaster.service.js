import { AppError } from "../../core/errors/AppError.js";
import { MASTER_LABELS } from "./caHrMaster.constants.js";
import { caHrMasterRepository } from "./caHrMaster.repository.js";

export const caHrMasterService = {
  list: (companyId, masterType) => caHrMasterRepository.list(companyId, masterType),

  async create(companyId, masterType, payload) {
    const label = MASTER_LABELS[masterType] || "Master";

    if (masterType === "designation") {
      const department = await caHrMasterRepository.findById(payload.relatedId, companyId, "department");
      if (!department) {
        throw new AppError("Selected department not found", 422, "DEPARTMENT_NOT_FOUND");
      }
    }

    const duplicate = await caHrMasterRepository.findDuplicateName(
      companyId,
      masterType,
      payload.name,
      null,
      payload.relatedId
    );

    if (duplicate) {
      throw new AppError(`This ${label.toLowerCase()} already exists`, 409, "MASTER_DUPLICATE");
    }

    const item = await caHrMasterRepository.create(companyId, masterType, payload);

    if (!item) {
      throw new AppError(`Unable to create ${label.toLowerCase()}`, 500, "MASTER_CREATE_FAILED");
    }

    return item;
  },

  async update(id, companyId, masterType, payload) {
    const label = MASTER_LABELS[masterType] || "Master";
    const existing = await caHrMasterRepository.findById(id, companyId, masterType);

    if (!existing) {
      throw new AppError(`${label} not found`, 404, "MASTER_NOT_FOUND");
    }

    if (masterType === "designation") {
      const department = await caHrMasterRepository.findById(payload.relatedId, companyId, "department");
      if (!department) {
        throw new AppError("Selected department not found", 422, "DEPARTMENT_NOT_FOUND");
      }
    }

    const duplicate = await caHrMasterRepository.findDuplicateName(
      companyId,
      masterType,
      payload.name,
      id,
      payload.relatedId
    );

    if (duplicate) {
      throw new AppError(`This ${label.toLowerCase()} already exists`, 409, "MASTER_DUPLICATE");
    }

    const item = await caHrMasterRepository.update(id, companyId, masterType, payload);

    if (!item) {
      throw new AppError(`${label} not found`, 404, "MASTER_NOT_FOUND");
    }

    return item;
  },

  async delete(id, companyId, masterType) {
    const label = MASTER_LABELS[masterType] || "Master";
    const existing = await caHrMasterRepository.findById(id, companyId, masterType);

    if (!existing) {
      throw new AppError(`${label} not found`, 404, "MASTER_NOT_FOUND");
    }

    const deleted = await caHrMasterRepository.delete(id, companyId, masterType);

    if (!deleted) {
      throw new AppError(`${label} not found`, 404, "MASTER_NOT_FOUND");
    }
  },
};
