import { db } from "../../core/db/pool.js";
import {
  caHrMastersAlterSql,
  caHrMastersBackfillSql,
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
      for (const statement of caHrMastersBackfillSql
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
  m.id, m.master_type, m.name, m.related_id, m.start_time, m.end_time, m.total_hours, m.break_time,
  m.multiplier, m.days, m.code, m.country_id, m.country_name, m.eligible_gender_id, m.min_hours, m.max_hours,
  m.created_by_company_id, m.created_at,
  r.name AS related_name,
  g.name AS eligible_gender_name
`;

const fromJoin = `
  FROM public.ca_hr_masters m
  LEFT JOIN public.ca_hr_masters r
    ON r.id = m.related_id
   AND r.created_by_company_id = m.created_by_company_id
  LEFT JOIN public.ca_hr_masters g
    ON g.id = m.eligible_gender_id
   AND g.master_type = 'gender'
   AND g.created_by_company_id = m.created_by_company_id
`;

const emptySelectRow = `
  SELECT id, master_type, name, related_id, start_time, end_time, total_hours, break_time, multiplier, days, code,
         country_id, country_name, eligible_gender_id, min_hours, max_hours,
         created_by_company_id, created_at, NULL::text AS related_name, NULL::text AS eligible_gender_name
  FROM public.ca_hr_masters
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

  async findDuplicateName(companyId, masterType, name, excludeId = null, relatedId = null, countryId = null) {
    await ensureTable();
    const cid = parseRowId(companyId);

    if (!cid || !name) {
      return null;
    }

    const related = relatedId == null ? 0 : parseRowId(relatedId) || 0;
    const country = String(countryId || "all");
    const params = [cid, masterType, name.toLowerCase(), related, country];
    let excludeSql = "";

    if (excludeId) {
      const rowId = parseRowId(excludeId);
      if (rowId) {
        excludeSql = " AND id <> $6";
        params.push(rowId);
      }
    }

    const { rows } = await db.query(
      `
      ${emptySelectRow}
      WHERE created_by_company_id = $1
        AND master_type = $2
        AND lower(name) = $3
        AND COALESCE(related_id, 0) = $4
        AND COALESCE(country_id, 'all') = $5
        ${excludeSql}
      LIMIT 1
      `,
      params
    );

    return rows[0] ? mapCAHrMaster(rows[0]) : null;
  },

  async findDuplicateCode(companyId, masterType, code, excludeId = null, countryId = null) {
    await ensureTable();
    const cid = parseRowId(companyId);

    if (!cid || !code) {
      return null;
    }

    const country = String(countryId || "all");
    const params = [cid, masterType, code.toLowerCase(), country];
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
      ${emptySelectRow}
      WHERE created_by_company_id = $1
        AND master_type = $2
        AND lower(code) = $3
        AND COALESCE(country_id, 'all') = $4
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
    const eligibleGenderId =
      payload.eligibleGenderId != null ? parseRowId(payload.eligibleGenderId) : null;

    const { rows } = await db.query(
      `
      INSERT INTO public.ca_hr_masters (
        master_type, name, related_id, start_time, end_time, total_hours, break_time, multiplier, days, code,
        country_id, country_name, eligible_gender_id, min_hours, max_hours, created_by_company_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id
      `,
      [
        masterType,
        payload.name,
        relatedId,
        payload.startTime || null,
        payload.endTime || null,
        payload.totalHours || null,
        payload.breakTime || null,
        payload.multiplier || null,
        payload.days || null,
        payload.code || null,
        payload.countryId || null,
        payload.countryName || null,
        eligibleGenderId,
        payload.minHours || null,
        payload.maxHours || null,
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
    const eligibleGenderId =
      payload.eligibleGenderId != null ? parseRowId(payload.eligibleGenderId) : null;

    const { rowCount } = await db.query(
      `
      UPDATE public.ca_hr_masters
      SET
        name = $1,
        related_id = $2,
        start_time = $3,
        end_time = $4,
        total_hours = $5,
        break_time = $6,
        multiplier = $7,
        days = $8,
        code = $9,
        country_id = $10,
        country_name = $11,
        eligible_gender_id = $12,
        min_hours = $13,
        max_hours = $14,
        updated_at = NOW()
      WHERE id = $15 AND created_by_company_id = $16 AND master_type = $17
      `,
      [
        payload.name,
        relatedId,
        payload.startTime || null,
        payload.endTime || null,
        payload.totalHours || null,
        payload.breakTime || null,
        payload.multiplier || null,
        payload.days || null,
        payload.code || null,
        payload.countryId || null,
        payload.countryName || null,
        eligibleGenderId,
        payload.minHours || null,
        payload.maxHours || null,
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
