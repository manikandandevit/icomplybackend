import { db } from "../../core/db/pool.js";
import { caSeparationTableSql, caSeparationIndexSql } from "./caSeparation.constants.js";

let ready = null;

const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caSeparationTableSql);
      for (const statement of caSeparationIndexSql
        .split(";")
        .map((sql) => sql.trim())
        .filter(Boolean)) {
        await db.query(statement);
      }
    })();
  }
  return ready;
};

const parseRowId = (id) => {
  const n = Number.parseInt(String(id ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export const caSeparationRepository = {
  async ensureReady() {
    return ensureTable();
  },

  async create(data) {
    await ensureTable();
    const {
      companyId,
      employeeId,
      employeeCode,
      employeeName,
      department,
      designation,
      establishmentId,
      establishmentName,
      reportingManagerId,
      reportingManagerName,
      currentReviewerId,
      currentReviewerName,
      currentReviewerDept,
      reasonCategory,
      primaryReason,
      proposedLastWorkingDay,
      confirmedLastWorkingDay,
      status = "Pending Review",
      reviewHistory = [],
      attachmentUrl = null,
    } = data;

    const query = `
      INSERT INTO public.ca_separation_requests (
        company_id,
        employee_id,
        employee_code,
        employee_name,
        department,
        designation,
        establishment_id,
        establishment_name,
        reporting_manager_id,
        reporting_manager_name,
        current_reviewer_id,
        current_reviewer_name,
        current_reviewer_dept,
        reason_category,
        primary_reason,
        proposed_last_working_day,
        confirmed_last_working_day,
        status,
        review_history,
        attachment_url
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      )
      RETURNING *;
    `;

    const values = [
      parseRowId(companyId),
      parseRowId(employeeId),
      employeeCode || null,
      employeeName,
      department || null,
      designation || null,
      parseRowId(establishmentId),
      establishmentName || null,
      parseRowId(reportingManagerId),
      reportingManagerName || null,
      parseRowId(currentReviewerId),
      currentReviewerName || null,
      currentReviewerDept || null,
      reasonCategory,
      primaryReason,
      proposedLastWorkingDay || null,
      confirmedLastWorkingDay || proposedLastWorkingDay || null,
      status,
      JSON.stringify(reviewHistory),
      attachmentUrl,
    ];

    const { rows } = await db.query(query, values);
    return rows[0];
  },

  async findById(id, companyId) {
    await ensureTable();
    const reqId = parseRowId(id);
    const cId = parseRowId(companyId);
    if (!reqId || !cId) return null;

    const { rows } = await db.query(
      `
      SELECT 
        r.*,
        COALESCE(NULLIF(TRIM(r.department), ''), NULLIF(TRIM(e.department_name), ''), NULLIF(TRIM(e.details->>'department'), ''), NULLIF(TRIM(e.details->>'departmentName'), '')) AS department,
        COALESCE(NULLIF(TRIM(r.designation), ''), NULLIF(TRIM(e.designation_name), ''), NULLIF(TRIM(e.details->>'designation'), ''), NULLIF(TRIM(e.details->>'designationName'), '')) AS designation,
        COALESCE(NULLIF(TRIM(r.establishment_name), ''), NULLIF(TRIM(e.establishment_name), ''), NULLIF(TRIM(e.details->>'establishmentName'), '')) AS establishment_name,
        COALESCE(NULLIF(TRIM(r.employee_code), ''), NULLIF(TRIM(e.employee_code), '')) AS employee_code
      FROM public.ca_separation_requests r
      LEFT JOIN public.ca_employees e ON e.id = r.employee_id
      WHERE r.id = $1 AND r.company_id = $2
      LIMIT 1
      `,
      [reqId, cId]
    );
    return rows[0] || null;
  },

  async findActiveByEmployee(companyId, employeeId, userName = "", userEmail = "") {
    await ensureTable();
    const cId = parseRowId(companyId);
    const empId = parseRowId(employeeId);
    if (!cId) return null;

    const cleanName = String(userName || "").trim().toLowerCase();
    const cleanEmail = String(userEmail || "").trim().toLowerCase();

    const { rows } = await db.query(
      `
      SELECT 
        r.*,
        COALESCE(NULLIF(TRIM(r.department), ''), NULLIF(TRIM(e.department_name), ''), NULLIF(TRIM(e.details->>'department'), ''), NULLIF(TRIM(e.details->>'departmentName'), '')) AS department,
        COALESCE(NULLIF(TRIM(r.designation), ''), NULLIF(TRIM(e.designation_name), ''), NULLIF(TRIM(e.details->>'designation'), ''), NULLIF(TRIM(e.details->>'designationName'), '')) AS designation,
        COALESCE(NULLIF(TRIM(r.establishment_name), ''), NULLIF(TRIM(e.establishment_name), ''), NULLIF(TRIM(e.details->>'establishmentName'), '')) AS establishment_name,
        COALESCE(NULLIF(TRIM(r.employee_code), ''), NULLIF(TRIM(e.employee_code), '')) AS employee_code
      FROM public.ca_separation_requests r
      LEFT JOIN public.ca_employees e ON e.id = r.employee_id
      WHERE r.company_id = $1
        AND (
          ($2::int IS NOT NULL AND r.employee_id = $2::int)
          OR ($3 <> '' AND lower(COALESCE(r.employee_name, '')) = $3)
          OR ($4 <> '' AND (lower(COALESCE(e.email, '')) = $4 OR lower(COALESCE(e.details->>'personalEmail', '')) = $4))
        )
        AND r.status != 'Withdrawn'
      ORDER BY r.id DESC
      LIMIT 1
      `,
      [cId, empId, cleanName, cleanEmail]
    );
    return rows[0] || null;
  },

  async listRequests(companyId, filter = {}) {
    await ensureTable();
    const cId = parseRowId(companyId);
    if (!cId) return [];

    const {
      isCompanyAdmin,
      reviewerId,
      reviewerName = "",
      reviewerEmail = "",
      status,
      search,
      reason,
      department,
      lwdFrom,
      lwdTo,
    } = filter;

    let rId = parseRowId(reviewerId);
    const cleanName = String(reviewerName || "").trim().toLowerCase();
    const cleanEmail = String(reviewerEmail || "").trim().toLowerCase();

    // Resolve employee ID if reviewer was a ca_user
    if (!isCompanyAdmin && (cleanName || cleanEmail)) {
      try {
        const { rows } = await db.query(
          `SELECT id FROM public.ca_employees
           WHERE created_by_company_id = $1
             AND (
               ($2 <> '' AND lower(email) = $2)
               OR ($3 <> '' AND lower(name) = $3)
             )
           LIMIT 1`,
          [cId, cleanEmail, cleanName]
        );
        if (rows[0]?.id) {
          rId = parseRowId(rows[0].id);
        }
      } catch {}
    }

    const baseSelect = `
      SELECT 
        r.*,
        COALESCE(NULLIF(TRIM(r.department), ''), NULLIF(TRIM(e.department_name), ''), NULLIF(TRIM(e.details->>'department'), ''), NULLIF(TRIM(e.details->>'departmentName'), '')) AS department,
        COALESCE(NULLIF(TRIM(r.designation), ''), NULLIF(TRIM(e.designation_name), ''), NULLIF(TRIM(e.details->>'designation'), ''), NULLIF(TRIM(e.details->>'designationName'), '')) AS designation,
        COALESCE(NULLIF(TRIM(r.establishment_name), ''), NULLIF(TRIM(e.establishment_name), ''), NULLIF(TRIM(e.details->>'establishmentName'), '')) AS establishment_name,
        COALESCE(NULLIF(TRIM(r.employee_code), ''), NULLIF(TRIM(e.employee_code), '')) AS employee_code
      FROM public.ca_separation_requests r
      LEFT JOIN public.ca_employees e ON e.id = r.employee_id
    `;

    const whereClauses = ["r.company_id = $1"];
    const values = [cId];
    let idx = 2;

    if (!isCompanyAdmin) {
      whereClauses.push(`(
        ($${idx}::int IS NOT NULL AND (r.current_reviewer_id = $${idx}::int OR r.reporting_manager_id = $${idx}::int))
        OR ($${idx + 1} <> '' AND (lower(COALESCE(r.current_reviewer_name, '')) = $${idx + 1} OR lower(COALESCE(r.reporting_manager_name, '')) = $${idx + 1}))
      )`);
      values.push(rId, cleanName);
      idx += 2;
    }

    if (status && status !== "All") {
      const s = String(status).toLowerCase();
      if (s === "pending review" || s === "pending") {
        whereClauses.push(`r.status = 'Pending Review'`);
      } else if (s === "approved" || s === "forwarded") {
        whereClauses.push(`(r.status = 'Forwarded' OR r.status = 'Approved')`);
      } else if (s === "rejected") {
        whereClauses.push(`r.status = 'Retained'`);
      } else if (s === "retention") {
        whereClauses.push(`r.status = 'Retained'`);
      } else {
        whereClauses.push(`lower(r.status) = $${idx}`);
        values.push(s);
        idx++;
      }
    }

    if (reason && reason !== "All") {
      whereClauses.push(`lower(r.reason_category) = $${idx}`);
      values.push(String(reason).trim().toLowerCase());
      idx++;
    }

    if (department && department !== "All") {
      whereClauses.push(`lower(COALESCE(r.department, e.department_name, e.details->>'department', '')) = $${idx}`);
      values.push(String(department).trim().toLowerCase());
      idx++;
    }

    if (search && String(search).trim()) {
      const term = `%${String(search).trim().toLowerCase()}%`;
      whereClauses.push(`(
        lower(r.employee_name) LIKE $${idx}
        OR lower(COALESCE(r.employee_code, e.employee_code, '')) LIKE $${idx}
        OR lower(COALESCE(r.designation, e.designation_name, '')) LIKE $${idx}
        OR lower(COALESCE(r.department, e.department_name, '')) LIKE $${idx}
      )`);
      values.push(term);
      idx++;
    }

    if (lwdFrom) {
      whereClauses.push(`COALESCE(r.confirmed_last_working_day, r.proposed_last_working_day)::date >= $${idx}::date`);
      values.push(lwdFrom);
      idx++;
    }

    if (lwdTo) {
      whereClauses.push(`COALESCE(r.confirmed_last_working_day, r.proposed_last_working_day)::date <= $${idx}::date`);
      values.push(lwdTo);
      idx++;
    }

    const query = `
      ${baseSelect}
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY r.id DESC
    `;

    const { rows } = await db.query(query, values);
    return rows;
  },

  async update(id, companyId, updateFields) {
    await ensureTable();
    const reqId = parseRowId(id);
    const cId = parseRowId(companyId);
    if (!reqId || !cId) return null;

    const setClauses = [];
    const values = [reqId, cId];
    let idx = 3;

    if (updateFields.confirmedLastWorkingDay !== undefined) {
      setClauses.push(`confirmed_last_working_day = $${idx++}`);
      values.push(updateFields.confirmedLastWorkingDay);
    }
    if (updateFields.currentReviewerId !== undefined) {
      setClauses.push(`current_reviewer_id = $${idx++}`);
      values.push(parseRowId(updateFields.currentReviewerId));
    }
    if (updateFields.currentReviewerName !== undefined) {
      setClauses.push(`current_reviewer_name = $${idx++}`);
      values.push(updateFields.currentReviewerName);
    }
    if (updateFields.currentReviewerDept !== undefined) {
      setClauses.push(`current_reviewer_dept = $${idx++}`);
      values.push(updateFields.currentReviewerDept);
    }
    if (updateFields.status !== undefined) {
      setClauses.push(`status = $${idx++}`);
      values.push(updateFields.status);
    }
    if (updateFields.reviewHistory !== undefined) {
      setClauses.push(`review_history = $${idx++}`);
      values.push(JSON.stringify(updateFields.reviewHistory));
    }

    setClauses.push(`updated_at = NOW()`);

    const query = `
      UPDATE public.ca_separation_requests
      SET ${setClauses.join(", ")}
      WHERE id = $1 AND company_id = $2
      RETURNING *;
    `;

    const { rows } = await db.query(query, values);
    return rows[0] || null;
  },
};

