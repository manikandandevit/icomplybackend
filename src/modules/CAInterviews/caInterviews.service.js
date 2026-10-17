import { caInterviewsRepository } from "./caInterviews.repository.js";

export const caInterviewsService = {
  async list(companyId) {
    return caInterviewsRepository.list(companyId);
  },

  async create(companyId, payload) {
    return caInterviewsRepository.create(companyId, payload);
  },

  async update(id, companyId, payload) {
    return caInterviewsRepository.update(id, companyId, payload);
  },

  async updateStatus(id, companyId, status) {
    return caInterviewsRepository.updateStatus(id, companyId, status);
  },

  async submitFeedback(id, companyId, payload) {
    return caInterviewsRepository.submitFeedback(id, companyId, payload);
  },

  async delete(id, companyId) {
    return caInterviewsRepository.delete(id, companyId);
  }
};
