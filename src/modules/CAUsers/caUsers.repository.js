import { db } from "../../core/db/pool.js";
import { caUsersAlterSql, caUsersIndexSql, caUsersTableSql, mapCAUser } from "./caUsers.constants.js";

let ready = null;

const parseRowId = (id) => {
  const n = Number.parseInt(String(id ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caUsersTableSql);
      for (const statement of caUsersAlterSql
        .split(";")
        .map((sql) => sql.trim())
        .filter(Boolean)) {
        await db.query(statement);
      }
      for (const statement of caUsersIndexSql
        .split(";")
        .map((sql) => sql.trim())
        .filter(Boolean)) {
        await db.query(statement);
      }
    })();
  }

  return ready;
};

const selectColumns = `id, name, email, role, company_access, status, password_hash, created_by_company_id, created_at`;

export const caUsersRepository = {
  async list(companyId) {
    await ensureTable();
    const cid = parseRowId(companyId);

    if (!cid) {
      return [];
    }

    const { rows } = await db.query(
      `
      SELECT ${selectColumns}
      FROM public.ca_users
      WHERE created_by_company_id = $1
      ORDER BY id DESC
      `,
      [cid]
    );

    return rows.map(mapCAUser);
  },

  async findById(id, companyId) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);

    if (!rowId || !cid) {
      return null;
    }

    const { rows } = await db.query(
      `
      SELECT ${selectColumns}
      FROM public.ca_users
      WHERE id = $1 AND created_by_company_id = $2
      LIMIT 1
      `,
      [rowId, cid]
    );

    return rows[0] ? mapCAUser(rows[0]) : null;
  },

  async create(companyId, payload) {
    await ensureTable();
    const cid = parseRowId(companyId);

    if (!cid) {
      return null;
    }

    const { rows } = await db.query(
      `
      INSERT INTO public.ca_users (name, email, role, company_access, status, password_hash, created_by_company_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING ${selectColumns}
      `,
      [
        payload.name,
        payload.email,
        payload.role,
        payload.companyAccess,
        payload.status || "Active",
        payload.passwordHash,
        cid,
      ]
    );

    return mapCAUser(rows[0]);
  },

  async update(id, companyId, payload) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);

    if (!rowId || !cid) {
      return null;
    }

    const { rows } = await db.query(
      `
      UPDATE public.ca_users
      SET
        name = $1,
        email = $2,
        role = $3,
        company_access = $4,
        status = $5,
        password_hash = COALESCE($6, password_hash),
        updated_at = NOW()
      WHERE id = $7 AND created_by_company_id = $8
      RETURNING ${selectColumns}
      `,
      [
        payload.name,
        payload.email,
        payload.role,
        payload.companyAccess,
        payload.status,
        payload.passwordHash ?? null,
        rowId,
        cid,
      ]
    );

    return rows[0] ? mapCAUser(rows[0]) : null;
  },

  async updateStatus(id, companyId, status) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);

    if (!rowId || !cid) {
      return null;
    }

    const { rows } = await db.query(
      `
      UPDATE public.ca_users
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND created_by_company_id = $3
      RETURNING ${selectColumns}
      `,
      [status, rowId, cid]
    );

    return rows[0] ? mapCAUser(rows[0]) : null;
  },

  async delete(id, companyId) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);

    if (!rowId || !cid) {
      return false;
    }

    const { rowCount } = await db.query(
      `DELETE FROM public.ca_users WHERE id = $1 AND created_by_company_id = $2`,
      [rowId, cid]
    );

    return (rowCount ?? 0) > 0;
  },
};
