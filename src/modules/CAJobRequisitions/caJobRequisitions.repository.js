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
      await db.query('ALTER TABLE public.ca_job_requisitions ADD COLUMN IF NOT EXISTS hiring_manager_email VARCHAR(255);');
      await db.query('ALTER TABLE public.ca_job_requisitions ADD COLUMN IF NOT EXISTS hiring_manager_phone VARCHAR(50);');
      await db.query('ALTER TABLE public.ca_job_requisitions ADD COLUMN IF NOT EXISTS approver_name VARCHAR(255);');
      await db.query('ALTER TABLE public.ca_job_requisitions ADD COLUMN IF NOT EXISTS approver_email VARCHAR(255);');
      await db.query('ALTER TABLE public.ca_job_requisitions ADD COLUMN IF NOT EXISTS approver_phone VARCHAR(50);');
      await db.query('ALTER TABLE public.ca_job_requisitions ADD COLUMN IF NOT EXISTS target_date VARCHAR(255);');
      await db.query('ALTER TABLE public.ca_job_requisitions ADD COLUMN IF NOT EXISTS experience VARCHAR(255);');
      await db.query('ALTER TABLE public.ca_job_requisitions ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT \'[]\'::jsonb;');
      await db.query('ALTER TABLE public.ca_job_requisitions ADD COLUMN IF NOT EXISTS establishment_id VARCHAR(100);');
      await db.query('ALTER TABLE public.ca_job_requisitions ADD COLUMN IF NOT EXISTS establishment_name VARCHAR(255);');
      await db.query('ALTER TABLE public.ca_job_requisitions ADD COLUMN IF NOT EXISTS company_source VARCHAR(20) DEFAULT \'ca\';');
      await db.query('ALTER TABLE public.ca_job_requisitions ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);');
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
  id, req_id, position, department, location, type, hiring_manager, hiring_manager_email, hiring_manager_phone, approver_name, approver_email, approver_phone, positions_count, priority, budget, status, approval_status, target_date, experience, skills,
  establishment_id, establishment_name, company_source, company_name,
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

  async findByIdDirect(id) {
    await ensureTable();
    const rowId = parseRowId(id);
    if (!rowId) return null;
    const { rows } = await db.query(
      `
      SELECT ${selectColumns}
      FROM public.ca_job_requisitions
      WHERE id = $1
      LIMIT 1
      `,
      [rowId],
    );
    return rows[0] ? mapCAJobRequisition(rows[0]) : null;
  },

  async create(companyId, payload) {
    await ensureTable();
    const cid = parseRowId(payload.companyId) || parseRowId(companyId);
    if (!cid) return null;
    
    // Generate reqId automatically like REQ-001
    const countRes = await db.query('SELECT COUNT(*) FROM public.ca_job_requisitions WHERE created_by_company_id = $1', [cid]);
    const nextNum = parseInt(countRes.rows[0].count, 10) + 1;
    const reqId = `REQ-${String(nextNum).padStart(3, '0')}`;

    let establishmentName = payload.establishmentName || "";
    if (payload.establishmentId && !establishmentName) {
      try {
        const estRes = await db.query('SELECT name FROM public.ca_establishments WHERE id = $1', [payload.establishmentId]);
        if (estRes.rows[0]) {
          establishmentName = estRes.rows[0].name;
        }
      } catch (e) {
        console.warn("Could not lookup establishment name on requisition create:", e?.message);
      }
    }

    const { rows } = await db.query(
      `
      INSERT INTO public.ca_job_requisitions (
        req_id, position, department, location, type, hiring_manager, hiring_manager_email, hiring_manager_phone, approver_name, approver_email, approver_phone, positions_count, priority, budget, status, approval_status, target_date, experience, skills,
        establishment_id, establishment_name, company_source, company_name, created_by_company_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
      RETURNING id
      `,
      [
        reqId,
        payload.position,
        payload.department,
        payload.location,
        payload.type,
        payload.hiringManager || "",
        payload.hiringManagerEmail || "",
        payload.hiringManagerPhone || "",
        payload.approverName || "",
        payload.approverEmail || "",
        payload.approverPhone || "",
        payload.positionsCount || 1,
        payload.priority,
        payload.budget || "",
        payload.status || "Open",
        payload.approvalStatus || "Approved",
        payload.targetDate || "",
        payload.experience || "",
        JSON.stringify(payload.skills || []),
        payload.establishmentId || null,
        establishmentName,
        payload.companySource || "ca",
        payload.companyName || "",
        cid,
      ],
    );
    return this.findById(rows[0].id, cid);
  },

  async update(id, companyId, payload) {
    await ensureTable();
    const rowId = parseRowId(id);
    const targetCid = parseRowId(payload.companyId) || parseRowId(companyId);
    if (!rowId || !targetCid) return null;

    let establishmentName = payload.establishmentName || "";
    if (payload.establishmentId && !establishmentName) {
      try {
        const estRes = await db.query('SELECT name FROM public.ca_establishments WHERE id = $1', [payload.establishmentId]);
        if (estRes.rows[0]) {
          establishmentName = estRes.rows[0].name;
        }
      } catch (e) {
        console.warn("Could not lookup establishment name on requisition update:", e?.message);
      }
    }

    const { rows } = await db.query(
      `
      UPDATE public.ca_job_requisitions
      SET position = $3, department = $4, location = $5, type = $6, hiring_manager = $7, hiring_manager_email = $8, hiring_manager_phone = $9,
          approver_name = $10, approver_email = $11, approver_phone = $12,
          positions_count = $13, priority = $14, budget = $15, status = $16, approval_status = $17, target_date = $18, experience = $19, skills = $20,
          establishment_id = $21, establishment_name = $22,
          company_source = COALESCE($23, company_source),
          company_name = COALESCE($24, company_name),
          created_by_company_id = COALESCE($25, created_by_company_id),
          updated_at = NOW()
      WHERE id = $1 AND (created_by_company_id = $2 OR created_by_company_id = $25 OR $2 IS NULL)
      RETURNING id, created_by_company_id, position, establishment_id, establishment_name
      `,
      [
        rowId,
        companyId ? parseRowId(companyId) : null,
        payload.position,
        payload.department,
        payload.location,
        payload.type,
        payload.hiringManager || "",
        payload.hiringManagerEmail || "",
        payload.hiringManagerPhone || "",
        payload.approverName || "",
        payload.approverEmail || "",
        payload.approverPhone || "",
        payload.positionsCount,
        payload.priority,
        payload.budget,
        payload.status,
        payload.approvalStatus,
        payload.targetDate || "",
        payload.experience || "",
        JSON.stringify(payload.skills || []),
        payload.establishmentId || null,
        establishmentName,
        payload.companySource || null,
        payload.companyName || null,
        targetCid,
      ],
    );
    if (!rows[0]) return null;

    // Propagate updated establishment to existing candidates of this position
    if (rows[0].establishment_id && rows[0].position) {
      try {
        await db.query(
          `UPDATE public.ca_candidates
           SET establishment_id = $1, establishment_name = $2, created_by_company_id = COALESCE($3, created_by_company_id)
           WHERE LOWER(TRIM(role)) = LOWER(TRIM($4))
             AND (created_by_company_id = $3 OR created_by_company_id IS NULL)`,
          [rows[0].establishment_id, rows[0].establishment_name, rows[0].created_by_company_id, rows[0].position]
        );
      } catch (propErr) {
        console.warn("Could not propagate establishment to candidates on requisition update:", propErr?.message);
      }
    }

    return this.findById(rows[0].id, rows[0].created_by_company_id || targetCid);
  },

  async updateStatus(id, companyId, status, approvalStatus) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId) return null;
    const { rows } = await db.query(
      `
      UPDATE public.ca_job_requisitions
      SET status = $3, approval_status = $4, updated_at = NOW()
      WHERE id = $1 AND (created_by_company_id = $2 OR $2 IS NULL)
      RETURNING id, created_by_company_id
      `,
      [rowId, cid, status, approvalStatus]
    );
    if (!rows[0]) return null;
    return this.findByIdDirect(rows[0].id);
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
