import { db } from "../../core/db/pool.js";
import { success, fail } from "../../core/utils/response.js";
import { caOnboardingService } from "./caOnboarding.service.js";
import { caOnboardingValidator } from "./caOnboarding.validator.js";

export const caOnboardingController = {
  async list(req, res, next) {
    try {
      const companyId = req.companyId || req.user?.companyId;

      // Auto-sync any accepted candidates/offers into ca_onboarding
      try {
        await db.query(`ALTER TABLE public.ca_candidates ADD COLUMN IF NOT EXISTS department VARCHAR(255);`);
        await db.query(`ALTER TABLE public.ca_offers ADD COLUMN IF NOT EXISTS department VARCHAR(255);`);

        const acceptedCandidates = await db.query(
          `SELECT c.id as candidate_id, COALESCE(c.name, o.candidate_name) as name, COALESCE(c.email, o.email) as email,
                  COALESCE(c.phone, o.phone) as phone, COALESCE(c.role, o.role) as role, COALESCE(c.location, o.location) as location,
                  c.establishment_id, c.establishment_name,
                  o.id as offer_id, o.ctc, o.joining_bonus, o.joining_date, o.hiring_manager,
                  c.department, o.documents
           FROM public.ca_offers o
           FULL OUTER JOIN public.ca_candidates c ON o.candidate_id = c.id
           WHERE (c.created_by_company_id = $1 OR o.created_by_company_id = $1)
             AND (
               LOWER(TRIM(COALESCE(c.stage, ''))) IN ('offer acceptance', 'hired', 'accepted', 'onboarding')
               OR LOWER(TRIM(COALESCE(o.status, ''))) IN ('accepted', 'offer accepted')
             )`,
          [companyId]
        );

        for (const cand of acceptedCandidates.rows) {
          const candName = cand.name ? cand.name.trim() : "";
          if (!candName) continue;

          const exists = await db.query(
            `SELECT id FROM public.ca_onboarding 
             WHERE (
               (candidate_id = $1 AND candidate_id IS NOT NULL) 
               OR (offer_id = $2 AND offer_id IS NOT NULL)
               OR (candidate_name IS NOT NULL AND LOWER(TRIM(candidate_name)) = LOWER(TRIM($3)))
             )
             AND created_by_company_id = $4 LIMIT 1`,
            [cand.candidate_id, cand.offer_id, candName, companyId]
          );

          if (!exists.rows[0]) {
            await db.query(
              `INSERT INTO public.ca_onboarding (
                candidate_id, offer_id, candidate_name, email, phone, role, ctc,
                joining_bonus, joining_date, location, establishment_id, establishment_name,
                manager_name, department, status, documents, created_by_company_id, created_at, updated_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12,
                $13, $14, 'Pending Onboarding', $15, $16, NOW(), NOW()
              )`,
              [
                cand.candidate_id || null,
                cand.offer_id || null,
                candName,
                cand.email || "",
                cand.phone || "",
                cand.role || "",
                cand.ctc || "",
                cand.joining_bonus || "",
                cand.joining_date || "Upcoming",
                cand.location || "",
                cand.establishment_id || null,
                cand.establishment_name || "",
                cand.hiring_manager || "",
                cand.department || "",
                JSON.stringify(cand.documents || []),
                companyId,
              ]
            );
          } else {
            // Update offer_id, candidate_id, joining_date if missing
            await db.query(
              `UPDATE public.ca_onboarding 
               SET offer_id = COALESCE(offer_id, $1),
                   candidate_id = COALESCE(candidate_id, $2),
                   joining_date = CASE WHEN joining_date IS NULL OR joining_date = 'Upcoming' THEN COALESCE($3, joining_date) ELSE joining_date END,
                   updated_at = NOW()
               WHERE id = $4`,
              [cand.offer_id || null, cand.candidate_id || null, cand.joining_date || null, exists.rows[0].id]
            );
          }
        }
      } catch (syncErr) {
        console.warn("Could not auto-sync accepted candidates to ca_onboarding:", syncErr?.message);
      }

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
