import { success, fail } from "../../core/utils/response.js";
import { caOffersService } from "./caOffers.service.js";
import { caOffersValidator } from "./caOffers.validator.js";

export const caOffersController = {
  async list(req, res, next) {
    try {
      const companyId = req.companyId || req.user?.companyId;
      const { status } = req.query;
      const offers = await caOffersService.list(companyId, status);
      return success(res, { data: { offers } });
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const companyId = req.companyId || req.user?.companyId;
      const { id } = req.params;
      const offer = await caOffersService.getById(id, companyId);
      if (!offer) {
        return fail(res, { message: "Offer not found", status: 404 });
      }
      return success(res, { data: { offer } });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const companyId = req.companyId || req.user?.companyId;
      const validationError = caOffersValidator.validateCreate(req.body);
      if (validationError) {
        return fail(res, { message: validationError, status: 400 });
      }
      const offer = await caOffersService.create(companyId, req.body);
      return success(res, { data: { offer }, status: 201 });
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req, res, next) {
    try {
      const companyId = req.companyId || req.user?.companyId;
      const { id } = req.params;
      const { status } = req.body;
      const validationError = caOffersValidator.validateUpdateStatus(status);
      if (validationError) {
        return fail(res, { message: validationError, status: 400 });
      }
      const offer = await caOffersService.updateStatus(id, companyId, status);
      return success(res, { data: { offer } });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const companyId = req.companyId || req.user?.companyId;
      const { id } = req.params;
      const offer = await caOffersService.update(id, companyId, req.body);
      return success(res, { data: { offer } });
    } catch (err) {
      next(err);
    }
  },

  async delete(req, res, next) {
    try {
      const companyId = req.companyId || req.user?.companyId;
      const { id } = req.params;
      await caOffersService.delete(id, companyId);
      return success(res, { message: "Offer deleted successfully" });
    } catch (err) {
      next(err);
    }
  },
};
