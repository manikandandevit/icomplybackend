import { caInterviewsRepository } from "./caInterviews.repository.js";

export const caInterviewsService = {
  async list(companyId) {
    return caInterviewsRepository.list(companyId);
  },

  async create(companyId, payload) {
    return caInterviewsRepository.create(companyId, payload);
  }
};
