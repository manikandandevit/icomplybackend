import { db } from "../../core/db/pool.js";
import { caHolidaysIndexSql, caHolidaysTableSql, mapCAHoliday } from "./caHolidays.constants.js";

let ready = null;

const parseRowId = (id) => {
  const n = Number.parseInt(String(id ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caHolidaysTableSql);
      for (const statement of caHolidaysIndexSql
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
  id, name, holiday_date, end_date, holiday_type_id, holiday_type_name,
  establishment_id, establishment_name, country_id, country_name,
  created_by_company_id, created_at
`;

export const caHolidaysRepository = {
  async list(companyId, filter = {}) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return [];

    let sql = `
      SELECT ${selectColumns}
      FROM public.ca_holidays
      WHERE created_by_company_id = $1
    `;
    const params = [cid];

    if (filter.isEmployee) {
      const establishmentId = filter.establishmentId ? String(filter.establishmentId).trim() : null;
      const establishmentName = filter.establishmentName ? String(filter.establishmentName).trim() : null;

      if (establishmentId || establishmentName) {
        const conditions = [
          "establishment_id IS NULL",
          "lower(establishment_name) = 'all'",
        ];
        if (establishmentId && establishmentId !== "all") {
          params.push(parseRowId(establishmentId) || 0);
          conditions.push(`establishment_id = $${params.length}`);
        }
        if (establishmentName && establishmentName.toLowerCase() !== "all") {
          params.push(establishmentName);
          conditions.push(`lower(establishment_name) = lower($${params.length})`);
        }
        sql += ` AND (${conditions.join(" OR ")})`;
      } else {
        sql += ` AND (establishment_id IS NULL OR lower(establishment_name) = 'all')`;
      }
    } else if (filter.establishmentId && filter.establishmentId !== "all") {
      params.push(parseRowId(filter.establishmentId) || 0);
      sql += ` AND (establishment_id IS NULL OR establishment_id = $${params.length} OR lower(establishment_name) = 'all')`;
    }

    sql += ` ORDER BY holiday_date DESC, id DESC`;
    const { rows } = await db.query(sql, params);
    return rows.map(mapCAHoliday);
  },

  async findById(id, companyId) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return null;
    const { rows } = await db.query(
      `
      SELECT ${selectColumns}
      FROM public.ca_holidays
      WHERE id = $1 AND created_by_company_id = $2
      LIMIT 1
      `,
      [rowId, cid],
    );
    return rows[0] ? mapCAHoliday(rows[0]) : null;
  },

  async create(companyId, payload) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return null;

    const estId =
      payload.establishmentId === "all" || !payload.establishmentId
        ? null
        : parseRowId(payload.establishmentId);
    const estName = payload.establishmentName || (estId ? "" : "All");

    const { rows } = await db.query(
      `
      INSERT INTO public.ca_holidays (
        name, holiday_date, end_date, holiday_type_id, holiday_type_name,
        establishment_id, establishment_name, country_id, country_name, created_by_company_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id
      `,
      [
        payload.name,
        payload.startDate || payload.date,
        payload.endDate || payload.startDate || payload.date,
        parseRowId(payload.holidayTypeId),
        payload.holidayTypeName,
        estId,
        estName,
        payload.countryId || "all",
        payload.countryName || "All",
        cid,
      ],
    );
    return this.findById(rows[0].id, companyId);
  },

  async update(id, companyId, payload) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return null;

    const estId =
      payload.establishmentId === "all" || !payload.establishmentId
        ? null
        : parseRowId(payload.establishmentId);
    const estName = payload.establishmentName || (estId ? "" : "All");

    const { rows } = await db.query(
      `
      UPDATE public.ca_holidays
      SET name = $3, holiday_date = $4, end_date = $5, holiday_type_id = $6, holiday_type_name = $7,
          establishment_id = $8, establishment_name = $9, country_id = $10, country_name = $11, updated_at = NOW()
      WHERE id = $1 AND created_by_company_id = $2
      RETURNING id
      `,
      [
        rowId,
        cid,
        payload.name,
        payload.startDate || payload.date,
        payload.endDate || payload.startDate || payload.date,
        parseRowId(payload.holidayTypeId),
        payload.holidayTypeName,
        estId,
        estName,
        payload.countryId || "all",
        payload.countryName || "All",
      ],
    );
    if (!rows[0]) return null;
    return this.findById(rows[0].id, companyId);
  },

  async remove(id, companyId) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return false;
    const { rows } = await db.query(
      `
      DELETE FROM public.ca_holidays
      WHERE id = $1 AND created_by_company_id = $2
      RETURNING id
      `,
      [rowId, cid],
    );
    return Boolean(rows[0]);
  },
};
