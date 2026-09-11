import { db } from "../../core/db/pool.js";
import { AppError } from "../../core/errors/AppError.js";
import { caEmployeesIndexSql, caEmployeesTableSql, mapCAEmployee } from "./caEmployees.constants.js";

let ready = null;

const parseRowId = (id) => {
  const n = Number.parseInt(String(id ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caEmployeesTableSql);
      for (const statement of caEmployeesIndexSql
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
  e.id, e.employee_code, e.name, e.email, e.mobile, e.join_date, e.status,
  e.company_id, e.company_source, e.company_name,
  e.establishment_id, e.establishment_name, e.ctc,
  e.department_id, e.department_name,
  e.designation_id, e.designation_name,
  e.employment_type_id, e.employment_type_name,
  e.shift_type_id, e.shift_type_name,
  e.ot_applicable, e.ot_type_id, e.ot_type_name,
  e.gender_id, e.gender_name, e.marital_status_id, e.marital_status_name,
  e.bank_details, e.details,
  e.created_by_company_id, e.created_at,
  NULLIF(TRIM(mgr.name), '') AS live_reporting_to_name
`;

const fromJoined = `
  FROM public.ca_employees e
  LEFT JOIN public.ca_employees mgr
    ON mgr.created_by_company_id = e.created_by_company_id
   AND mgr.id::text = NULLIF(TRIM(COALESCE(e.details->>'reportingToId', '')), '')
`;

export const caEmployeesRepository = {
  async list(companyId) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return [];

    const { rows } = await db.query(
      `
      SELECT ${selectColumns}
      ${fromJoined}
      WHERE e.created_by_company_id = $1
      ORDER BY e.id DESC
      `,
      [cid]
    );
    return rows.map(mapCAEmployee);
  },

  /** Returns Active employee counts grouped by company and establishment.
   *  Used by the Companies and Establishments pages to show real headcount.
   */
  async countsByCompany(companyId) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return { byCompany: {}, byEstablishment: {}, total: 0 };

    const { rows } = await db.query(
      `
      SELECT
        company_source,
        company_id::text,
        establishment_id::text,
        COUNT(*)::int AS cnt
      FROM public.ca_employees
      WHERE created_by_company_id = $1
        AND status = 'Active'
      GROUP BY company_source, company_id, establishment_id
      `,
      [cid]
    );

    const byCompany = {};
    const byEstablishment = {};
    let total = 0;

    for (const row of rows) {
      const companyKey = `${row.company_source === 'ca' ? 'ca' : 'parent'}:${row.company_id}`;
      byCompany[companyKey] = (byCompany[companyKey] ?? 0) + row.cnt;
      if (row.establishment_id) {
        byEstablishment[row.establishment_id] = (byEstablishment[row.establishment_id] ?? 0) + row.cnt;
      }
      total += row.cnt;
    }

    return { byCompany, byEstablishment, total };
  },

  /** Active employee counts grouped by establishment country. */
  async activeCountsByCountry(companyId) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return {};

    const { rows } = await db.query(
      `
      SELECT est.country_id::text AS country_id, COUNT(*)::int AS cnt
      FROM public.ca_employees e
      JOIN public.ca_establishments est ON e.establishment_id = est.id
      WHERE e.created_by_company_id = $1
        AND e.status = 'Active'
        AND est.country_id IS NOT NULL
      GROUP BY est.country_id
      `,
      [cid]
    );

    const counts = {};
    for (const row of rows) {
      if (row.country_id) {
        counts[row.country_id] = Number(row.cnt) || 0;
      }
    }
    return counts;
  },

  /** Counts active employees in a specific country, optionally excluding one employee (for edits). */
  async countActiveByCountry(companyId, countryId, excludeEmployeeId = null) {
    await ensureTable();
    const cid = parseRowId(companyId);
    const coId = parseRowId(countryId);
    if (!cid || !coId) return 0;

    const excludeId = parseRowId(excludeEmployeeId);
    const query = excludeId
      ? `
        SELECT COUNT(*)::int AS cnt
        FROM public.ca_employees e
        JOIN public.ca_establishments est ON e.establishment_id = est.id
        WHERE e.created_by_company_id = $1
          AND est.country_id = $2
          AND e.status = 'Active'
          AND e.id != $3
        `
      : `
        SELECT COUNT(*)::int AS cnt
        FROM public.ca_employees e
        JOIN public.ca_establishments est ON e.establishment_id = est.id
        WHERE e.created_by_company_id = $1
          AND est.country_id = $2
          AND e.status = 'Active'
        `;
    const params = excludeId ? [cid, coId, excludeId] : [cid, coId];
    const { rows } = await db.query(query, params);
    return Number(rows[0]?.cnt) || 0;
  },

  async findById(id, companyId) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return null;

    const { rows } = await db.query(
      `
      SELECT ${selectColumns}
      ${fromJoined}
      WHERE e.id = $1 AND e.created_by_company_id = $2
      LIMIT 1
      `,
      [rowId, cid]
    );
    return rows[0] ? mapCAEmployee(rows[0]) : null;
  },

  async findByCode(companyId, code, excludeId = null) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid || !code) return null;

    const params = [cid, code.toLowerCase()];
    let excludeSql = "";
    if (excludeId) {
      const rowId = parseRowId(excludeId);
      if (rowId) {
        excludeSql = " AND e.id <> $3";
        params.push(rowId);
      }
    }

    const { rows } = await db.query(
      `
      SELECT ${selectColumns}
      ${fromJoined}
      WHERE e.created_by_company_id = $1 AND lower(e.employee_code) = $2
      ${excludeSql}
      LIMIT 1
      `,
      params
    );
    return rows[0] ? mapCAEmployee(rows[0]) : null;
  },

  async create(companyId, payload) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return null;

    try {
      const { rows } = await db.query(
        `
      INSERT INTO public.ca_employees (
        employee_code, name, email, mobile, join_date, status,
        company_id, company_source, company_name,
        establishment_id, establishment_name, ctc,
        department_id, department_name,
        designation_id, designation_name,
        employment_type_id, employment_type_name,
        shift_type_id, shift_type_name,
        ot_applicable, ot_type_id, ot_type_name,
        gender_id, gender_name, marital_status_id, marital_status_name,
        bank_details, details, password_hash, must_reset_password,
        created_by_company_id
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,
        $10,$11,$12,
        $13,$14,
        $15,$16,
        $17,$18,
        $19,$20,
        $21,$22,$23,
        $24,$25,$26,$27,
        $28::jsonb,
        $29::jsonb,
        $30,
        $31,
        $32
      )
      RETURNING id
      `,
        [
          payload.employeeCode,
          payload.name,
          payload.email,
          payload.mobile,
          payload.joinDate,
          payload.status || "Active",
          parseRowId(payload.companyId),
          payload.companySource,
          payload.companyName,
          parseRowId(payload.establishmentId),
          payload.establishmentName,
          payload.ctc != null && payload.ctc !== "" ? Number(payload.ctc) : null,
          parseRowId(payload.departmentId),
          payload.departmentName,
          parseRowId(payload.designationId),
          payload.designationName,
          parseRowId(payload.employmentTypeId),
          payload.employmentTypeName,
          payload.shiftTypeId ? parseRowId(payload.shiftTypeId) : null,
          payload.shiftTypeName || null,
          Boolean(payload.otApplicable),
          payload.otApplicable ? parseRowId(payload.otTypeId) : null,
          payload.otApplicable ? payload.otTypeName || null : null,
          payload.genderId ? parseRowId(payload.genderId) : null,
          payload.genderName || null,
          payload.maritalStatusId ? parseRowId(payload.maritalStatusId) : null,
          payload.maritalStatusName || null,
          JSON.stringify(Array.isArray(payload.bankDetails) ? payload.bankDetails : []),
          JSON.stringify(payload.details && typeof payload.details === "object" ? payload.details : {}),
          payload.passwordHash || null,
          payload.mustResetPassword !== false,
          cid,
        ]
      );

      return this.findById(rows[0].id, companyId);
    } catch (error) {
      if (error?.code === "23505") {
        throw new AppError("Employee code already exists", 409, "EMPLOYEE_CODE_DUPLICATE");
      }
      throw error;
    }
  },

  async updateStatus(id, companyId, status) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return null;

    const next = status === "Inactive" ? "Inactive" : "Active";
    const { rows } = await db.query(
      `
      UPDATE public.ca_employees
      SET status = $3, updated_at = NOW()
      WHERE id = $1 AND created_by_company_id = $2
      RETURNING id
      `,
      [rowId, cid, next]
    );
    if (!rows[0]) return null;
    return this.findById(rows[0].id, companyId);
  },

  async update(id, companyId, payload) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return null;

    try {
      const { rows } = await db.query(
        `
        UPDATE public.ca_employees
        SET
          employee_code = $3,
          name = $4,
          email = $5,
          mobile = $6,
          join_date = $7,
          status = $8,
          company_id = $9,
          company_source = $10,
          company_name = $11,
          establishment_id = $12,
          establishment_name = $13,
          ctc = $14,
          department_id = $15,
          department_name = $16,
          designation_id = $17,
          designation_name = $18,
          employment_type_id = $19,
          employment_type_name = $20,
          shift_type_id = $21,
          shift_type_name = $22,
          ot_applicable = $23,
          ot_type_id = $24,
          ot_type_name = $25,
          gender_id = $26,
          gender_name = $27,
          marital_status_id = $28,
          marital_status_name = $29,
          bank_details = $30::jsonb,
          details = $31::jsonb,
          updated_at = NOW()
        WHERE id = $1 AND created_by_company_id = $2
        RETURNING id
        `,
        [
          rowId,
          cid,
          payload.employeeCode,
          payload.name,
          payload.email,
          payload.mobile,
          payload.joinDate,
          payload.status || "Active",
          parseRowId(payload.companyId),
          payload.companySource,
          payload.companyName,
          parseRowId(payload.establishmentId),
          payload.establishmentName,
          payload.ctc != null && payload.ctc !== "" ? Number(payload.ctc) : null,
          parseRowId(payload.departmentId),
          payload.departmentName,
          parseRowId(payload.designationId),
          payload.designationName,
          parseRowId(payload.employmentTypeId),
          payload.employmentTypeName,
          payload.shiftTypeId ? parseRowId(payload.shiftTypeId) : null,
          payload.shiftTypeName || null,
          Boolean(payload.otApplicable),
          payload.otApplicable ? parseRowId(payload.otTypeId) : null,
          payload.otApplicable ? payload.otTypeName || null : null,
          payload.genderId ? parseRowId(payload.genderId) : null,
          payload.genderName || null,
          payload.maritalStatusId ? parseRowId(payload.maritalStatusId) : null,
          payload.maritalStatusName || null,
          JSON.stringify(Array.isArray(payload.bankDetails) ? payload.bankDetails : []),
          JSON.stringify(payload.details && typeof payload.details === "object" ? payload.details : {}),
        ]
      );

      if (!rows[0]) return null;
      const employee = await this.findById(rows[0].id, companyId);
      if (employee) {
        await this.syncDenormalizedProfile(companyId, employee);
      }
      return employee;
    } catch (error) {
      if (error?.code === "23505") {
        throw new AppError("Employee code already exists", 409, "EMPLOYEE_CODE_DUPLICATE");
      }
      throw error;
    }
  },

  async syncDenormalizedProfile(companyId, employee) {
    const cid = parseRowId(companyId);
    const empId = parseRowId(employee?.id);
    if (!cid || !empId) return;

    const name = String(employee.name || "").trim();
    const code = String(employee.employeeCode || "").trim();
    const estId = parseRowId(employee.establishmentId);
    const estName = String(employee.establishmentName || "").trim();
    const empText = String(empId);

    const ignoreMissingTable = async (fn) => {
      try {
        await fn();
      } catch (error) {
        if (error?.code === "42P01" || error?.code === "42703") return;
        throw error;
      }
    };

    await ignoreMissingTable(() =>
      db.query(
        `
        UPDATE public.ca_attendance
        SET employee_name = $3,
            employee_code = $4,
            establishment_id = COALESCE($5, establishment_id),
            establishment_name = CASE WHEN $6 = '' THEN establishment_name ELSE $6 END,
            updated_at = NOW()
        WHERE created_by_company_id = $1 AND employee_id = $2
        `,
        [cid, empId, name, code, estId, estName],
      ),
    );

    await ignoreMissingTable(() =>
      db.query(
        `
        UPDATE public.ca_leave_requests
        SET employee_name = $3,
            employee_code = $4,
            establishment_id = COALESCE($5, establishment_id),
            establishment_name = CASE WHEN $6 = '' THEN establishment_name ELSE $6 END,
            updated_at = NOW()
        WHERE created_by_company_id = $1 AND employee_id = $2
        `,
        [cid, empId, name, code, estId, estName],
      ),
    );

    await ignoreMissingTable(() =>
      db.query(
        `
        UPDATE public.ca_leave_requests
        SET approver_name = $3, updated_at = NOW()
        WHERE created_by_company_id = $1 AND reporting_to_id = $2
        `,
        [cid, empId, name],
      ),
    );

    await ignoreMissingTable(() =>
      db.query(
        `
        UPDATE public.ca_leave_revokes
        SET employee_name = $3,
            employee_code = $4,
            establishment_id = COALESCE($5, establishment_id),
            establishment_name = CASE WHEN $6 = '' THEN establishment_name ELSE $6 END,
            updated_at = NOW()
        WHERE created_by_company_id = $1 AND employee_id = $2
        `,
        [cid, empId, name, code, estId, estName],
      ),
    );

    await ignoreMissingTable(() =>
      db.query(
        `
        UPDATE public.ca_leave_revokes
        SET approver_name = $3, updated_at = NOW()
        WHERE created_by_company_id = $1 AND reporting_to_id = $2
        `,
        [cid, empId, name],
      ),
    );

    await db.query(
      `
      UPDATE public.ca_employees
      SET details = jsonb_set(COALESCE(details, '{}'::jsonb), '{reportingToName}', to_jsonb($3::text), true),
          updated_at = NOW()
      WHERE created_by_company_id = $1
        AND id <> $2
        AND (details->>'reportingToId') = $4
      `,
      [cid, empId, name, empText],
    );
  },

  async delete(id, companyId) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return false;

    const { rowCount } = await db.query(
      `DELETE FROM public.ca_employees WHERE id = $1 AND created_by_company_id = $2`,
      [rowId, cid]
    );
    return (rowCount ?? 0) > 0;
  },
};
