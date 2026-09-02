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
      [email]
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
      [id]
    );

    return rows[0] ?? null;
  },

  async findCompanyByEmail(email) {
    const { rows } = await db.query(
      `
      SELECT
        id, legal_name, trade_name, email, password_hash, status, logo_url
      FROM public.companies
      WHERE lower(email) = lower($1)
      LIMIT 1
      `,
      [email]
    );

    return rows[0] ?? null;
  },

  async findCompanyById(id) {
    const { rows } = await db.query(
      `
      SELECT
        id, legal_name, trade_name, email, status, logo_url
      FROM public.companies
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    return rows[0] ?? null;
  },
};
