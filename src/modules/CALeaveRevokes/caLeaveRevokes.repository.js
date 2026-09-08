import { db } from "../../core/db/pool.js";
import { caLeaveRevokesIndexSql, caLeaveRevokesTableSql, mapCALeaveRevoke } from "./caLeaveRevokes.constants.js";

let ready = null;

const parseRowId = (id) => {
  const n = Number.parseInt(String(id ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caLeaveRevokesTableSql);
      for (const statement of caLeaveRevokesIndexSql
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
  id, leave_request_id, establishment_id, establishment_name, employee_id, employee_name, employee_code,
  leave_type_id, leave_type_name, start_date, end_date, days, reason, reject_reason,
  approver_name, reviewed_by_name, status, created_by_company_id, created_at
`;

export const caLeaveRevokesRepository = {
  async list(companyId) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return [];
    const { rows } = await db.query(
      `
      SELECT ${selectColumns}
      FROM public.ca_leave_revokes
      WHERE created_by_company_id = $1
      ORDER BY id DESC
      `,
      [cid],
    );
    return rows.map(mapCALeaveRevoke);
  },

  async findById(id, companyId) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return null;
    const { rows } = await db.query(
      `
      SELECT ${selectColumns}
      FROM public.ca_leave_revokes
      WHERE id = $1 AND created_by_company_id = $2
      LIMIT 1
      `,
      [rowId, cid],
    );
    return rows[0] ? mapCALeaveRevoke(rows[0]) : null;
  },

  async findPendingForLeave(leaveRequestId, companyId) {
    await ensureTable();
    const leaveId = parseRowId(leaveRequestId);
    const cid = parseRowId(companyId);
    if (!leaveId || !cid) return null;
    const { rows } = await db.query(
      `
      SELECT ${selectColumns}
      FROM public.ca_leave_revokes
      WHERE leave_request_id = $1 AND created_by_company_id = $2 AND status = 'Pending'
      LIMIT 1
      `,
      [leaveId, cid],
    );
    return rows[0] ? mapCALeaveRevoke(rows[0]) : null;
  },

  async updateStatus(id, companyId, { status, rejectReason = "", reviewedByName = "" }) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return null;
    const { rows } = await db.query(
      `
      UPDATE public.ca_leave_revokes
      SET status = $3, reject_reason = $4, reviewed_by_name = $5, updated_at = NOW()
      WHERE id = $1 AND created_by_company_id = $2
      RETURNING id
      `,
      [rowId, cid, status, rejectReason || null, reviewedByName || null],
    );
    if (!rows[0]) return null;
    return this.findById(rows[0].id, companyId);
  },

  async removePending(id, companyId) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return false;
    const { rows } = await db.query(
      `
      DELETE FROM public.ca_leave_revokes
      WHERE id = $1 AND created_by_company_id = $2 AND status = 'Pending'
      RETURNING id
      `,
      [rowId, cid],
    );
    return Boolean(rows[0]);
  },

  async create(companyId, payload) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return null;
    const { rows } = await db.query(
      `
      INSERT INTO public.ca_leave_revokes (
        leave_request_id, establishment_id, establishment_name, employee_id, employee_name, employee_code,
        leave_type_id, leave_type_name, start_date, end_date, days, reason, status,
        approver_name, created_by_company_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'Pending',$13,$14)
      RETURNING id
      `,
      [
        parseRowId(payload.leaveRequestId),
        parseRowId(payload.establishmentId),
        payload.establishmentName,
        parseRowId(payload.employeeId),
        payload.employeeName,
        payload.employeeCode || "",
        parseRowId(payload.leaveTypeId),
        payload.leaveTypeName,
        payload.startDate,
        payload.endDate,
        payload.days,
        payload.reason,
        payload.approverName || "",
        cid,
      ],
    );
    return this.findById(rows[0].id, companyId);
  },
};
