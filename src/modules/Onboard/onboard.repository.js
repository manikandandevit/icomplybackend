import { db } from "../../core/db/pool.js";
import { countryIndexSql, countryTableSql } from "../Country/country.constants.js";
import { mapOnboard, onboardAlterSql, onboardIndexSql, onboardTableSql } from "./onboard.constants.js";

let ready = null;

const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(countryTableSql);
      await db.query(countryIndexSql);
      await db.query(onboardTableSql);
      await db.query(onboardIndexSql);
      for (const statement of onboardAlterSql
        .split(";")
        .map((sql) => sql.trim())
        .filter(Boolean)) {
        await db.query(statement);
      }
    })();
  }

  return ready;
};

const selectSql = `
  SELECT
    o.id, o.country_id, c.name AS country_name, o.amount,
    o.currency_code, o.currency_symbol, o.created_at
  FROM public.onboard o
  JOIN public.country c ON c.id = o.country_id
`;

export const onboardRepository = {
  async list() {
    await ensureTable();
    const { rows } = await db.query(`${selectSql} ORDER BY o.id ASC`);
    return rows.map(mapOnboard);
  },

  async findById(id) {
    await ensureTable();
    const { rows } = await db.query(`${selectSql} WHERE o.id = $1 LIMIT 1`, [id]);
    return rows[0] ? mapOnboard(rows[0]) : null;
  },

  async findByCountryId(countryId, excludeId) {
    await ensureTable();
    const { rows } = await db.query(
      excludeId
        ? `${selectSql} WHERE o.country_id = $1 AND o.id <> $2 LIMIT 1`
        : `${selectSql} WHERE o.country_id = $1 LIMIT 1`,
      excludeId ? [countryId, excludeId] : [countryId]
    );
    return rows[0] ? mapOnboard(rows[0]) : null;
  },

  async create(payload) {
    await ensureTable();
    const { rows } = await db.query(
      `
      INSERT INTO public.onboard (country_id, amount, currency_code, currency_symbol)
      VALUES ($1, $2, $3, $4)
      RETURNING id
      `,
      [payload.countryId, payload.amount, payload.currencyCode, payload.currencySymbol]
    );

    return this.findById(rows[0].id);
  },

  async update(id, payload) {
    await ensureTable();
    const { rows } = await db.query(
      `
      UPDATE public.onboard
      SET country_id = $2, amount = $3, currency_code = $4, currency_symbol = $5
      WHERE id = $1
      RETURNING id
      `,
      [id, payload.countryId, payload.amount, payload.currencyCode, payload.currencySymbol]
    );

    return rows[0] ? this.findById(rows[0].id) : null;
  },

  async remove(id) {
    await ensureTable();
    const { rowCount } = await db.query(`DELETE FROM public.onboard WHERE id = $1`, [id]);
    return rowCount > 0;
  },
};
