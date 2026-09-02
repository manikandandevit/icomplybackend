import { db } from "../../core/db/pool.js";
import { countryIndexSql, countryTableSql, mapCountry } from "./country.constants.js";

let ready = null;

const ensureTable = () => {
  if (!ready) {
    ready = db.query(countryTableSql).then(() => db.query(countryIndexSql));
  }

  return ready;
};

export const countryRepository = {
  async list() {
    await ensureTable();
    const { rows } = await db.query(
      `
      SELECT id, name, created_at
      FROM public.country
      ORDER BY id ASC
      `
    );

    return rows.map(mapCountry);
  },

  async findById(id) {
    await ensureTable();
    const { rows } = await db.query(
      `
      SELECT id, name, created_at
      FROM public.country
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    return rows[0] ? mapCountry(rows[0]) : null;
  },

  async findByName(name, excludeId) {
    await ensureTable();
    const { rows } = await db.query(
      excludeId
        ? `
          SELECT id, name, created_at
          FROM public.country
          WHERE lower(name) = lower($1) AND id <> $2
          LIMIT 1
          `
        : `
          SELECT id, name, created_at
          FROM public.country
          WHERE lower(name) = lower($1)
          LIMIT 1
          `,
      excludeId ? [name, excludeId] : [name]
    );

    return rows[0] ? mapCountry(rows[0]) : null;
  },

  async create(name) {
    await ensureTable();
    const { rows } = await db.query(
      `
      INSERT INTO public.country (name)
      VALUES ($1)
      RETURNING id, name, created_at
      `,
      [name]
    );

    return mapCountry(rows[0]);
  },

  async update(id, name) {
    await ensureTable();
    const { rows } = await db.query(
      `
      UPDATE public.country
      SET name = $2
      WHERE id = $1
      RETURNING id, name, created_at
      `,
      [id, name]
    );

    return rows[0] ? mapCountry(rows[0]) : null;
  },

  async remove(id) {
    await ensureTable();
    const { rowCount } = await db.query(
      `
      DELETE FROM public.country
      WHERE id = $1
      `,
      [id]
    );

    return rowCount > 0;
  },
};
