import { success } from "../../core/utils/response.js";
import { caNotificationsService } from "./caNotifications.service.js";

export const caNotificationsController = {
  async getSettings(req, res, next) {
    try {
      const companyId = req.companyId;
      const settings = await caNotificationsService.getSettings(companyId);
      return success(res, { data: settings });
    } catch (err) {
      next(err);
    }
  },

  async updateSettings(req, res, next) {
    try {
      const companyId = req.companyId;
      const settings = await caNotificationsService.updateSettings(companyId, req.body);
      return success(res, {
        data: settings,
        message: "Notification preferences saved successfully",
      });
    } catch (err) {
      next(err);
    }
  },

  async resetSettings(req, res, next) {
    try {
      const companyId = req.companyId;
      const settings = await caNotificationsService.resetSettings(companyId);
      return success(res, {
        data: settings,
        message: "Notification settings reset to defaults",
      });
    } catch (err) {
      next(err);
    }
  },

  async updateTemplate(req, res, next) {
    try {
      const companyId = req.companyId;
      const { key } = req.params;
      const settings = await caNotificationsService.updateTemplate(companyId, key, req.body);
      return success(res, {
        data: settings,
        message: "Notification template updated successfully",
      });
    } catch (err) {
      next(err);
    }
  },
};
