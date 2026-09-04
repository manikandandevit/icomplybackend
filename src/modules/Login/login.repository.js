import { db } from "../../core/db/pool.js";

export const loginRepository = {
  async findSuperAdminByEmail(email) {
    const { rows } = await db.query(
      `
      SELECT id, "User_Name", "Email", "Password", "Image_Url", "Role"
      FROM public."super_Admin"
      WHERE lower("Email") = lower($1)
      LIMIT 1
      `,
      [email],
    );

    return rows[0] ?? null;
  },

  async findSuperAdminById(id) {
    const { rows } = await db.query(
      `
      SELECT id, "User_Name", "Email", "Image_Url", "Role"
      FROM public."super_Admin"
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    return rows[0] ?? null;
  },

  async findCompanyByEmail(email) {
    const { rows } = await db.query(
      `
      SELECT
        id, legal_name, trade_name, email, password_hash, status, logo_url,
        plan, trial_days_left, trial_started_at, created_at
      FROM public.companies
      WHERE lower(email) = lower($1)
      LIMIT 1
      `,
      [email],
    );

    return rows[0] ?? null;
  },

  async findCompanyById(id) {
    const { rows } = await db.query(
      `
      SELECT
        id, legal_name, trade_name, email, status, logo_url,
        plan, trial_days_left, trial_started_at, created_at
      FROM public.companies
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    return rows[0] ?? null;
  },

  async markCompanyInactive(id) {
    await db.query(
      `
      UPDATE public.companies
      SET status = 'Inactive', trial_days_left = 0
      WHERE id = $1
      `,
      [id],
    );
  },

  async findCAUserByEmail(email) {
    const { rows } = await db.query(
      `
      SELECT
        id, name, email, role, designation_id, company_access, status, password_hash, created_by_company_id
      FROM public.ca_users
      WHERE lower(email) = lower($1)
      ORDER BY id DESC
      LIMIT 1
      `,
      [email],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: String(row.id),
      name: row.name,
      email: row.email,
      role: row.role,
      designationId: row.designation_id != null ? String(row.designation_id) : "",
      companyAccess: row.company_access || "All Companies",
      status: row.status === "Inactive" ? "Inactive" : "Active",
      passwordHash: row.password_hash,
      createdByCompanyId: row.created_by_company_id != null ? String(row.created_by_company_id) : "",
    };
  },

  async findCAUserById(id) {
    const { rows } = await db.query(
      `
      SELECT
        id, name, email, role, designation_id, company_access, status, created_by_company_id
      FROM public.ca_users
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: String(row.id),
      name: row.name,
      email: row.email,
      role: row.role,
      designationId: row.designation_id != null ? String(row.designation_id) : "",
      companyAccess: row.company_access || "All Companies",
      status: row.status === "Inactive" ? "Inactive" : "Active",
      createdByCompanyId: row.created_by_company_id != null ? String(row.created_by_company_id) : "",
    };
  },

  async findEmployeeByEmail(email) {
    const { rows } = await db.query(
      `
      SELECT
        id, name, email, status, password_hash, must_reset_password,
        created_by_company_id, company_id, company_name, company_source,
        department_name, designation_id, designation_name
      FROM public.ca_employees
      WHERE lower(email) = lower($1)
      ORDER BY id DESC
      LIMIT 1
      `,
      [email],
    );

    return rows[0] ?? null;
  },

  async findEmployeeById(id) {
    const { rows } = await db.query(
      `
      SELECT
        id, name, email, status, password_hash, must_reset_password,
        created_by_company_id, company_id, company_name, company_source,
        department_name, designation_id, designation_name
      FROM public.ca_employees
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    return rows[0] ?? null;
  },

  async updateEmployeePassword(id, passwordHash) {
    const { rows } = await db.query(
      `
      UPDATE public.ca_employees
      SET
        password_hash = $2,
        must_reset_password = FALSE,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, email, status, must_reset_password,
        created_by_company_id, company_id, company_name, company_source,
        department_name, designation_id, designation_name
      `,
      [id, passwordHash],
    );

    return rows[0] ?? null;
  },
};
