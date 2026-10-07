import { db } from "../../core/db/pool.js";
import { caEcrSlabsTableSql, caEcrSlabsIndexSql, mapCaEcrSlab } from "./caEcrSlabs.constants.js";

let ready = null;

const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caEcrSlabsTableSql);
      await db.query(caEcrSlabsIndexSql);
    })();
  }
  return ready;
};

export const caEcrSlabsRepository = {
  async list(companyId) {
    await ensureTable();
    const { rows } = await db.query(
      `SELECT * FROM public.ca_ecr_slabs WHERE created_by_company_id = $1 ORDER BY wage_type ASC, min_amount ASC`,
      [companyId]
    );
    return rows.map(mapCaEcrSlab);
  },

  async create(companyId, data) {
    await ensureTable();
    const { rows } = await db.query(
      `INSERT INTO public.ca_ecr_slabs (created_by_company_id, wage_type, min_amount, max_amount, calculation_type, fixed_value)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [companyId, data.wageType, data.minAmount, data.maxAmount, data.calculationType, data.fixedValue]
    );
    return mapCaEcrSlab(rows[0]);
  },

  async update(id, companyId, data) {
    await ensureTable();
    const { rows } = await db.query(
      `UPDATE public.ca_ecr_slabs 
       SET wage_type = $3, min_amount = $4, max_amount = $5, calculation_type = $6, fixed_value = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND created_by_company_id = $2 RETURNING *`,
      [id, companyId, data.wageType, data.minAmount, data.maxAmount, data.calculationType, data.fixedValue]
    );
    return rows[0] ? mapCaEcrSlab(rows[0]) : null;
  },

  async delete(id, companyId) {
    await ensureTable();
    const { rowCount } = await db.query(
      `DELETE FROM public.ca_ecr_slabs WHERE id = $1 AND created_by_company_id = $2`,
      [id, companyId]
    );
    return rowCount > 0;
  },

  async bulkSave(companyId, wageType, slabs) {
    await ensureTable();
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `DELETE FROM public.ca_ecr_slabs WHERE created_by_company_id = $1 AND wage_type = $2`,
        [companyId, wageType]
      );
      
      const inserted = [];
      for (const data of slabs) {
        const { rows } = await client.query(
          `INSERT INTO public.ca_ecr_slabs (created_by_company_id, wage_type, min_amount, max_amount, calculation_type, fixed_value)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [companyId, wageType, data.minAmount, data.maxAmount, data.calculationType, data.fixedValue]
        );
        inserted.push(mapCaEcrSlab(rows[0]));
      }
      
      await client.query("COMMIT");
      return inserted;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
};
