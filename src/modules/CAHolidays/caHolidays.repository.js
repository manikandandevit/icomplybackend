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
  id, name, holiday_date, end_date, holiday_type_id, holiday_type_name, country_id, country_name,
  created_by_company_id, created_at
`;

export const caHolidaysRepository = {
  async list(companyId) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return [];
    const { rows } = await db.query(
      `
      SELECT ${selectColumns}
      FROM public.ca_holidays
      WHERE created_by_company_id = $1
      ORDER BY holiday_date DESC, id DESC
      `,
      [cid],
    );
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
    const { rows } = await db.query(
      `
      INSERT INTO public.ca_holidays (
        name, holiday_date, end_date, holiday_type_id, holiday_type_name, country_id, country_name, created_by_company_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id
      `,
      [
        payload.name,
        payload.startDate || payload.date,
        payload.endDate || payload.startDate || payload.date,
        parseRowId(payload.holidayTypeId),
        payload.holidayTypeName,
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
    const { rows } = await db.query(
      `
      UPDATE public.ca_holidays
      SET name = $3, holiday_date = $4, end_date = $5, holiday_type_id = $6, holiday_type_name = $7,
          country_id = $8, country_name = $9, updated_at = NOW()
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
