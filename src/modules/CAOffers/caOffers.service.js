import { caOffersRepository } from "./caOffers.repository.js";

export const caOffersService = {
  async list(companyId, status) {
    return caOffersRepository.list(companyId, status);
  },

  async getById(id, companyId) {
    return caOffersRepository.getById(id, companyId);
  },

  async create(companyId, data) {
    return caOffersRepository.create(companyId, data);
  },

  async updateStatus(id, companyId, status) {
    return caOffersRepository.updateStatus(id, companyId, status);
  },

  async update(id, companyId, data) {
    return caOffersRepository.update(id, companyId, data);
  },

  async delete(id, companyId) {
    return caOffersRepository.delete(id, companyId);
  },
};
