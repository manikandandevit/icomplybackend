import { db } from "../../core/db/pool.js";
import { caJobRequisitionsIndexSql, caJobRequisitionsTableSql, mapCAJobRequisition } from "./caJobRequisitions.constants.js";

let ready = null;

const parseRowId = (id) => {
  const n = Number.parseInt(String(id ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caJobRequisitionsTableSql);
      await db.query('ALTER TABLE public.ca_job_requisitions ADD COLUMN IF NOT EXISTS hiring_manager VARCHAR(255);');
      await db.query('ALTER TABLE public.ca_job_requisitions ADD COLUMN IF NOT EXISTS target_date VARCHAR(255);');
      await db.query('ALTER TABLE public.ca_job_requisitions ADD COLUMN IF NOT EXISTS experience VARCHAR(255);');
      await db.query('ALTER TABLE public.ca_job_requisitions ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT \'[]\'::jsonb;');
      for (const statement of caJobRequisitionsIndexSql
        .split(";")
        .map((sql) => sql.trim())
        .filter(Boolean)) {
        await db.query(statement);
      }
    })();
  }
  return ready;
};

const selectColumns = `
  id, req_id, position, department, location, type, hiring_manager, positions_count, priority, budget, status, approval_status, target_date, experience, skills,
  created_by_company_id, created_at
`;

export const caJobRequisitionsRepository = {
  async list(companyId) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return [];
    const { rows } = await db.query(
      `
      SELECT ${selectColumns}
      FROM public.ca_job_requisitions
      WHERE created_by_company_id = $1
      ORDER BY id DESC
      `,
      [cid],
    );
    return rows.map(mapCAJobRequisition);
  },

  async findById(id, companyId) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return null;
    const { rows } = await db.query(
      `
      SELECT ${selectColumns}
      FROM public.ca_job_requisitions
      WHERE id = $1 AND created_by_company_id = $2
      LIMIT 1
      `,
      [rowId, cid],
    );
    return rows[0] ? mapCAJobRequisition(rows[0]) : null;
  },

  async create(companyId, payload) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return null;
    
    // Generate reqId automatically like REQ-001
    const countRes = await db.query('SELECT COUNT(*) FROM public.ca_job_requisitions WHERE created_by_company_id = $1', [cid]);
    const nextNum = parseInt(countRes.rows[0].count, 10) + 1;
    const reqId = `REQ-${String(nextNum).padStart(3, '0')}`;

    const { rows } = await db.query(
      `
      INSERT INTO public.ca_job_requisitions (
        req_id, position, department, location, type, hiring_manager, positions_count, priority, budget, status, approval_status, target_date, experience, skills, created_by_company_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING id
      `,
      [
        reqId,
        payload.position,
        payload.department,
        payload.location,
        payload.type,
        payload.hiringManager || "",
        payload.positionsCount || 1,
        payload.priority,
        payload.budget || "",
        payload.status || "Open",
        payload.approvalStatus || "Approved",
        payload.targetDate || "",
        payload.experience || "",
        JSON.stringify(payload.skills || []),
        cid,
      ],
    );
    return this.findById(rows[0].id, companyId);
  },

  async update(id, companyId, payload) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return null;
    const { rows } = await db.query(
      `
      UPDATE public.ca_job_requisitions
      SET position = $3, department = $4, location = $5, type = $6, hiring_manager = $7, positions_count = $8, priority = $9, budget = $10, status = $11, approval_status = $12, target_date = $13, experience = $14, skills = $15, updated_at = NOW()
      WHERE id = $1 AND created_by_company_id = $2
      RETURNING id
      `,
      [
        rowId,
        cid,
        payload.position,
        payload.department,
        payload.location,
        payload.type,
        payload.hiringManager,
        payload.positionsCount,
        payload.priority,
        payload.budget,
        payload.status,
        payload.approvalStatus,
        payload.targetDate || "",
        payload.experience || "",
        JSON.stringify(payload.skills || []),
      ],
    );
    if (!rows[0]) return null;
    return this.findById(rows[0].id, companyId);
  },

  async updateStatus(id, companyId, status, approvalStatus) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return null;
    const { rows } = await db.query(
      `
      UPDATE public.ca_job_requisitions
      SET status = $3, approval_status = $4, updated_at = NOW()
      WHERE id = $1 AND created_by_company_id = $2
      RETURNING id
      `,
      [rowId, cid, status, approvalStatus]
    );
    if (!rows[0]) return null;
    return this.findById(rows[0].id, companyId);
  },

  async remove(id, companyId) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return false;
    const { rows } = await db.query(
      `
      DELETE FROM public.ca_job_requisitions
      WHERE id = $1 AND created_by_company_id = $2
      RETURNING id
      `,
      [rowId, cid],
    );
    return Boolean(rows[0]);
  },
};
