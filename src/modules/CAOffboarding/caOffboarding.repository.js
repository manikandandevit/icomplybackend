import { db } from "../../core/db/pool.js";
import {
  caOffboardingTableSql,
  caOffboardingIndexSql,
  caOffboardingTemplateTableSql,
} from "./caOffboarding.constants.js";

let ready = null;

const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caOffboardingTableSql);
      for (const statement of caOffboardingIndexSql
        .split(";")
        .map((sql) => sql.trim())
        .filter(Boolean)) {
        await db.query(statement);
      }
      await db.query(caOffboardingTemplateTableSql);
    })();
  }
  return ready;
};

const parseRowId = (id) => {
  const n = Number.parseInt(String(id ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export const caOffboardingRepository = {
  async list(companyId) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return [];

    const { rows } = await db.query(
      `
      SELECT 
        id,
        employee_id,
        employee_code,
        employee_name,
        role,
        department,
        country_code,
        country_name,
        resignation_date,
        last_working_day,
        reason,
        status,
        sections,
        is_urgent,
        created_at,
        updated_at
      FROM public.ca_offboarding_exits
      WHERE created_by_company_id = $1
      ORDER BY id DESC
      `,
      [cid]
    );

    return rows.map((r) => ({
      id: `EXIT-${r.id}`,
      exitId: r.id,
      employeeId: String(r.employee_id),
      employeeCode: r.employee_code,
      name: r.employee_name,
      role: r.role || "Employee",
      department: r.department || "",
      countryCode: r.country_code || "IN",
      countryName: r.country_name || "India",
      resignationDate: r.resignation_date ? new Date(r.resignation_date).toISOString().split("T")[0] : "",
      lastDay: r.last_working_day ? new Date(r.last_working_day).toISOString().split("T")[0] : "",
      reason: r.reason || "",
      status: r.status,
      isUrgent: Boolean(r.is_urgent),
      sections: Array.isArray(r.sections) ? r.sections : [],
      initials: String(r.employee_name || "")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() || "")
        .join(""),
      avatarBg: "bg-orange-100 text-[#ea580c]",
    }));
  },

  async create(companyId, payload) {
    await ensureTable();
    const cid = parseRowId(companyId);
    const empId = parseRowId(payload.employeeId);
    if (!cid || !empId) return null;

    const { rows } = await db.query(
      `
      INSERT INTO public.ca_offboarding_exits (
        employee_id,
        employee_code,
        employee_name,
        role,
        department,
        country_code,
        country_name,
        resignation_date,
        last_working_day,
        reason,
        status,
        sections,
        is_urgent,
        created_by_company_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14)
      RETURNING id
      `,
      [
        empId,
        payload.employeeCode || "",
        payload.employeeName || "",
        payload.role || "Employee",
        payload.department || "",
        payload.countryCode || "IN",
        payload.countryName || "India",
        payload.resignationDate || new Date(),
        payload.lastWorkingDay || payload.resignationDate || new Date(),
        payload.reason || "",
        "In Progress",
        JSON.stringify(payload.sections || []),
        Boolean(payload.isUrgent),
        cid,
      ]
    );

    return rows[0] || null;
  },

  async updateSections(id, companyId, sections) {
    await ensureTable();
    const cid = parseRowId(companyId);
    const exitId = parseRowId(String(id).replace("EXIT-", ""));
    if (!cid || !exitId) return false;

    const { rowCount } = await db.query(
      `
      UPDATE public.ca_offboarding_exits
      SET sections = $3::jsonb, updated_at = NOW()
      WHERE id = $1 AND created_by_company_id = $2
      `,
      [exitId, cid, JSON.stringify(sections)]
    );

    return rowCount > 0;
  },

  async completeExit(id, companyId) {
    await ensureTable();
    const cid = parseRowId(companyId);
    const exitId = parseRowId(String(id).replace("EXIT-", ""));
    if (!cid || !exitId) return null;

    const { rows } = await db.query(
      `
      UPDATE public.ca_offboarding_exits
      SET status = 'Completed', updated_at = NOW()
      WHERE id = $1 AND created_by_company_id = $2
      RETURNING *
      `,
      [exitId, cid]
    );

    return rows[0] || null;
  },

  async getTemplates(companyId) {
    await ensureTable();
    const cid = String(companyId || "");
    if (!cid) return {};

    const { rows } = await db.query(
      `SELECT template_key, sections FROM public.ca_offboarding_templates WHERE company_id = $1`,
      [cid]
    );

    const templates = {};
    rows.forEach((r) => {
      templates[r.template_key] = r.sections;
    });
    return templates;
  },

  async saveTemplates(companyId, { templates, templateKey, sections }) {
    await ensureTable();
    const cid = String(companyId || "");
    if (!cid) return false;

    if (templates && typeof templates === "object") {
      for (const [key, sec] of Object.entries(templates)) {
        await db.query(
          `INSERT INTO public.ca_offboarding_templates (company_id, template_key, sections, updated_at)
           VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (company_id, template_key)
           DO UPDATE SET sections = EXCLUDED.sections, updated_at = CURRENT_TIMESTAMP`,
          [cid, key, JSON.stringify(sec)]
        );
      }
      return true;
    } else if (templateKey && Array.isArray(sections)) {
      await db.query(
        `INSERT INTO public.ca_offboarding_templates (company_id, template_key, sections, updated_at)
         VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (company_id, template_key)
         DO UPDATE SET sections = EXCLUDED.sections, updated_at = CURRENT_TIMESTAMP`,
        [cid, templateKey, JSON.stringify(sections)]
      );
      return true;
    }
    return false;
  },
};
