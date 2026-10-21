import { success, fail } from "../../core/utils/response.js";
import { caOffboardingService } from "./caOffboarding.service.js";
import { caOffboardingValidator } from "./caOffboarding.validator.js";

export const caOffboardingController = {
  async listExits(req, res) {
    try {
      const companyId = req.user?.companyId;
      const exits = await caOffboardingService.listExits(companyId);
      return success(res, {
        message: "Offboarding exits loaded",
        data: { exits },
      });
    } catch (err) {
      console.error("Error fetching offboarding exits:", err);
      return fail(res, { message: "Failed to load exits", status: 500 });
    }
  },

  async initiate(req, res) {
    try {
      const companyId = req.user?.companyId;
      const validationError = caOffboardingValidator.validateInitiate(req.body);
      if (validationError) {
        return fail(res, { message: validationError, status: 400 });
      }

      const exit = await caOffboardingService.initiate(companyId, req.body);
      return success(res, {
        message: "Employee offboarding initiated successfully",
        data: { exit },
      });
    } catch (err) {
      console.error("Error initiating offboarding:", err);
      const status = err.statusCode || 500;
      return fail(res, { message: err.message || "Failed to initiate offboarding", status });
    }
  },

  async updateSections(req, res) {
    try {
      const companyId = req.user?.companyId;
      const { sections } = req.body;
      const validationError = caOffboardingValidator.validateSections(sections);
      if (validationError) {
        return fail(res, { message: validationError, status: 400 });
      }

      const updated = await caOffboardingService.updateSections(req.params.id, companyId, sections);
      return success(res, {
        message: "Checklist updated successfully",
        data: { updated },
      });
    } catch (err) {
      console.error("Error updating offboarding sections:", err);
      return fail(res, { message: "Failed to update checklist", status: 500 });
    }
  },

  async completeExit(req, res) {
    try {
      const companyId = req.user?.companyId;
      const completed = await caOffboardingService.completeExit(req.params.id, companyId);
      return success(res, {
        message: "Exit completed and candidate successfully moved to Alumni",
        data: { exit: completed },
      });
    } catch (err) {
      console.error("Error completing exit:", err);
      const status = err.statusCode || 500;
      return fail(res, { message: err.message || "Failed to complete exit", status });
    }
  },

  async getTemplates(req, res) {
    try {
      const companyId = req.user?.companyId;
      const templates = await caOffboardingService.getTemplates(companyId);
      return success(res, {
        message: "Offboarding templates retrieved successfully",
        data: { templates },
      });
    } catch (err) {
      console.error("Failed to fetch offboarding templates:", err);
      return fail(res, { message: "Failed to fetch offboarding templates", status: 500 });
    }
  },

  async saveTemplates(req, res) {
    try {
      const companyId = req.user?.companyId;
      const validationError = caOffboardingValidator.validateSaveTemplates(req.body);
      if (validationError) {
        return fail(res, { message: validationError, status: 400 });
      }

      const ok = await caOffboardingService.saveTemplates(companyId, req.body);
      if (!ok) {
        return fail(res, { message: "Failed to save offboarding templates", status: 400 });
      }
      return success(res, {
        message: "Offboarding template saved successfully",
        data: { saved: true },
      });
    } catch (err) {
      console.error("Failed to save offboarding templates:", err);
      return fail(res, { message: "Failed to save offboarding templates", status: 500 });
    }
  },
};
