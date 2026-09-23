import { caStatutoryConfigService } from "./caStatutoryConfig.service.js";
import { success } from "../../core/utils/response.js";

export const caStatutoryConfigController = {
  async list(req, res, next) {
    try {
      const companyId = req.user.companyId;
      const { data, error } = await caStatutoryConfigService.list(companyId);
      if (error) return next(error);
      return success(res, { data });
    } catch (err) {
      return next(err);
    }
  },

  async save(req, res, next) {
    try {
      const companyId = req.user.companyId;
      const { data, message, error } = await caStatutoryConfigService.save(companyId, req.body);
      if (error) return next(error);
      return success(res, { data, message });
    } catch (err) {
      return next(err);
    }
  },

  async delete(req, res, next) {
    try {
      const companyId = req.user.companyId;
      const { id } = req.params;
      const { message, error } = await caStatutoryConfigService.delete(companyId, id);
      if (error) return next(error);
      return success(res, { message });
    } catch (err) {
      return next(err);
    }
  }
};
