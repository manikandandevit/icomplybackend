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
      `SELECT candidate_id, sections, candidate_data, updated_at 
       FROM public.ca_onboarding_joiner_progress 
       WHERE company_id = $1 
       ORDER BY updated_at ASC`,
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

  async syncCandidateAndOnboardingTables(companyId, candidateId, sections, candidateData) {
    try {
      const cid = Number(companyId) || 0;
      const rawIdStr = String(candidateId || "").trim();
      const cleanNum = parseInt(rawIdStr.replace(/\D/g, ""), 10) || 0;
      const nameStr = String(candidateData?.name || (isNaN(Number(rawIdStr)) && !rawIdStr.startsWith("CAND-") && !rawIdStr.startsWith("ONB-") ? rawIdStr : "")).trim();

      // Calculate progress stats
      let totalTasks = 0;
      let completedTasks = 0;
      (sections || []).forEach((sec) => {
        (sec.tasks || []).forEach((t) => {
          totalTasks++;
          if (t.completed) completedTasks++;
        });
      });

      const percent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      const computedStatus =
        totalTasks > 0 && completedTasks === totalTasks
          ? "Completed"
          : completedTasks > 0
          ? "In Progress"
          : "Pending Onboarding";

      const progressJson = JSON.stringify({
        totalTasks,
        completedTasks,
        percent,
        sections,
        lastUpdated: new Date().toISOString(),
      });

      // 1. Update public.ca_onboarding
      if (cid > 0) {
        await db.query(
          `UPDATE public.ca_onboarding
           SET status = CASE WHEN status = 'Completed' AND $1 != 'Completed' THEN status ELSE $1 END,
               onboarding_data = jsonb_set(
                 COALESCE(onboarding_data, '{}'::jsonb),
                 '{progress}',
                 $2::jsonb
               ),
               updated_at = CURRENT_TIMESTAMP
           WHERE created_by_company_id = $3
             AND (
               ($4 > 0 AND (candidate_id = $4 OR id = $4))
               OR ($5 <> '' AND LOWER(TRIM(candidate_name)) = LOWER($5))
             )`,
          [computedStatus, progressJson, cid, cleanNum, nameStr]
        );

        // 2. Update public.ca_candidates
        await db.query(
          `UPDATE public.ca_candidates
           SET pre_joining_checklist = $1::jsonb,
               updated_at = CURRENT_TIMESTAMP
           WHERE created_by_company_id = $2
             AND (
               ($3 > 0 AND id = $3)
               OR ($4 <> '' AND LOWER(TRIM(name)) = LOWER($4))
             )`,
          [JSON.stringify(sections), cid, cleanNum, nameStr]
        );
      }
    } catch (err) {
      console.warn("Could not sync candidate tables on onboarding progress save:", err?.message || err);
    }
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
        await this.syncCandidateAndOnboardingTables(companyId, cId, secList, null);
      }
      return true;
    }

    // Case 2: Single candidate update { candidateId: "JOINER-xxx", sections: [...], candidateData: {...} }
    if (candidateId && Array.isArray(sections)) {
      const rawIdStr = String(candidateId).trim();
      const cleanNum = parseInt(rawIdStr.replace(/\D/g, ""), 10) || 0;
      const nameStr = String(candidateData?.name || "").trim();

      const aliasKeys = new Set([rawIdStr]);
      if (cleanNum > 0) {
        aliasKeys.add(String(cleanNum));
        aliasKeys.add(`CAND-${cleanNum}`);
      }
      if (nameStr) {
        aliasKeys.add(nameStr);
      }

      // Check ca_onboarding to find associated IDs and names
      try {
        const onbCheck = await db.query(
          `SELECT id, candidate_id, candidate_name FROM public.ca_onboarding 
           WHERE created_by_company_id = $1 
             AND (($2 > 0 AND (candidate_id = $2 OR id = $2)) OR ($3 <> '' AND LOWER(TRIM(candidate_name)) = LOWER($3)))`,
          [Number(companyId) || 0, cleanNum, nameStr]
        );
        onbCheck.rows.forEach((r) => {
          if (r.id) aliasKeys.add(`ONB-${r.id}`);
          if (r.candidate_id) {
            aliasKeys.add(String(r.candidate_id));
            aliasKeys.add(`CAND-${r.candidate_id}`);
          }
          if (r.candidate_name) aliasKeys.add(r.candidate_name.trim());
        });
      } catch (onbErr) {
        // non-fatal
      }

      for (const alias of aliasKeys) {
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
            String(alias),
            JSON.stringify(sections),
            candidateData ? JSON.stringify(candidateData) : null,
          ]
        );
      }
      await this.syncCandidateAndOnboardingTables(companyId, candidateId, sections, candidateData);
      return true;
    }

    return false;
  },
};
