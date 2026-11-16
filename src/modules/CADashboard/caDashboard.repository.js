import { db } from "../../core/db/pool.js";

const parseRowId = (id) => {
  const n = Number.parseInt(String(id ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export const caDashboardRepository = {
  /** Active employees of the company with only the columns dashboards need
   *  (no profile details, bank data or compensation). */
  async listActiveColleagues(companyId) {
    const cid = parseRowId(companyId);
    if (!cid) return [];
    const { rows } = await db.query(
      `
      SELECT e.id, e.name, e.email, e.establishment_id, e.establishment_name, e.company_name,
             NULLIF(TRIM(COALESCE(e.details->>'dateOfBirth', '')), '') AS date_of_birth
      FROM public.ca_employees e
      WHERE e.created_by_company_id = $1
        AND COALESCE(e.status, 'Active') = 'Active'
      ORDER BY e.id DESC
      `,
      [cid],
    );
    return rows;
  },
};
