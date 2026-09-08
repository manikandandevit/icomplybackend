import { db } from "../../core/db/pool.js";
import { caLeaveRequestsIndexSql, caLeaveRequestsTableSql, mapCALeaveRequest } from "./caLeaveRequests.constants.js";

let ready = null;

const parseRowId = (id) => {
  const n = Number.parseInt(String(id ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caLeaveRequestsTableSql);
      for (const statement of caLeaveRequestsIndexSql
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
  id, establishment_id, establishment_name, employee_id, employee_name, employee_code,
  leave_type_id, leave_type_name, start_date, end_date, days, reason, reject_reason,
  approver_name, reviewed_by_name, status,
  created_by_company_id, created_at
`;

export const caLeaveRequestsRepository = {
  async list(companyId) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return [];
    const { rows } = await db.query(
      `
      SELECT ${selectColumns}
      FROM public.ca_leave_requests
      WHERE created_by_company_id = $1
      ORDER BY id DESC
      `,
      [cid],
    );
    return rows.map(mapCALeaveRequest);
  },

  async findById(id, companyId) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return null;
    const { rows } = await db.query(
      `
      SELECT ${selectColumns}
      FROM public.ca_leave_requests
      WHERE id = $1 AND created_by_company_id = $2
      LIMIT 1
      `,
      [rowId, cid],
    );
    return rows[0] ? mapCALeaveRequest(rows[0]) : null;
  },

  async usedDays(companyId, employeeId, leaveTypeId, year, statuses = ["Pending", "Approved"], excludeId = null) {
    await ensureTable();
    const cid = parseRowId(companyId);
    const empId = parseRowId(employeeId);
    const typeId = parseRowId(leaveTypeId);
    if (!cid || !empId || !typeId) return 0;
    const allowed = Array.isArray(statuses) && statuses.length ? statuses : ["Pending", "Approved"];
    const params = [cid, empId, typeId, year, allowed];
    let excludeSql = "";
    if (excludeId) {
      const skip = parseRowId(excludeId);
      if (skip) {
        excludeSql = " AND id <> $6";
        params.push(skip);
      }
    }
    const { rows } = await db.query(
      `
      SELECT COALESCE(SUM(days), 0) AS used
      FROM public.ca_leave_requests
      WHERE created_by_company_id = $1
        AND employee_id = $2
        AND leave_type_id = $3
        AND EXTRACT(YEAR FROM start_date) = $4
        AND status = ANY($5::text[])
        ${excludeSql}
      `,
      params,
    );
    return Number(rows[0]?.used) || 0;
  },

  async updateStatus(id, companyId, { status, rejectReason = "", reviewedByName = "" }) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return null;
    const { rows } = await db.query(
      `
      UPDATE public.ca_leave_requests
      SET status = $3, reject_reason = $4, reviewed_by_name = $5, updated_at = NOW()
      WHERE id = $1 AND created_by_company_id = $2
      RETURNING id
      `,
      [rowId, cid, status, rejectReason || null, reviewedByName || null],
    );
    if (!rows[0]) return null;
    return this.findById(rows[0].id, companyId);
  },

  async create(companyId, payload) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return null;
    const { rows } = await db.query(
      `
      INSERT INTO public.ca_leave_requests (
        establishment_id, establishment_name, employee_id, employee_name, employee_code,
        leave_type_id, leave_type_name, start_date, end_date, days, reason, status,
        approver_name, created_by_company_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Pending',$12,$13)
      RETURNING id
      `,
      [
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
    const { rows: created } = await db.query(
      `SELECT ${selectColumns} FROM public.ca_leave_requests WHERE id = $1 LIMIT 1`,
      [rows[0].id],
    );
    return created[0] ? mapCALeaveRequest(created[0]) : null;
  },
};
