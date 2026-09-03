import { db } from "../../core/db/pool.js";
import {
  caHrMastersAlterSql,
  caHrMastersIndexSql,
  caHrMastersTableSql,
  mapCAHrMaster,
} from "./caHrMaster.constants.js";

let ready = null;

const parseRowId = (id) => {
  const n = Number.parseInt(String(id ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caHrMastersTableSql);
      for (const statement of caHrMastersAlterSql
        .split(";")
        .map((sql) => sql.trim())
        .filter(Boolean)) {
        await db.query(statement);
      }
      for (const statement of caHrMastersIndexSql
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
  m.id, m.master_type, m.name, m.related_id, m.start_time, m.end_time, m.total_hours, m.multiplier,
  m.created_by_company_id, m.created_at,
  d.name AS department_name
`;

const fromJoin = `
  FROM public.ca_hr_masters m
  LEFT JOIN public.ca_hr_masters d
    ON d.id = m.related_id
   AND d.master_type = 'department'
   AND d.created_by_company_id = m.created_by_company_id
`;

export const caHrMasterRepository = {
  async list(companyId, masterType) {
    await ensureTable();
    const cid = parseRowId(companyId);

    if (!cid) {
      return [];
    }

    const { rows } = await db.query(
      `
      SELECT ${selectColumns}
      ${fromJoin}
      WHERE m.created_by_company_id = $1 AND m.master_type = $2
      ORDER BY m.id DESC
      `,
      [cid, masterType]
    );

    return rows.map(mapCAHrMaster);
  },

  async findById(id, companyId, masterType) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);

    if (!rowId || !cid) {
      return null;
    }

    const { rows } = await db.query(
      `
      SELECT ${selectColumns}
      ${fromJoin}
      WHERE m.id = $1 AND m.created_by_company_id = $2 AND m.master_type = $3
      LIMIT 1
      `,
      [rowId, cid, masterType]
    );

    return rows[0] ? mapCAHrMaster(rows[0]) : null;
  },

  async findDuplicateName(companyId, masterType, name, excludeId = null, relatedId = null) {
    await ensureTable();
    const cid = parseRowId(companyId);

    if (!cid || !name) {
      return null;
    }

    const related = relatedId == null ? 0 : parseRowId(relatedId) || 0;
    const params = [cid, masterType, name.toLowerCase(), related];
    let excludeSql = "";

    if (excludeId) {
      const rowId = parseRowId(excludeId);
      if (rowId) {
        excludeSql = " AND id <> $5";
        params.push(rowId);
      }
    }

    const { rows } = await db.query(
      `
      SELECT id, master_type, name, related_id, start_time, end_time, total_hours, multiplier,
             created_by_company_id, created_at, NULL::text AS department_name
      FROM public.ca_hr_masters
      WHERE created_by_company_id = $1
        AND master_type = $2
        AND lower(name) = $3
        AND COALESCE(related_id, 0) = $4
        ${excludeSql}
      LIMIT 1
      `,
      params
    );

    return rows[0] ? mapCAHrMaster(rows[0]) : null;
  },

  async create(companyId, masterType, payload) {
    await ensureTable();
    const cid = parseRowId(companyId);

    if (!cid) {
      return null;
    }

    const relatedId = payload.relatedId != null ? parseRowId(payload.relatedId) : null;

    const { rows } = await db.query(
      `
      INSERT INTO public.ca_hr_masters (
        master_type, name, related_id, start_time, end_time, total_hours, multiplier, created_by_company_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
      `,
      [
        masterType,
        payload.name,
        relatedId,
        payload.startTime || null,
        payload.endTime || null,
        payload.totalHours || null,
        payload.multiplier || null,
        cid,
      ]
    );

    return this.findById(rows[0].id, companyId, masterType);
  },

  async update(id, companyId, masterType, payload) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);

    if (!rowId || !cid) {
      return null;
    }

    const relatedId = payload.relatedId != null ? parseRowId(payload.relatedId) : null;

    const { rowCount } = await db.query(
      `
      UPDATE public.ca_hr_masters
      SET
        name = $1,
        related_id = $2,
        start_time = $3,
        end_time = $4,
        total_hours = $5,
        multiplier = $6,
        updated_at = NOW()
      WHERE id = $7 AND created_by_company_id = $8 AND master_type = $9
      `,
      [
        payload.name,
        relatedId,
        payload.startTime || null,
        payload.endTime || null,
        payload.totalHours || null,
        payload.multiplier || null,
        rowId,
        cid,
        masterType,
      ]
    );

    if ((rowCount ?? 0) === 0) {
      return null;
    }

    return this.findById(id, companyId, masterType);
  },

  async delete(id, companyId, masterType) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);

    if (!rowId || !cid) {
      return false;
    }

    const { rowCount } = await db.query(
      `
      DELETE FROM public.ca_hr_masters
      WHERE id = $1 AND created_by_company_id = $2 AND master_type = $3
      `,
      [rowId, cid, masterType]
    );

    return (rowCount ?? 0) > 0;
  },
};
