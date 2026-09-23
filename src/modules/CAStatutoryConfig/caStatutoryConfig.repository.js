import { db } from "../../core/db/pool.js";
import { caStatutoryConfigIndexSql, caStatutoryConfigTableSql, mapStatutoryConfig } from "./caStatutoryConfig.constants.js";

let ready = null;

const parseRowId = (id) => {
  const n = Number.parseInt(String(id ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caStatutoryConfigTableSql);
      for (const sql of caStatutoryConfigIndexSql.split(";").map((s) => s.trim()).filter(Boolean)) {
        await db.query(sql);
      }
    })();
  }
  return ready;
};

export const caStatutoryConfigRepository = {
  async list(companyId) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return [];
    
    const { rows } = await db.query(
      `SELECT id, created_by_company_id, country_id, establishment_id, statutory_name, base_component_id, eps_percentage, epf_percentage, rules, created_at, updated_at
       FROM public.ca_statutory_configs
       WHERE created_by_company_id = $1`,
      [cid]
    );
    
    return rows.map(mapStatutoryConfig);
  },

  async save(companyId, payload) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return null;

    const countryId = parseRowId(payload.countryId);
    const establishmentId = parseRowId(payload.establishmentId);
    const statutoryName = payload.statutoryName;

    // Check if it exists for this company, country, establishment, and statutoryName
    const { rows: existingRows } = await db.query(
      `SELECT id FROM public.ca_statutory_configs
       WHERE created_by_company_id = $1 AND country_id = $2 AND establishment_id = $3 AND statutory_name = $4
       LIMIT 1`,
      [cid, countryId, establishmentId, statutoryName]
    );

    const rulesJson = payload.rules ? JSON.stringify(payload.rules) : '[]';

    if (existingRows.length > 0) {
      // Update
      const { rows } = await db.query(
        `UPDATE public.ca_statutory_configs
         SET base_component_id = $1, eps_percentage = $2, epf_percentage = $3, rules = $4::jsonb, updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [
          payload.baseComponentId || null,
          payload.epsPercentage || 0,
          payload.epfPercentage || 0,
          rulesJson,
          existingRows[0].id
        ]
      );
      return rows[0] ? mapStatutoryConfig(rows[0]) : null;
    } else {
      // Insert
      const { rows } = await db.query(
        `INSERT INTO public.ca_statutory_configs
           (created_by_company_id, country_id, establishment_id, statutory_name, base_component_id, eps_percentage, epf_percentage, rules)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         RETURNING *`,
        [
          cid,
          countryId,
          establishmentId,
          statutoryName,
          payload.baseComponentId || null,
          payload.epsPercentage || 0,
          payload.epfPercentage || 0,
          rulesJson
        ]
      );
      return rows[0] ? mapStatutoryConfig(rows[0]) : null;
    }
  },

  async delete(id, companyId) {
    await ensureTable();
    const rowId = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!rowId || !cid) return false;
    
    const { rowCount } = await db.query(
      `DELETE FROM public.ca_statutory_configs WHERE id = $1 AND created_by_company_id = $2`,
      [rowId, cid]
    );
    return (rowCount ?? 0) > 0;
  }
};
