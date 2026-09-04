import { db } from "../../core/db/pool.js";
import {
  caDesignationPermissionsIndexSql,
  caDesignationPermissionsTableSql,
  mapPermission,
} from "./caPermissions.constants.js";

let ready = null;

const parseRowId = (id) => {
  const n = Number.parseInt(String(id ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caDesignationPermissionsTableSql);
      for (const statement of caDesignationPermissionsIndexSql
        .split(";")
        .map((sql) => sql.trim())
        .filter(Boolean)) {
        await db.query(statement);
      }
    })();
  }

  return ready;
};

export const caPermissionsRepository = {
  async listByCompany(companyId) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) {
      return [];
    }

    const { rows } = await db.query(
      `
      SELECT designation_id, nav_id, can_view, can_add, can_edit
      FROM public.ca_designation_permissions
      WHERE created_by_company_id = $1
      ORDER BY designation_id, nav_id
      `,
      [cid],
    );

    return rows.map(mapPermission);
  },

  async listByDesignation(companyId, designationId) {
    await ensureTable();
    const cid = parseRowId(companyId);
    const did = parseRowId(designationId);
    if (!cid || !did) {
      return [];
    }

    const { rows } = await db.query(
      `
      SELECT designation_id, nav_id, can_view, can_add, can_edit
      FROM public.ca_designation_permissions
      WHERE created_by_company_id = $1 AND designation_id = $2
      `,
      [cid, did],
    );

    return rows.map(mapPermission);
  },

  async listByDesignationName(companyId, designationName) {
    await ensureTable();
    const cid = parseRowId(companyId);
    const name = String(designationName || "").trim();
    if (!cid || !name) {
      return [];
    }

    const { rows } = await db.query(
      `
      SELECT p.designation_id, p.nav_id, p.can_view, p.can_add, p.can_edit
      FROM public.ca_designation_permissions p
      INNER JOIN public.ca_hr_masters m
        ON m.id = p.designation_id
       AND m.created_by_company_id = p.created_by_company_id
       AND m.master_type = 'designation'
      WHERE p.created_by_company_id = $1
        AND lower(m.name) = lower($2)
      `,
      [cid, name],
    );

    return rows.map(mapPermission);
  },

  async replaceAll(companyId, rows) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) {
      return [];
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM public.ca_designation_permissions WHERE created_by_company_id = $1`, [cid]);

      for (const row of rows) {
        const designationId = parseRowId(row.designationId);
        const navId = String(row.navId || "").trim();
        if (!designationId || !navId) {
          continue;
        }

        await client.query(
          `
          INSERT INTO public.ca_designation_permissions (
            created_by_company_id, designation_id, nav_id, can_view, can_add, can_edit
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [cid, designationId, navId, Boolean(row.view), Boolean(row.add), Boolean(row.edit)],
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return caPermissionsRepository.listByCompany(companyId);
  },
};
