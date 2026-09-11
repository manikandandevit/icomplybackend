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
      `SELECT id, name, type, ctc_impact, percentage, establishment_id, establishment_name, created_at
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
      `SELECT id, name, type, ctc_impact, percentage, establishment_id, establishment_name, created_at
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
         (name, type, ctc_impact, percentage, establishment_id, establishment_name, created_by_company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        payload.name,
        payload.type || "Earning",
        payload.ctcImpact || "Add",
        Number(payload.percentage),
        parseRowId(payload.establishmentId),
        payload.establishmentName || null,
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
       SET name = $3, type = $4, ctc_impact = $5, percentage = $6, establishment_id = $7, establishment_name = $8, updated_at = NOW()
       WHERE id = $1 AND created_by_company_id = $2
       RETURNING id`,
      [
        rowId,
        cid,
        payload.name,
        payload.type || "Earning",
        payload.ctcImpact || "Add",
        Number(payload.percentage),
        parseRowId(payload.establishmentId),
        payload.establishmentName || null,
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
