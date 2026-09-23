import { caStatutoryConfigRepository } from "./caStatutoryConfig.repository.js";
import { AppError } from "../../core/errors/AppError.js";

export const caStatutoryConfigService = {
  async list(companyId) {
    const data = await caStatutoryConfigRepository.list(companyId);
    return { data };
  },

  async save(companyId, payload) {
    if (!payload.countryId || !payload.establishmentId || !payload.statutoryName) {
      return { error: new AppError("Missing required fields", 400) };
    }

    const data = await caStatutoryConfigRepository.save(companyId, payload);
    return { data, message: "Statutory configuration saved successfully" };
  },

  async delete(companyId, id) {
    const success = await caStatutoryConfigRepository.delete(id, companyId);
    if (!success) {
      return { error: new AppError("Failed to delete configuration or not found", 404) };
    }
    return { message: "Configuration deleted successfully" };
  }
};
