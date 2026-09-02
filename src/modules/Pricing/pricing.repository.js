import { db } from "../../core/db/pool.js";
import {
  countryIndexSql,
  countryTableSql,
  mapPricing,
  pricingAlterSql,
  pricingIndexSql,
  pricingTableSql,
} from "./pricing.constants.js";

let ready = null;

const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(countryTableSql);
      await db.query(countryIndexSql);
      await db.query(pricingTableSql);
      await db.query(pricingIndexSql);
      for (const statement of pricingAlterSql
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
    p.id, p.country_id, c.name AS country_name,
    p.currency_code, p.currency_symbol, p.per_user_price, p.country_prices, p.created_at
  FROM public.pricing p
  JOIN public.country c ON c.id = p.country_id
`;

export const pricingRepository = {
  async list() {
    await ensureTable();
    const { rows } = await db.query(`${selectSql} ORDER BY p.id ASC`);
    return rows.map(mapPricing);
  },

  async findById(id) {
    await ensureTable();
    const { rows } = await db.query(`${selectSql} WHERE p.id = $1 LIMIT 1`, [id]);
    return rows[0] ? mapPricing(rows[0]) : null;
  },

  async findByCountryId(countryId, excludeId) {
    await ensureTable();
    const { rows } = await db.query(
      excludeId
        ? `${selectSql} WHERE p.country_id = $1 AND p.id <> $2 LIMIT 1`
        : `${selectSql} WHERE p.country_id = $1 LIMIT 1`,
      excludeId ? [countryId, excludeId] : [countryId]
    );
    return rows[0] ? mapPricing(rows[0]) : null;
  },

  async create(payload) {
    await ensureTable();
    const { rows } = await db.query(
      `
      INSERT INTO public.pricing (country_id, currency_code, currency_symbol, per_user_price, country_prices)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING id
      `,
      [
        payload.countryId,
        payload.currencyCode,
        payload.currencySymbol,
        payload.perUserPrice,
        JSON.stringify(payload.countryPrices ?? {}),
      ]
    );

    return this.findById(rows[0].id);
  },

  async update(id, payload) {
    await ensureTable();
    const { rows } = await db.query(
      `
      UPDATE public.pricing SET
        country_id = $2,
        currency_code = $3,
        currency_symbol = $4,
        per_user_price = $5,
        country_prices = $6::jsonb
      WHERE id = $1
      RETURNING id
      `,
      [
        id,
        payload.countryId,
        payload.currencyCode,
        payload.currencySymbol,
        payload.perUserPrice,
        JSON.stringify(payload.countryPrices ?? {}),
      ]
    );

    return rows[0] ? this.findById(rows[0].id) : null;
  },

  async remove(id) {
    await ensureTable();
    const { rowCount } = await db.query(`DELETE FROM public.pricing WHERE id = $1`, [id]);
    return rowCount > 0;
  },
};
