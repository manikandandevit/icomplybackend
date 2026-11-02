import { db } from "../../core/db/pool.js";
import {
  caOnboardingTemplateTableSql,
  caOnboardingJoinerProgressTableSql,
} from "./caOnboarding.constants.js";

let ready = null;
const ensureTables = async () => {
  if (!ready) {
    ready = (async () => {
      try {
        await db.query(caOnboardingTemplateTableSql);
        for (const sql of caOnboardingJoinerProgressTableSql.split(";").map((s) => s.trim()).filter(Boolean)) {
          await db.query(sql);
        }
      } catch (err) {
        console.warn("Could not ensure CAOnboarding tables:", err);
      }
    })();
  }
  return ready;
};

export const caOnboardingRepository = {
  async findAssigneeDetails(companyId, assigneeName) {
    if (!assigneeName) return null;
    const cleanName = assigneeName.trim().toLowerCase();
    const cid = Number(companyId) || 0;

    try {
      // 1. Check in ca_users for current company
      if (cid > 0) {
        const userRes = await db.query(
          `SELECT id, email, name, role FROM public.ca_users 
           WHERE created_by_company_id = $1 AND lower(name) ILIKE $2
           LIMIT 1`,
          [cid, `%${cleanName}%`]
        );
        if (userRes.rows.length > 0 && userRes.rows[0].email) {
          return {
            id: userRes.rows[0].id,
            name: userRes.rows[0].name,
            email: userRes.rows[0].email,
            userType: "admin",
            companyId: cid,
          };
        }

        // 2. Check in ca_employees for current company
        const empRes = await db.query(
          `SELECT id, email, name FROM public.ca_employees 
           WHERE (company_id = $1 OR created_by_company_id = $1) AND lower(name) ILIKE $2
           LIMIT 1`,
          [cid, `%${cleanName}%`]
        );
        if (empRes.rows.length > 0 && empRes.rows[0].email) {
          return {
            id: empRes.rows[0].id,
            name: empRes.rows[0].name,
            email: empRes.rows[0].email,
            userType: "employee",
            companyId: cid,
          };
        }
      }

      // 3. Global fallback for employees across any company (e.g. Sneha Iyer, Priya Menon)
      const globalEmpRes = await db.query(
        `SELECT id, email, name, company_id FROM public.ca_employees 
         WHERE lower(name) ILIKE $1
         LIMIT 1`,
        [`%${cleanName}%`]
      );
      if (globalEmpRes.rows.length > 0 && globalEmpRes.rows[0].email) {
        return {
          id: globalEmpRes.rows[0].id,
          name: globalEmpRes.rows[0].name,
          email: globalEmpRes.rows[0].email,
          userType: "employee",
          companyId: globalEmpRes.rows[0].company_id,
        };
      }

      // 4. Global fallback for users
      const globalUserRes = await db.query(
        `SELECT id, email, name, role, created_by_company_id FROM public.ca_users 
         WHERE lower(name) ILIKE $1
         LIMIT 1`,
        [`%${cleanName}%`]
      );
      if (globalUserRes.rows.length > 0 && globalUserRes.rows[0].email) {
        return {
          id: globalUserRes.rows[0].id,
          name: globalUserRes.rows[0].name,
          email: globalUserRes.rows[0].email,
          userType: "admin",
          companyId: globalUserRes.rows[0].created_by_company_id,
        };
      }
    } catch (dbErr) {
      console.warn("Could not find assignee in DB:", dbErr);
    }

    return null;
  },

  async findAssigneeEmail(companyId, assigneeName) {
    const details = await this.findAssigneeDetails(companyId, assigneeName);
    return details?.email || "";
  },

  async getTemplates(companyId) {
    await ensureTables();
    const rows = await db.query(
      `SELECT template_key, sections FROM public.ca_onboarding_templates WHERE company_id = $1`,
      [companyId]
    );

    const templates = {};
    rows.rows.forEach((r) => {
      templates[r.template_key] = r.sections;
    });
    return templates;
  },

  async saveTemplates(companyId, { templates, templateKey, sections }) {
    await ensureTables();

    // Case 1: Bulk object { templates: { India: [...], Singapore: [...] } }
    if (templates && typeof templates === "object") {
      for (const [key, sec] of Object.entries(templates)) {
        await db.query(
          `INSERT INTO public.ca_onboarding_templates (company_id, template_key, sections, updated_at)
           VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (company_id, template_key)
           DO UPDATE SET sections = EXCLUDED.sections, updated_at = CURRENT_TIMESTAMP`,
          [companyId, key, JSON.stringify(sec)]
        );
      }
      return true;
    }

    // Case 2: Specific single templateKey { templateKey: "India__MDS Tech", sections: [...] }
    if (templateKey && Array.isArray(sections)) {
      await db.query(
        `INSERT INTO public.ca_onboarding_templates (company_id, template_key, sections, updated_at)
         VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (company_id, template_key)
         DO UPDATE SET sections = EXCLUDED.sections, updated_at = CURRENT_TIMESTAMP`,
        [companyId, templateKey, JSON.stringify(sections)]
      );
      return true;
    }

    return false;
  },

  async getProgress(companyId) {
    await ensureTables();
    const rows = await db.query(
      `SELECT candidate_id, sections, candidate_data FROM public.ca_onboarding_joiner_progress WHERE company_id = $1`,
      [companyId]
    );

    const progress = {};
    const customJoiners = [];
    rows.rows.forEach((r) => {
      progress[r.candidate_id] = r.sections;
      if (r.candidate_data) {
        customJoiners.push({
          ...r.candidate_data,
          id: r.candidate_id,
          sections: r.sections,
        });
      }
    });

    return { progress, joiners: customJoiners };
  },

  async saveProgress(companyId, { candidateId, sections, allProgress, candidateData }) {
    await ensureTables();

    // Case 1: Bulk object { allProgress: { "OFFER-1": [...], "OFFER-2": [...] } }
    if (allProgress && typeof allProgress === "object") {
      for (const [cId, secList] of Object.entries(allProgress)) {
        if (!cId || !Array.isArray(secList)) continue;
        await db.query(
          `INSERT INTO public.ca_onboarding_joiner_progress (company_id, candidate_id, sections, updated_at)
           VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (company_id, candidate_id)
           DO UPDATE SET sections = EXCLUDED.sections, updated_at = CURRENT_TIMESTAMP`,
          [companyId, String(cId), JSON.stringify(secList)]
        );
      }
      return true;
    }

    // Case 2: Single candidate update { candidateId: "JOINER-xxx", sections: [...], candidateData: {...} }
    if (candidateId && Array.isArray(sections)) {
      await db.query(
        `INSERT INTO public.ca_onboarding_joiner_progress (company_id, candidate_id, sections, candidate_data, updated_at)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (company_id, candidate_id)
         DO UPDATE SET 
           sections = EXCLUDED.sections,
           candidate_data = COALESCE(EXCLUDED.candidate_data, ca_onboarding_joiner_progress.candidate_data),
           updated_at = CURRENT_TIMESTAMP`,
        [
          companyId,
          String(candidateId),
          JSON.stringify(sections),
          candidateData ? JSON.stringify(candidateData) : null,
        ]
      );
      return true;
    }

    return false;
  },
};
