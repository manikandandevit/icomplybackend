import { db } from "../../core/db/pool.js";
import { success } from "../../core/utils/response.js";

export const caOnboardingController = {
  async list(req, res, next) {
    try {
      const companyId = req.companyId;
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
      const companyId = req.companyId;
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
      const companyId = req.companyId;
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
  }
};
