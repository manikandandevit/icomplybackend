import { AppError } from "../../core/errors/AppError.js";
import { MASTER_LABELS } from "./caHrMaster.constants.js";
import { caHrMasterRepository } from "./caHrMaster.repository.js";

const assertRelated = async (companyId, masterType, payload) => {
  if (masterType === "designation") {
    const department = await caHrMasterRepository.findById(payload.relatedId, companyId, "department");
    if (!department) {
      throw new AppError("Selected department not found", 422, "DEPARTMENT_NOT_FOUND");
    }
  }

  if (masterType === "leave-types") {
    const category = await caHrMasterRepository.findById(payload.relatedId, companyId, "leave-category");
    if (!category) {
      throw new AppError("Selected leave category not found", 422, "LEAVE_CATEGORY_NOT_FOUND");
    }
    if (payload.eligibleGenderId) {
      const gender = await caHrMasterRepository.findById(payload.eligibleGenderId, companyId, "gender");
      if (!gender) {
        throw new AppError("Selected gender not found", 422, "GENDER_NOT_FOUND");
      }
    }
  }
};

export const caHrMasterService = {
  list: (companyId, masterType) => caHrMasterRepository.list(companyId, masterType),

  async create(companyId, masterType, payload) {
    const label = MASTER_LABELS[masterType] || "Master";
    await assertRelated(companyId, masterType, payload);

    const duplicate = await caHrMasterRepository.findDuplicateName(
      companyId,
      masterType,
      payload.name,
      null,
      payload.relatedId,
      payload.countryId
    );

    if (duplicate) {
      throw new AppError(`This ${label.toLowerCase()} already exists`, 409, "MASTER_DUPLICATE");
    }

    if (payload.code) {
      const duplicateCode = await caHrMasterRepository.findDuplicateCode(
        companyId,
        masterType,
        payload.code,
        null,
        payload.countryId
      );
      if (duplicateCode) {
        throw new AppError(`This code already exists`, 409, "MASTER_CODE_DUPLICATE");
      }
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

    await assertRelated(companyId, masterType, payload);

    const duplicate = await caHrMasterRepository.findDuplicateName(
      companyId,
      masterType,
      payload.name,
      id,
      payload.relatedId,
      payload.countryId
    );

    if (duplicate) {
      throw new AppError(`This ${label.toLowerCase()} already exists`, 409, "MASTER_DUPLICATE");
    }

    if (payload.code) {
      const duplicateCode = await caHrMasterRepository.findDuplicateCode(
        companyId,
        masterType,
        payload.code,
        id,
        payload.countryId
      );
      if (duplicateCode) {
        throw new AppError(`This code already exists`, 409, "MASTER_CODE_DUPLICATE");
      }
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
