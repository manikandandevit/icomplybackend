import { db } from "../../core/db/pool.js";
import { caAttendanceIndexSql, caAttendanceTableSql, mapCAAttendance } from "./caAttendance.constants.js";

let ready = null;

const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caAttendanceTableSql);
      for (const statement of caAttendanceIndexSql
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
  a.id,
  COALESCE(e.establishment_id, a.establishment_id) AS establishment_id,
  COALESCE(NULLIF(TRIM(e.establishment_name), ''), a.establishment_name) AS establishment_name,
  a.employee_id,
  COALESCE(NULLIF(TRIM(e.name), ''), a.employee_name) AS employee_name,
  COALESCE(NULLIF(TRIM(e.employee_code), ''), a.employee_code) AS employee_code,
  a.date, a.check_in, a.check_out, a.status, a.requested_check_in, a.requested_check_out,
  a.regularization_status, a.regularization_reason, a.regularization_reviewed_by,
  a.created_by_company_id, a.created_at, a.updated_at,
  NULLIF(TRIM(e.details->>'shiftStartTime'), '') AS shift_start_time,
  NULLIF(TRIM(e.details->>'shiftEndTime'), '') AS shift_end_time
`;

const fromJoined = `
  FROM public.ca_attendance a
  LEFT JOIN public.ca_employees e
    ON e.id = a.employee_id AND e.created_by_company_id = a.created_by_company_id
`;

const parseRowId = (id) => {
  const n = Number.parseInt(String(id ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export const caAttendanceRepository = {
  async list(companyId, employeeId = null) {
    await ensureTable();
    const cid = parseRowId(companyId);
    const empId = parseRowId(employeeId);
    if (!cid) return [];
    const result = await db.query(
      `
      SELECT ${selectColumns}
      ${fromJoined}
      WHERE a.created_by_company_id = $1
        ${empId ? "AND a.employee_id = $2" : ""}
      ORDER BY a.date DESC, a.id DESC
      `,
      empId ? [cid, empId] : [cid],
    );
    return result.rows.map(mapCAAttendance);
  },

  async getById(id, companyId) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return null;
    const result = await db.query(
      `SELECT ${selectColumns} ${fromJoined} WHERE a.id = $1 AND a.created_by_company_id = $2`,
      [rowId, cid]
    );
    return mapCAAttendance(result.rows[0]);
  },

  async findByEmployeeDate(companyId, employeeId, date) {
    await ensureTable();
    const cid = parseRowId(companyId);
    const empId = parseRowId(employeeId);
    if (!cid || !empId || !date) return null;
    const result = await db.query(
      `SELECT ${selectColumns}
       ${fromJoined}
       WHERE a.created_by_company_id = $1 AND a.employee_id = $2 AND a.date = $3::date
       LIMIT 1`,
      [cid, empId, date]
    );
    return mapCAAttendance(result.rows[0]);
  },

  async insert(data) {
    await ensureTable();
    const result = await db.query(
      `INSERT INTO public.ca_attendance (
        establishment_id, establishment_name, employee_id, employee_name, employee_code,
        date, check_in, check_out, status, requested_check_in, requested_check_out,
        regularization_status, regularization_reason, regularization_reviewed_by, created_by_company_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id`,
      [
        parseRowId(data.establishmentId),
        data.establishmentName,
        parseRowId(data.employeeId),
        data.employeeName,
        data.employeeCode,
        data.date,
        data.checkIn || null,
        data.checkOut || null,
        data.status || "Present",
        data.requestedCheckIn || null,
        data.requestedCheckOut || null,
        data.regularizationStatus || null,
        data.regularizationReason || null,
        data.regularizationReviewedBy || null,
        parseRowId(data.createdByCompanyId),
      ]
    );
    return this.getById(result.rows[0]?.id, data.createdByCompanyId);
  },

  async update(id, companyId, data) {
    await ensureTable();
    const updates = [];
    const values = [id, companyId];
    let idx = 3;

    if (data.checkIn !== undefined) {
      updates.push(`check_in = $${idx++}`);
      values.push(data.checkIn);
    }
    if (data.checkOut !== undefined) {
      updates.push(`check_out = $${idx++}`);
      values.push(data.checkOut);
    }
    if (data.requestedCheckIn !== undefined) {
      updates.push(`requested_check_in = $${idx++}`);
      values.push(data.requestedCheckIn);
    }
    if (data.requestedCheckOut !== undefined) {
      updates.push(`requested_check_out = $${idx++}`);
      values.push(data.requestedCheckOut);
    }
    if (data.status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(data.status);
    }
    if (data.regularizationStatus !== undefined) {
      updates.push(`regularization_status = $${idx++}`);
      values.push(data.regularizationStatus);
    }
    if (data.regularizationReason !== undefined) {
      updates.push(`regularization_reason = $${idx++}`);
      values.push(data.regularizationReason);
    }
    if (data.regularizationReviewedBy !== undefined) {
      updates.push(`regularization_reviewed_by = $${idx++}`);
      values.push(data.regularizationReviewedBy);
    }

    if (updates.length === 0) return this.getById(id, companyId);

    updates.push(`updated_at = NOW()`);

    const result = await db.query(
      `UPDATE public.ca_attendance 
       SET ${updates.join(', ')} 
       WHERE id = $1 AND created_by_company_id = $2
       RETURNING id`,
      values
    );
    return this.getById(result.rows[0]?.id, companyId);
  },
};
