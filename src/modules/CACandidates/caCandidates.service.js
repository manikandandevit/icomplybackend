import { caCandidatesRepository } from "./caCandidates.repository.js";
import { AppError } from "../../core/errors/AppError.js";

export const caCandidatesService = {
  async list(companyId) {
    return caCandidatesRepository.list(companyId);
  },

  async create(companyId, payload) {
    return caCandidatesRepository.create(companyId, payload);
  },

  async updateStage(id, companyId, stage, assessmentCount) {
    const updated = await caCandidatesRepository.updateStage(id, companyId, stage, assessmentCount);
    if (!updated) {
      throw new AppError("Candidate not found or unauthorized", 404, "NOT_FOUND");
    }
    return updated;
  },

  async addNote(id, companyId, text) {
    const updated = await caCandidatesRepository.addNote(id, companyId, text);
    if (!updated) {
      throw new AppError("Candidate not found or unauthorized", 404, "NOT_FOUND");
    }
    return updated;
  },

  async delete(id, companyId) {
    const deleted = await caCandidatesRepository.delete(id, companyId);
    if (!deleted) {
      throw new AppError("Candidate not found or unauthorized", 404, "NOT_FOUND");
    }
    return true;
  }
};
