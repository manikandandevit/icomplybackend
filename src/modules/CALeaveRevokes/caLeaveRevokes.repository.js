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
  r.id, r.leave_request_id,
  COALESCE(e.establishment_id, r.establishment_id) AS establishment_id,
  COALESCE(NULLIF(TRIM(e.establishment_name), ''), r.establishment_name) AS establishment_name,
  r.employee_id,
  COALESCE(NULLIF(TRIM(e.name), ''), r.employee_name) AS employee_name,
  COALESCE(NULLIF(TRIM(e.employee_code), ''), r.employee_code) AS employee_code,
  r.leave_type_id, r.leave_type_name, r.start_date, r.end_date, r.days, r.reason, r.reject_reason,
  COALESCE(NULLIF(TRIM(mgr.name), ''), r.approver_name) AS approver_name,
  r.reviewed_by_name, r.reporting_to_id, r.session,
  r.attachment_key, r.attachment_url, r.attachment_name, r.attachment_mime, r.status, r.created_by_company_id, r.created_at
`;

const fromJoined = `
  FROM public.ca_leave_revokes r
  LEFT JOIN public.ca_employees e
    ON e.id = r.employee_id AND e.created_by_company_id = r.created_by_company_id
  LEFT JOIN public.ca_employees mgr
    ON mgr.id = r.reporting_to_id AND mgr.created_by_company_id = r.created_by_company_id
`;

const q = (client) => client || db;

const teamMatchSql = (empIdParam, empTextParam) => `
  (
    r.reporting_to_id = ${empIdParam}
    OR (
      r.reporting_to_id IS NULL
      AND r.employee_id IN (
        SELECT team.id
        FROM public.ca_employees team
        WHERE team.created_by_company_id = $1
          AND (team.details->>'reportingToId') = ${empTextParam}
      )
    )
  )
`;

export const caLeaveRevokesRepository = {
  async list(companyId, { scope = "all", actor } = {}) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return [];

    const privileged = Boolean(actor?.isOwner || actor?.isCaUser || !actor?.employeeId);
    const empId = parseRowId(actor?.employeeId);
    const useAll = privileged || scope === "all" || !empId;

    let sql = `
      SELECT ${selectColumns}
      ${fromJoined}
      WHERE r.created_by_company_id = $1
    `;
    const params = [cid];

    if (!useAll) {
      const empText = String(actor.employeeId);
      if (scope === "mine") {
        sql += " AND r.employee_id = $2";
        params.push(empId);
      } else if (scope === "overview") {
        sql += ` AND (r.employee_id = $2 OR ${teamMatchSql("$2", "$3")})`;
        params.push(empId, empText);
      } else {
        sql += ` AND r.employee_id <> $2 AND ${teamMatchSql("$2", "$3")}`;
        params.push(empId, empText);
      }
    }

    sql += " ORDER BY r.id DESC";
    const { rows } = await db.query(sql, params);
    return rows.map(mapCALeaveRevoke);
  },

  async findById(id, companyId, client) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return null;
    const { rows } = await q(client).query(
      `
      SELECT ${selectColumns}
      ${fromJoined}
      WHERE r.id = $1 AND r.created_by_company_id = $2
      LIMIT 1
      `,
      [rowId, cid],
    );
    return rows[0] ? mapCALeaveRevoke(rows[0]) : null;
  },

  async findOverlappingPending(leaveRequestId, companyId, startDate, endDate, excludeId = null, session = "full") {
    await ensureTable();
    const leaveId = parseRowId(leaveRequestId);
    const cid = parseRowId(companyId);
    if (!leaveId || !cid || !startDate || !endDate) return null;
    const params = [leaveId, cid, startDate, endDate, session || "full"];
    let excludeSql = "";
    if (excludeId) {
      const skip = parseRowId(excludeId);
      if (skip) {
        excludeSql = " AND r.id <> $6";
        params.push(skip);
      }
    }
    const { rows } = await db.query(
      `
      SELECT ${selectColumns}
      ${fromJoined}
      WHERE r.leave_request_id = $1
        AND r.created_by_company_id = $2
        AND r.status = 'Pending'
        AND r.start_date <= $4::date
        AND r.end_date >= $3::date
        AND (
          COALESCE(r.session, 'full') = 'full'
          OR $5 = 'full'
          OR COALESCE(r.session, 'full') = $5
        )
        ${excludeSql}
      LIMIT 1
      `,
      params,
    );
    return rows[0] ? mapCALeaveRevoke(rows[0]) : null;
  },

  async retargetPending(fromLeaveId, toLeaveId, companyId, fromStartDate, client) {
    await ensureTable();
    const fromId = parseRowId(fromLeaveId);
    const toId = parseRowId(toLeaveId);
    const cid = parseRowId(companyId);
    if (!fromId || !toId || !cid) return;
    await q(client).query(
      `
      UPDATE public.ca_leave_revokes
      SET leave_request_id = $2, updated_at = NOW()
      WHERE leave_request_id = $1
        AND created_by_company_id = $3
        AND status = 'Pending'
        AND start_date >= $4::date
      `,
      [fromId, toId, cid, fromStartDate],
    );
  },

  async updateStatus(id, companyId, { status, rejectReason = "", reviewedByName = "" }, client) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return null;
    const { rows } = await q(client).query(
      `
      UPDATE public.ca_leave_revokes
      SET status = $3, reject_reason = $4, reviewed_by_name = $5, updated_at = NOW()
      WHERE id = $1 AND created_by_company_id = $2
      RETURNING id
      `,
      [rowId, cid, status, rejectReason || null, reviewedByName || null],
    );
    if (!rows[0]) return null;
    return this.findById(rows[0].id, companyId, client);
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
        approver_name, reporting_to_id, session,
        attachment_key, attachment_url, attachment_name, attachment_mime, created_by_company_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'Pending',$13,$14,$15,$16,$17,$18,$19,$20)
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
        parseRowId(payload.reportingToId),
        payload.session || "full",
        payload.attachmentKey || null,
        payload.attachmentUrl || null,
        payload.attachmentName || null,
        payload.attachmentMime || null,
        cid,
      ],
    );
    return this.findById(rows[0].id, companyId);
  },
};
