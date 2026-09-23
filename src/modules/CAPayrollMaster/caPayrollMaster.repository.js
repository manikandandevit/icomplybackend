import { db } from "../../core/db/pool.js";
import { caPayrollMasterIndexSql, caPayrollMasterTableSql, mapPayrollComponent } from "./caPayrollMaster.constants.js";

let ready = null;

const parseRowId = (id) => {
  const n = Number.parseInt(String(id ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caPayrollMasterTableSql);
      for (const sql of caPayrollMasterIndexSql.split(";").map((s) => s.trim()).filter(Boolean)) {
        await db.query(sql);
      }
      await db.query(`ALTER TABLE public.ca_payroll_components ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'Earning';`);
      await db.query(`ALTER TABLE public.ca_payroll_components ADD COLUMN IF NOT EXISTS ctc_impact TEXT NOT NULL DEFAULT 'Add';`);
      await db.query(`ALTER TABLE public.ca_payroll_components ADD COLUMN IF NOT EXISTS country_id TEXT;`);
      await db.query(`ALTER TABLE public.ca_payroll_components ADD COLUMN IF NOT EXISTS country_name TEXT;`);
      await db.query(`ALTER TABLE public.ca_payroll_components ADD COLUMN IF NOT EXISTS calculation_type TEXT NOT NULL DEFAULT 'Percentage';`);
      await db.query(`ALTER TABLE public.ca_payroll_components ADD COLUMN IF NOT EXISTS fixed_amount NUMERIC NOT NULL DEFAULT 0;`);
      await db.query(`ALTER TABLE public.ca_payroll_components ADD COLUMN IF NOT EXISTS condition_max_salary NUMERIC NOT NULL DEFAULT 0;`);
      await db.query(`ALTER TABLE public.ca_payroll_components ADD COLUMN IF NOT EXISTS max_cap_amount NUMERIC NOT NULL DEFAULT 0;`);
      await db.query(`ALTER TABLE public.ca_payroll_components ADD COLUMN IF NOT EXISTS depends_on TEXT NOT NULL DEFAULT 'CTC';`);
    })();
  }
  return ready;
};

export const caPayrollMasterRepository = {
  async list(companyId) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return [];
    const { rows } = await db.query(
      `SELECT id, name, type, ctc_impact, percentage, country_id, country_name, calculation_type, fixed_amount, condition_max_salary, max_cap_amount, establishment_id, establishment_name, depends_on, created_at
       FROM public.ca_payroll_components
       WHERE created_by_company_id = $1
       ORDER BY id DESC`,
      [cid]
    );
    return rows.map(mapPayrollComponent);
  },

  async findById(id, companyId) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return null;
    const { rows } = await db.query(
      `SELECT id, name, type, ctc_impact, percentage, country_id, country_name, calculation_type, fixed_amount, condition_max_salary, max_cap_amount, establishment_id, establishment_name, depends_on, created_at
       FROM public.ca_payroll_components
       WHERE id = $1 AND created_by_company_id = $2
       LIMIT 1`,
      [rowId, cid]
    );
    return rows[0] ? mapPayrollComponent(rows[0]) : null;
  },

  async create(companyId, payload) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return null;
    const { rows } = await db.query(
      `INSERT INTO public.ca_payroll_components
         (name, type, ctc_impact, percentage, country_id, country_name, calculation_type, fixed_amount, condition_max_salary, max_cap_amount, establishment_id, establishment_name, depends_on, created_by_company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [
        payload.name,
        payload.type || "Earning",
        payload.ctcImpact || "Add",
        Number(payload.percentage) || 0,
        payload.countryId || null,
        payload.countryName || null,
        payload.calculationType || "Percentage",
        Number(payload.fixedAmount) || 0,
        Number(payload.conditionMaxSalary) || 0,
        Number(payload.maxCapAmount) || 0,
        parseRowId(payload.establishmentId),
        payload.establishmentName || null,
        payload.dependsOn || "CTC",
        cid,
      ]
    );
    return this.findById(rows[0].id, companyId);
  },

  async update(id, companyId, payload) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return null;
    const { rows } = await db.query(
      `UPDATE public.ca_payroll_components
       SET name = $3, type = $4, ctc_impact = $5, percentage = $6, country_id = $7, country_name = $8, calculation_type = $9, fixed_amount = $10, condition_max_salary = $11, max_cap_amount = $12, establishment_id = $13, establishment_name = $14, depends_on = $15, updated_at = NOW()
       WHERE id = $1 AND created_by_company_id = $2
       RETURNING id`,
      [
        rowId,
        cid,
        payload.name,
        payload.type || "Earning",
        payload.ctcImpact || "Add",
        Number(payload.percentage) || 0,
        payload.countryId || null,
        payload.countryName || null,
        payload.calculationType || "Percentage",
        Number(payload.fixedAmount) || 0,
        Number(payload.conditionMaxSalary) || 0,
        Number(payload.maxCapAmount) || 0,
        parseRowId(payload.establishmentId),
        payload.establishmentName || null,
        payload.dependsOn || "CTC",
      ]
    );
    return rows[0] ? this.findById(rows[0].id, companyId) : null;
  },

  async delete(id, companyId) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return false;
    const { rowCount } = await db.query(
      `DELETE FROM public.ca_payroll_components WHERE id = $1 AND created_by_company_id = $2`,
      [rowId, cid]
    );
    return (rowCount ?? 0) > 0;
  },
};
