import { db } from "../../core/db/pool.js";
import { caOffersTableSql, mapCAOffer } from "./caOffers.constants.js";

let ready = null;
const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caOffersTableSql);
      await db.query(`ALTER TABLE public.ca_offers ADD COLUMN IF NOT EXISTS candidate_name VARCHAR(255);`);
      await db.query(`ALTER TABLE public.ca_offers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;`);
      await db.query(`ALTER TABLE public.ca_offers ADD COLUMN IF NOT EXISTS deadline VARCHAR(100);`);
      await db.query(`ALTER TABLE public.ca_offers ADD COLUMN IF NOT EXISTS req_id VARCHAR(100);`);
    })();
  }
  return ready;
};

export const caOffersRepository = {
  async ensureTable() {
    return ensureTable();
  },

  async list(companyId, filter = {}) {
    await ensureTable();
    // Auto-sync any candidates with stage = 'Offer' into ca_offers if not present
    await db.query(`
      INSERT INTO public.ca_offers (
        created_by_company_id, candidate_id, candidate_name, role, status, ctc, joining_bonus, joining_date, sent_on
      )
      SELECT 
        c.created_by_company_id,
        c.id,
        c.name,
        c.role,
        'Pending Acceptance',
        '₹96,000/mo',
        '₹1,20,000',
        TO_CHAR(NOW() + INTERVAL '15 days', 'DD Mon YYYY'),
        TO_CHAR(NOW(), 'DD Mon YYYY')
      FROM public.ca_candidates c
      WHERE c.created_by_company_id = $1 AND c.stage = 'Offer'
        AND NOT EXISTS (
          SELECT 1 FROM public.ca_offers o WHERE o.candidate_id = c.id AND o.created_by_company_id = $1
        )
    `, [companyId]);

    let query = `
      SELECT 
        o.*,
        COALESCE(c.name, o.candidate_name) AS candidate,
        COALESCE(c.role, o.role) AS role,
        c.email,
        c.phone,
        c.location,
        c.experience,
        c.skills,
        COALESCE(o.req_id, jr.req_id) AS req_id,
        jr.job_id
      FROM public.ca_offers o
      LEFT JOIN public.ca_candidates c ON o.candidate_id = c.id
      LEFT JOIN LATERAL (
        SELECT jr.req_id, jr.id AS job_id
        FROM public.ca_job_requisitions jr
        WHERE jr.created_by_company_id = o.created_by_company_id
          AND LOWER(TRIM(jr.position)) = LOWER(TRIM(COALESCE(c.role, o.role)))
        ORDER BY jr.id DESC
        LIMIT 1
      ) jr ON true
      WHERE o.created_by_company_id = $1
    `;
    const params = [companyId];

    if (filter.status && filter.status.trim()) {
      params.push(filter.status.trim());
      query += ` AND o.status ILIKE $${params.length}`;
    }

    query += ` ORDER BY o.id DESC`;

    const { rows } = await db.query(query, params);
    return rows.map(mapCAOffer);
  },

  async getById(id, companyId) {
    await ensureTable();
    const { rows } = await db.query(
      `SELECT 
        o.*,
        COALESCE(c.name, o.candidate_name) AS candidate,
        COALESCE(c.role, o.role) AS role,
        c.email,
        c.phone,
        c.location,
        c.experience,
        c.skills,
        COALESCE(o.req_id, jr.req_id) AS req_id,
        jr.job_id
      FROM public.ca_offers o
      LEFT JOIN public.ca_candidates c ON o.candidate_id = c.id
      LEFT JOIN LATERAL (
        SELECT jr.req_id, jr.id AS job_id
        FROM public.ca_job_requisitions jr
        WHERE jr.created_by_company_id = o.created_by_company_id
          AND LOWER(TRIM(jr.position)) = LOWER(TRIM(COALESCE(c.role, o.role)))
        ORDER BY jr.id DESC
        LIMIT 1
      ) jr ON true
      WHERE o.id = $1 AND o.created_by_company_id = $2`,
      [id, companyId]
    );
    return rows[0] ? mapCAOffer(rows[0]) : null;
  },

  async ensureOfferForCandidate(companyId, candidate) {
    await ensureTable();
    if (!candidate || !candidate.id) return null;

    const existing = await db.query(
      `SELECT * FROM public.ca_offers WHERE candidate_id = $1 AND created_by_company_id = $2`,
      [candidate.id, companyId]
    );
    if (existing.rows.length > 0) {
      return mapCAOffer(existing.rows[0]);
    }

    const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const joiningDate = new Date();
    joiningDate.setDate(joiningDate.getDate() + 15);
    const joiningStr = joiningDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const { rows } = await db.query(
      `INSERT INTO public.ca_offers (
        created_by_company_id, candidate_id, candidate_name, role, status, ctc, joining_bonus, joining_date, sent_on
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        companyId,
        candidate.id,
        candidate.name,
        candidate.role || 'Software Engineer',
        'Pending Acceptance',
        '₹96,000/mo',
        '₹1,20,000',
        joiningStr,
        todayStr
      ]
    );
    return mapCAOffer(rows[0]);
  },

  async create(companyId, payload) {
    await ensureTable();
    const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const { rows } = await db.query(
      `INSERT INTO public.ca_offers (
        created_by_company_id, candidate_id, candidate_name, role, status, ctc, joining_bonus, joining_date, sent_on, deadline, req_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        companyId,
        payload.candidateId || null,
        payload.candidate || payload.candidateName || null,
        payload.role || null,
        payload.status || 'Pending Acceptance',
        payload.ctc || '₹96,000/mo',
        payload.joiningBonus || '₹1,20,000',
        payload.joiningDate || null,
        payload.sentOn || todayStr,
        payload.deadline || null,
        payload.reqId || payload.req_id || null
      ]
    );
    return mapCAOffer(rows[0]);
  },

  async updateStatus(id, companyId, status) {
    await ensureTable();
    const { rows } = await db.query(
      `UPDATE public.ca_offers SET status = $3, updated_at = NOW() WHERE id = $1 AND created_by_company_id = $2 RETURNING *`,
      [id, companyId, status]
    );
    return rows[0] ? mapCAOffer(rows[0]) : null;
  },

  async update(id, companyId, payload) {
    await ensureTable();
    const { rows } = await db.query(
      `UPDATE public.ca_offers 
       SET ctc = COALESCE($3, ctc),
           joining_bonus = COALESCE($4, joining_bonus),
           joining_date = COALESCE($5, joining_date),
           deadline = COALESCE($6, deadline),
           status = COALESCE($7, status),
           req_id = COALESCE($8, req_id),
           updated_at = NOW()
       WHERE id = $1 AND created_by_company_id = $2 RETURNING *`,
      [id, companyId, payload.ctc, payload.joiningBonus, payload.joiningDate, payload.deadline, payload.status, payload.reqId || payload.req_id || null]
    );
    return rows[0] ? mapCAOffer(rows[0]) : null;
  },

  async delete(id, companyId) {
    await ensureTable();
    const { rows } = await db.query(
      `DELETE FROM public.ca_offers WHERE id = $1 AND created_by_company_id = $2 RETURNING id`,
      [id, companyId]
    );
    return rows.length > 0;
  }
};
