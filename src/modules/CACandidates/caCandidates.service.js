import { caCandidatesRepository } from "./caCandidates.repository.js";
import { AppError } from "../../core/errors/AppError.js";

export const caCandidatesService = {
  async list(companyId, filter = {}) {
    return caCandidatesRepository.list(companyId, filter);
  },

  async create(companyId, payload) {
    return caCandidatesRepository.create(companyId, payload);
  },

  async updateStage(id, companyId, stage, assessmentCount) {
    if (stage === 'Offer') {
      throw new AppError("Candidates cannot be manually moved to Offer stage. Complete interview rounds and mark as Selected in Interview Management.", 400, "MANUAL_OFFER_MOVE_RESTRICTED");
    }
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
