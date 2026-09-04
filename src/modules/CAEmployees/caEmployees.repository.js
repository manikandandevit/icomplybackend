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
  id, employee_code, name, email, mobile, join_date, status,
  company_id, company_source, company_name,
  establishment_id, establishment_name,
  department_id, department_name,
  designation_id, designation_name,
  employment_type_id, employment_type_name,
  shift_type_id, shift_type_name,
  ot_applicable, ot_type_id, ot_type_name,
  gender_id, gender_name, marital_status_id, marital_status_name,
  bank_details, details,
  created_by_company_id, created_at
`;

export const caEmployeesRepository = {
  async list(companyId) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return [];

    const { rows } = await db.query(
      `
      SELECT ${selectColumns}
      FROM public.ca_employees
      WHERE created_by_company_id = $1
      ORDER BY id DESC
      `,
      [cid]
    );
    return rows.map(mapCAEmployee);
  },

  async findById(id, companyId) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return null;

    const { rows } = await db.query(
      `
      SELECT ${selectColumns}
      FROM public.ca_employees
      WHERE id = $1 AND created_by_company_id = $2
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
        excludeSql = " AND id <> $3";
        params.push(rowId);
      }
    }

    const { rows } = await db.query(
      `
      SELECT ${selectColumns}
      FROM public.ca_employees
      WHERE created_by_company_id = $1 AND lower(employee_code) = $2
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
        establishment_id, establishment_name,
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
        $10,$11,
        $12,$13,
        $14,$15,
        $16,$17,
        $18,$19,
        $20,$21,$22,
        $23,$24,$25,$26,
        $27::jsonb,
        $28::jsonb,
        $29,
        $30,
        $31
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
          department_id = $14,
          department_name = $15,
          designation_id = $16,
          designation_name = $17,
          employment_type_id = $18,
          employment_type_name = $19,
          shift_type_id = $20,
          shift_type_name = $21,
          ot_applicable = $22,
          ot_type_id = $23,
          ot_type_name = $24,
          gender_id = $25,
          gender_name = $26,
          marital_status_id = $27,
          marital_status_name = $28,
          bank_details = $29::jsonb,
          details = $30::jsonb,
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
      return this.findById(rows[0].id, companyId);
    } catch (error) {
      if (error?.code === "23505") {
        throw new AppError("Employee code already exists", 409, "EMPLOYEE_CODE_DUPLICATE");
      }
      throw error;
    }
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
