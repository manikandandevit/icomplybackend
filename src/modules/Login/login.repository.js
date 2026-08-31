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
};
