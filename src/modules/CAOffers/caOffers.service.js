import { caOffersRepository } from "./caOffers.repository.js";
import { caCandidatesService } from "../CACandidates/caCandidates.service.js";
import { AppError } from "../../core/errors/AppError.js";

export const caOffersService = {
  async list(companyId, filter = {}) {
    return caOffersRepository.list(companyId, filter);
  },

  async getById(id, companyId) {
    const offer = await caOffersRepository.getById(id, companyId);
    if (!offer) {
      throw new AppError("Offer not found or unauthorized", 404, "NOT_FOUND");
    }
    return offer;
  },

  async create(companyId, payload) {
    const offer = await caOffersRepository.create(companyId, payload);
    // If created with candidateId, update candidate stage to 'Offer'
    if (payload.candidateId) {
      try {
        await caCandidatesService.updateStage(payload.candidateId, companyId, 'Offer');
      } catch (e) {
        console.warn("Could not sync candidate stage to Offer:", e.message);
      }
    }
    return offer;
  },

  async updateStatus(id, companyId, status) {
    const updated = await caOffersRepository.updateStatus(id, companyId, status);
    if (!updated) {
      throw new AppError("Offer not found or unauthorized", 404, "NOT_FOUND");
    }
    // If accepted, optionally update candidate stage to 'Hired'
    if (status === 'Accepted' && updated.candidateId) {
      try {
        await caCandidatesService.updateStage(updated.candidateId, companyId, 'Hired');
      } catch (e) {
        console.warn("Could not sync candidate to Hired:", e.message);
      }
    }
    return updated;
  },

  async update(id, companyId, payload) {
    const updated = await caOffersRepository.update(id, companyId, payload);
    if (!updated) {
      throw new AppError("Offer not found or unauthorized", 404, "NOT_FOUND");
    }
    return updated;
  },

  async delete(id, companyId) {
    const deleted = await caOffersRepository.delete(id, companyId);
    if (!deleted) {
      throw new AppError("Offer not found or unauthorized", 404, "NOT_FOUND");
    }
    return true;
  }
};
