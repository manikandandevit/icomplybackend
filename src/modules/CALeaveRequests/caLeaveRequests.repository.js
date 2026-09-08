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
  approver_name, reviewed_by_name, reporting_to_id, session,
  attachment_key, attachment_url, attachment_name, attachment_mime, status,
  created_by_company_id, created_at
`;

const q = (client) => client || db;

const teamMatchSql = (empIdParam, empTextParam) => `
  (
    reporting_to_id = ${empIdParam}
    OR (
      reporting_to_id IS NULL
      AND employee_id IN (
        SELECT e.id
        FROM public.ca_employees e
        WHERE e.created_by_company_id = $1
          AND (e.details->>'reportingToId') = ${empTextParam}
      )
    )
  )
`;

export const caLeaveRequestsRepository = {
  async list(companyId, { scope = "all", actor } = {}) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return [];

    const privileged = Boolean(actor?.isOwner || actor?.isCaUser || !actor?.employeeId);
    const empId = parseRowId(actor?.employeeId);
    const useAll = privileged || scope === "all" || !empId;

    let sql = `
      SELECT ${selectColumns}
      FROM public.ca_leave_requests
      WHERE created_by_company_id = $1
    `;
    const params = [cid];

    if (!useAll) {
      const empText = String(actor.employeeId);
      if (scope === "mine") {
        sql += " AND employee_id = $2";
        params.push(empId);
      } else if (scope === "overview") {
        sql += ` AND (employee_id = $2 OR ${teamMatchSql("$2", "$3")})`;
        params.push(empId, empText);
      } else {
        sql += ` AND employee_id <> $2 AND ${teamMatchSql("$2", "$3")}`;
        params.push(empId, empText);
      }
    }

    sql += " ORDER BY id DESC";
    const { rows } = await db.query(sql, params);
    return rows.map(mapCALeaveRequest);
  },

  async findById(id, companyId, client) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return null;
    const { rows } = await q(client).query(
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

  async findOverlapping(companyId, employeeId, startDate, endDate, statuses = ["Pending", "Approved"], excludeId = null, session = "full") {
    await ensureTable();
    const cid = parseRowId(companyId);
    const empId = parseRowId(employeeId);
    if (!cid || !empId || !startDate || !endDate) return null;
    const allowed = Array.isArray(statuses) && statuses.length ? statuses : ["Pending", "Approved"];
    const params = [cid, empId, startDate, endDate, allowed, session || "full"];
    let excludeSql = "";
    if (excludeId) {
      const skip = parseRowId(excludeId);
      if (skip) {
        excludeSql = " AND id <> $7";
        params.push(skip);
      }
    }
    const { rows } = await db.query(
      `
      SELECT ${selectColumns}
      FROM public.ca_leave_requests
      WHERE created_by_company_id = $1
        AND employee_id = $2
        AND start_date <= $4::date
        AND end_date >= $3::date
        AND status = ANY($5::text[])
        AND (
          COALESCE(session, 'full') = 'full'
          OR $6 = 'full'
          OR COALESCE(session, 'full') = $6
        )
        ${excludeSql}
      ORDER BY id DESC
      LIMIT 1
      `,
      params,
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

  async updateStatus(id, companyId, { status, rejectReason = "", reviewedByName = "" }, client) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return null;
    const { rows } = await q(client).query(
      `
      UPDATE public.ca_leave_requests
      SET status = $3, reject_reason = $4, reviewed_by_name = $5, updated_at = NOW()
      WHERE id = $1 AND created_by_company_id = $2
      RETURNING id
      `,
      [rowId, cid, status, rejectReason || null, reviewedByName || null],
    );
    if (!rows[0]) return null;
    return this.findById(rows[0].id, companyId, client);
  },

  async updateRange(id, companyId, { startDate, endDate, days, status, session }, client) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return null;
    const { rows } = await q(client).query(
      `
      UPDATE public.ca_leave_requests
      SET start_date = $3, end_date = $4, days = $5, status = COALESCE($6, status),
          session = COALESCE($7, session), updated_at = NOW()
      WHERE id = $1 AND created_by_company_id = $2
      RETURNING id
      `,
      [rowId, cid, startDate, endDate, days, status || null, session || null],
    );
    if (!rows[0]) return null;
    return this.findById(rows[0].id, companyId, client);
  },

  async insertApprovedCopy(companyId, source, { startDate, endDate, days, session }, client) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid || !source) return null;
    const { rows } = await q(client).query(
      `
      INSERT INTO public.ca_leave_requests (
        establishment_id, establishment_name, employee_id, employee_name, employee_code,
        leave_type_id, leave_type_name, start_date, end_date, days, reason, status,
        approver_name, reviewed_by_name, reporting_to_id, session, created_by_company_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Approved',$12,$13,$14,$15,$16)
      RETURNING id
      `,
      [
        parseRowId(source.establishmentId),
        source.establishmentName,
        parseRowId(source.employeeId),
        source.employeeName,
        source.employeeCode || "",
        parseRowId(source.leaveTypeId),
        source.leaveTypeName,
        startDate,
        endDate,
        days,
        source.reason,
        source.approverName || "",
        source.reviewedByName || "",
        parseRowId(source.reportingToId),
        session || "full",
        cid,
      ],
    );
    return this.findById(rows[0].id, companyId, client);
  },

  async removePending(id, companyId) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return false;
    const { rows } = await db.query(
      `
      DELETE FROM public.ca_leave_requests
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
      INSERT INTO public.ca_leave_requests (
        establishment_id, establishment_name, employee_id, employee_name, employee_code,
        leave_type_id, leave_type_name, start_date, end_date, days, reason, status,
        approver_name, reporting_to_id, session,
        attachment_key, attachment_url, attachment_name, attachment_mime, created_by_company_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Pending',$12,$13,$14,$15,$16,$17,$18,$19)
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
        parseRowId(payload.reportingToId),
        payload.session || "full",
        payload.attachmentKey || null,
        payload.attachmentUrl || null,
        payload.attachmentName || null,
        payload.attachmentMime || null,
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
