import { db } from "../../core/db/pool.js";
import { caOffersTableSql, ALLOWED_OFFER_FIELDS } from "./caOffers.constants.js";

let ready = null;
const ensureTable = () => {
  if (!ready) {
    ready = db.query(caOffersTableSql);
  }
  return ready;
};

export const caOffersRepository = {
  async list(companyId, status) {
    await ensureTable();
    let query = `SELECT * FROM public.ca_offers WHERE created_by_company_id = $1`;
    const params = [companyId];

    if (status) {
      query += ` AND lower(status) = lower($2)`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    const res = await db.query(query, params);
    return res.rows;
  },

  async getById(id, companyId) {
    await ensureTable();
    const res = await db.query(
      `SELECT * FROM public.ca_offers 
       WHERE id = $1 AND created_by_company_id = $2`,
      [id, companyId]
    );
    return res.rows[0] || null;
  },

  async create(companyId, data) {
    await ensureTable();
    const {
      candidate_id,
      candidate_name,
      role,
      ctc,
      joining_bonus,
      joining_date,
      sent_on,
      status = "Sent",
      deadline,
      req_id,
      document_name,
      document_url,
      documents,
    } = data;

    const res = await db.query(
      `INSERT INTO public.ca_offers (
        created_by_company_id,
        candidate_id,
        candidate_name,
        role,
        ctc,
        joining_bonus,
        joining_date,
        sent_on,
        status,
        deadline,
        req_id,
        document_name,
        document_url,
        documents,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()
      ) RETURNING *`,
      [
        companyId,
        candidate_id || null,
        candidate_name,
        role,
        ctc,
        joining_bonus,
        joining_date,
        sent_on || new Date().toISOString().split("T")[0],
        status,
        deadline,
        req_id,
        document_name,
        document_url,
        documents ? JSON.stringify(documents) : null,
      ]
    );
    return res.rows[0];
  },

  async updateStatus(id, companyId, status) {
    await ensureTable();
    const res = await db.query(
      `UPDATE public.ca_offers 
       SET status = $1, updated_at = NOW() 
       WHERE id = $2 AND created_by_company_id = $3 
       RETURNING *`,
      [status, id, companyId]
    );
    return res.rows[0];
  },

  async update(id, companyId, data) {
    await ensureTable();
    const fields = [];
    const values = [];
    let idx = 1;

    for (const key of ALLOWED_OFFER_FIELDS) {
      if (data[key] !== undefined) {
        fields.push(`${key} = $${idx}`);
        values.push(key === "documents" && typeof data[key] === "object" ? JSON.stringify(data[key]) : data[key]);
        idx++;
      }
    }

    if (fields.length === 0) {
      return this.getById(id, companyId);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id, companyId);

    const query = `
      UPDATE public.ca_offers 
      SET ${fields.join(", ")} 
      WHERE id = $${idx} AND created_by_company_id = $${idx + 1} 
      RETURNING *
    `;

    const res = await db.query(query, values);
    return res.rows[0];
  },

  async delete(id, companyId) {
    await ensureTable();
    const res = await db.query(
      `DELETE FROM public.ca_offers 
       WHERE id = $1 AND created_by_company_id = $2`,
      [id, companyId]
    );
    return res.rowCount > 0;
  },
};
