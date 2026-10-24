import { db } from "../../core/db/pool.js";
import { success, fail } from "../../core/utils/response.js";
import { caOnboardingService } from "./caOnboarding.service.js";
import { caOnboardingValidator } from "./caOnboarding.validator.js";

export const caOnboardingController = {
  async list(req, res, next) {
    try {
      const companyId = req.companyId || req.user?.companyId;
      const { status } = req.query;
      let query = `SELECT * FROM public.ca_onboarding WHERE created_by_company_id = $1`;
      const params = [companyId];
      if (status) {
        query += ` AND status = $2`;
        params.push(status);
      }
      query += ` ORDER BY id DESC`;
      const { rows } = await db.query(query, params);
      return success(res, { data: { onboarding: rows } });
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const companyId = req.companyId || req.user?.companyId;
      const { id } = req.params;
      const { rows } = await db.query(
        `SELECT * FROM public.ca_onboarding WHERE id = $1 AND created_by_company_id = $2 LIMIT 1`,
        [id, companyId]
      );
      if (!rows[0]) {
        return res.status(404).json({ message: "Onboarding record not found" });
      }
      return success(res, { data: { onboarding: rows[0] } });
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req, res, next) {
    try {
      const companyId = req.companyId || req.user?.companyId;
      const { id } = req.params;
      const { status } = req.body;
      const { rows } = await db.query(
        `UPDATE public.ca_onboarding SET status = $3, updated_at = NOW() WHERE id = $1 AND created_by_company_id = $2 RETURNING *`,
        [id, companyId, status]
      );
      return success(res, { data: { onboarding: rows[0] } });
    } catch (err) {
      next(err);
    }
  },
  async notifyTask(req, res) {
    try {
      const validationError = caOnboardingValidator.validateNotifyTask(req.body);
      if (validationError) {
        return fail(res, { message: validationError, status: 400 });
      }

      const companyId = req.user?.companyId;
      const result = await caOnboardingService.notifyTask(companyId, req.body);
      return success(res, {
        message: `Notification sent to ${req.body.assigneeName} (${result.assigneeEmail})`,
        data: result,
      });
    } catch (err) {
      console.error("Failed to notify assignee:", err);
      return fail(res, {
        message: "Failed to send email notification to assignee",
        status: 500,
      });
    }
  },

  async notifyBatch(req, res) {
    try {
      const validationError = caOnboardingValidator.validateNotifyBatch(req.body);
      if (validationError) {
        return fail(res, { message: validationError, status: 400 });
      }

      const companyId = req.user?.companyId;
      const results = await caOnboardingService.notifyBatch(companyId, req.body);
      return success(res, {
        message: `Batch notifications processed for ${results.length} assignees`,
        data: { results },
      });
    } catch (err) {
      console.error("Failed to process batch notifications:", err);
      return fail(res, {
        message: "Failed to process batch notifications",
        status: 500,
      });
    }
  },

  async getTemplates(req, res) {
    try {
      const companyId = String(req.user?.companyId || "");
      const templates = await caOnboardingService.getTemplates(companyId);
      return success(res, {
        message: "Templates retrieved successfully",
        data: { templates },
      });
    } catch (err) {
      console.error("Failed to fetch onboarding templates:", err);
      return fail(res, {
        message: "Failed to fetch onboarding templates",
        status: 500,
      });
    }
  },

  async saveTemplates(req, res) {
    try {
      const companyId = String(req.user?.companyId || "");
      if (!companyId) {
        return fail(res, { message: "Invalid company ID", status: 400 });
      }

      const validationError = caOnboardingValidator.validateSaveTemplates(req.body);
      if (validationError) {
        return fail(res, { message: validationError, status: 400 });
      }

      const ok = await caOnboardingService.saveTemplates(companyId, req.body);
      if (!ok) {
        return fail(res, { message: "Failed to save onboarding template", status: 400 });
      }

      return success(res, {
        message: "Template saved to database successfully",
        data: { saved: true },
      });
    } catch (err) {
      console.error("Failed to save onboarding template:", err);
      return fail(res, {
        message: "Failed to save template to database",
        status: 500,
      });
    }
  },

  async getProgress(req, res) {
    try {
      const companyId = String(req.user?.companyId || "");
      const { progress, joiners } = await caOnboardingService.getProgress(companyId);
      return success(res, {
        message: "Joiners progress retrieved successfully",
        data: { progress, joiners },
      });
    } catch (err) {
      console.error("Failed to fetch joiners progress:", err);
      return fail(res, {
        message: "Failed to fetch joiners progress",
        status: 500,
      });
    }
  },

  async saveProgress(req, res) {
    try {
      const companyId = String(req.user?.companyId || "");
      if (!companyId) {
        return fail(res, { message: "Invalid company ID", status: 400 });
      }

      const validationError = caOnboardingValidator.validateSaveProgress(req.body);
      if (validationError) {
        return fail(res, { message: validationError, status: 400 });
      }

      const ok = await caOnboardingService.saveProgress(companyId, req.body);
      if (!ok) {
        return fail(res, { message: "Failed to save joiner progress", status: 400 });
      }

      return success(res, {
        message: "Joiner progress saved successfully",
        data: { saved: true },
      });
    } catch (err) {
      console.error("Failed to save joiner progress:", err);
      return fail(res, {
        message: "Failed to save joiner progress to database",
        status: 500,
      });
    }
  },
};
