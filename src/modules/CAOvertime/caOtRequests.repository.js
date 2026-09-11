import { db } from "../../core/db/pool.js";
import { caOtRequestsIndexSql, caOtRequestsTableSql, mapCAOtRequest } from "./caOtRequests.constants.js";

let ready = null;
const ensureTable = async () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caOtRequestsTableSql);
      for (const statement of caOtRequestsIndexSql) {
        await db.query(statement);
      }
    })();
  }
  return ready;
};

const selectColumns = `
  id, establishment_id, establishment_name, employee_id, employee_name, employee_code,
  date, work_date, total_working_hours, ot_hours, ot_minutes, hours, work_hours,
  reason, reject_reason, type, status, reporting_to_id, approver_name,
  reviewed_by_name, reviewed_at, attendance_id, source,
  created_by_company_id, created_at, updated_at
`;

const parseRowId = (id) => {
  const n = Number.parseInt(String(id ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export const caOtRequestsRepository = {
  async list(companyId, filters = {}) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return [];

    const where = ["created_by_company_id = $1"];
    const values = [cid];
    let idx = 2;

    if (filters.employeeId) {
      where.push(`employee_id = $${idx++}`);
      values.push(Number(filters.employeeId));
    }
    if (filters.establishmentId && filters.establishmentId !== "all") {
      where.push(`establishment_id = $${idx++}`);
      values.push(Number(filters.establishmentId));
    }
    if (filters.status && filters.status !== "all") {
      where.push(`LOWER(status) = LOWER($${idx++})`);
      values.push(filters.status);
    }
    if (filters.year) {
      where.push(`EXTRACT(YEAR FROM COALESCE(work_date, date)) = $${idx++}`);
      values.push(Number(filters.year));
    }
    if (filters.month && filters.month !== "all") {
      where.push(`EXTRACT(MONTH FROM COALESCE(work_date, date)) = $${idx++}`);
      values.push(Number(filters.month));
    }

    const query = `
      SELECT ${selectColumns}
      FROM public.ca_ot_requests
      WHERE ${where.join(" AND ")}
      ORDER BY COALESCE(work_date, date) DESC, id DESC
    `;

    const { rows } = await db.query(query, values);
    return rows.map(mapCAOtRequest);
  },

  async getById(id, companyId) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return null;

    const { rows } = await db.query(
      `SELECT ${selectColumns} FROM public.ca_ot_requests WHERE id = $1 AND created_by_company_id = $2`,
      [rowId, cid]
    );
    return mapCAOtRequest(rows[0]);
  },

  async create(companyId, data) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return null;

    const dateVal = data.date || data.workDate || new Date().toISOString().slice(0, 10);
    const workDateVal = data.workDate || dateVal;
    const hoursVal = Number(data.hours || data.otHours) || 0;
    const otMinutesVal = Number(data.otMinutes) || Math.round(hoursVal * 60);

    const { rows } = await db.query(
      `
      INSERT INTO public.ca_ot_requests (
        establishment_id, establishment_name, employee_id, employee_name, employee_code,
        date, work_date, total_working_hours, ot_hours, ot_minutes, hours, work_hours,
        reason, type, status, reporting_to_id, approver_name, attendance_id, source,
        created_by_company_id
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, $19,
        $20
      )
      RETURNING ${selectColumns}
      `,
      [
        Number(data.establishmentId),
        data.establishmentName || "",
        Number(data.employeeId),
        data.employeeName || "",
        data.employeeCode || "",
        dateVal,
        workDateVal,
        String(data.totalWorkingHours || (8 + hoursVal).toFixed(1)),
        String(hoursVal),
        otMinutesVal,
        hoursVal,
        Number(data.workHours) || 8.0,
        data.reason || "",
        data.type || "Weekday Ot",
        data.status || "Pending",
        data.reportingToId ? Number(data.reportingToId) : null,
        data.approverName || "",
        data.attendanceId ? Number(data.attendanceId) : null,
        data.source || "manual",
        cid,
      ]
    );

    return mapCAOtRequest(rows[0]);
  },

  async update(id, companyId, data) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return null;

    const updates = ["updated_at = NOW()"];
    const values = [rowId, cid];
    let idx = 3;

    if (data.status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(data.status);
    }
    if (data.type !== undefined) {
      updates.push(`type = $${idx++}`);
      values.push(data.type);
    }
    if (data.rejectReason !== undefined) {
      updates.push(`reject_reason = $${idx++}`);
      values.push(data.rejectReason);
    }
    if (data.reviewedByName !== undefined) {
      updates.push(`reviewed_by_name = $${idx++}`);
      values.push(data.reviewedByName);
    }
    if (data.reviewedAt !== undefined) {
      updates.push(`reviewed_at = $${idx++}`);
      values.push(data.reviewedAt);
    }
    if (data.hours !== undefined) {
      updates.push(`hours = $${idx++}`);
      values.push(Number(data.hours));
      updates.push(`ot_hours = $${idx++}`);
      values.push(String(data.hours));
      updates.push(`ot_minutes = $${idx++}`);
      values.push(Math.round(Number(data.hours) * 60));
    }
    if (data.reason !== undefined) {
      updates.push(`reason = $${idx++}`);
      values.push(data.reason);
    }

    const { rows } = await db.query(
      `UPDATE public.ca_ot_requests SET ${updates.join(", ")} WHERE id = $1 AND created_by_company_id = $2 RETURNING ${selectColumns}`,
      values
    );

    return mapCAOtRequest(rows[0]);
  },

  async delete(id, companyId) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return false;

    const { rowCount } = await db.query(
      `DELETE FROM public.ca_ot_requests WHERE id = $1 AND created_by_company_id = $2`,
      [rowId, cid]
    );
    return rowCount > 0;
  },
};
