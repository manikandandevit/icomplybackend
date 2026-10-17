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
      await db.query(`ALTER TABLE public.ca_offers ADD COLUMN IF NOT EXISTS document_name VARCHAR(255);`);
      await db.query(`ALTER TABLE public.ca_offers ADD COLUMN IF NOT EXISTS document_url TEXT;`);
      await db.query(`ALTER TABLE public.ca_offers ADD COLUMN IF NOT EXISTS location VARCHAR(255);`);
      await db.query(`ALTER TABLE public.ca_offers ADD COLUMN IF NOT EXISTS hiring_manager VARCHAR(255);`);
      await db.query(`ALTER TABLE public.ca_offers ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'Draft';`);
      await db.query(`ALTER TABLE public.ca_offers ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;`);
      await db.query(`ALTER TABLE public.ca_candidates ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;`);
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

    // 1. Remove duplicate offers for the same candidate (keep highest id)
    await db.query(`
      DELETE FROM public.ca_offers a
      USING public.ca_offers b
      WHERE a.id < b.id
        AND a.created_by_company_id = $1
        AND b.created_by_company_id = $1
        AND (
          (a.candidate_id IS NOT NULL AND a.candidate_id = b.candidate_id)
          OR (a.candidate_name IS NOT NULL AND LOWER(TRIM(a.candidate_name)) = LOWER(TRIM(b.candidate_name)))
        )
    `, [companyId]);

    // 2. Clean up any existing offers where candidate is linked or matches name,
    // but the candidate's stage is NOT 'Offer' or 'Hired' (e.g. moved to 'Assessment')
    await db.query(`
      DELETE FROM public.ca_offers o
      USING public.ca_candidates c
      WHERE (o.candidate_id = c.id OR (o.candidate_id IS NULL AND LOWER(TRIM(o.candidate_name)) = LOWER(TRIM(c.name))))
        AND o.created_by_company_id = $1
        AND c.created_by_company_id = $1
        AND c.stage NOT IN ('Offer', 'Hired')
    `, [companyId]);

    // 3. Auto-sync any candidates with stage = 'Offer' into ca_offers if not present
    await db.query(`
      INSERT INTO public.ca_offers (
        created_by_company_id, candidate_id, candidate_name, role, status, ctc, joining_bonus, joining_date, sent_on, location, hiring_manager
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
        TO_CHAR(NOW(), 'DD Mon YYYY'),
        COALESCE(c.location, 'Chennai, India'),
        'Rajesh Kumar'
      FROM public.ca_candidates c
      WHERE c.created_by_company_id = $1 AND c.stage = 'Offer'
        AND NOT EXISTS (
          SELECT 1 FROM public.ca_offers o 
          WHERE (o.candidate_id = c.id OR (o.candidate_name IS NOT NULL AND LOWER(TRIM(o.candidate_name)) = LOWER(TRIM(c.name))))
            AND o.created_by_company_id = $1
        )
    `, [companyId]);

    let query = `
      SELECT 
        o.*,
        COALESCE(c.name, o.candidate_name) AS candidate,
        COALESCE(c.role, o.role) AS role,
        c.email,
        c.phone,
        COALESCE(o.location, c.location, jr.location) AS location,
        COALESCE(o.hiring_manager, jr.hiring_manager) AS hiring_manager,
        c.experience,
        c.skills,
        COALESCE(NULLIF(o.documents, '[]'::jsonb), c.documents, '[]'::jsonb) AS documents,
        COALESCE(o.req_id, jr.req_id) AS req_id,
        jr.job_id
      FROM public.ca_offers o
      LEFT JOIN public.ca_candidates c ON o.candidate_id = c.id
      LEFT JOIN LATERAL (
        SELECT jr.req_id, jr.id AS job_id, jr.location, jr.hiring_manager
        FROM public.ca_job_requisitions jr
        WHERE jr.created_by_company_id = o.created_by_company_id
          AND LOWER(TRIM(jr.position)) = LOWER(TRIM(COALESCE(c.role, o.role)))
        ORDER BY jr.id DESC
        LIMIT 1
      ) jr ON true
      WHERE o.created_by_company_id = $1
        AND (c.id IS NULL OR c.stage IN ('Offer', 'Hired'))
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

  async ensureOfferForCandidate(companyId, candidate) {
    await ensureTable();
    if (!candidate || !candidate.id) return null;

    const existing = await db.query(
      `SELECT * FROM public.ca_offers 
       WHERE (candidate_id = $1 OR (candidate_name IS NOT NULL AND LOWER(TRIM(candidate_name)) = LOWER(TRIM($2)))) 
         AND created_by_company_id = $3
       ORDER BY id DESC LIMIT 1`,
      [candidate.id, candidate.name, companyId]
    );
    if (existing.rows.length > 0) {
      if (!existing.rows[0].candidate_id) {
        await db.query(`UPDATE public.ca_offers SET candidate_id = $1 WHERE id = $2`, [candidate.id, existing.rows[0].id]);
      }
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
    let candidateId = payload.candidateId || null;
    const candidateName = payload.candidate || payload.candidateName || null;
    if (!candidateId && candidateName) {
      const found = await db.query(
        `SELECT id FROM public.ca_candidates WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND created_by_company_id = $2 LIMIT 1`,
        [candidateName, companyId]
      );
      if (found.rows[0]) {
        candidateId = found.rows[0].id;
      }
    }

    const docName = payload.documentName || `Offer_Letter_${(candidateName || "Candidate").replace(/\s+/g, "_")}.pdf`;

    // Check if an offer already exists for this candidate in this company
    const existing = await db.query(
      `SELECT id FROM public.ca_offers 
       WHERE created_by_company_id = $1 
         AND (
           (candidate_id IS NOT NULL AND candidate_id = $2)
           OR (candidate_name IS NOT NULL AND LOWER(TRIM(candidate_name)) = LOWER(TRIM($3)))
         )
       ORDER BY id DESC LIMIT 1`,
      [companyId, candidateId, candidateName]
    );

    const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    if (existing.rows[0]) {
      const existingId = existing.rows[0].id;
      const defaultUrl = payload.documentUrl || `/api/ca-offers/${existingId}/pdf`;
      const { rows } = await db.query(
        `UPDATE public.ca_offers 
         SET candidate_id = COALESCE($3, candidate_id),
             candidate_name = COALESCE($4, candidate_name),
             role = COALESCE($5, role),
             status = CASE 
               WHEN status = 'Accepted' THEN 'Accepted' 
               ELSE COALESCE($6, status) 
             END,
             ctc = COALESCE($7, ctc),
             joining_bonus = COALESCE($8, joining_bonus),
             joining_date = COALESCE($9, joining_date),
             sent_on = COALESCE($10, sent_on),
             deadline = COALESCE($11, deadline),
             req_id = COALESCE($12, req_id),
             document_name = COALESCE($13, document_name),
             document_url = $14,
             location = COALESCE($15, location),
             hiring_manager = COALESCE($16, hiring_manager),
             updated_at = NOW()
         WHERE id = $1 AND created_by_company_id = $2
         RETURNING *`,
        [
          existingId,
          companyId,
          candidateId,
          candidateName,
          payload.role || null,
          payload.status || 'Pending Acceptance',
          payload.ctc || '₹96,000/mo',
          payload.joiningBonus || '₹1,20,000',
          payload.joiningDate || null,
          payload.sentOn || todayStr,
          payload.deadline || null,
          payload.reqId || payload.req_id || null,
          docName,
          defaultUrl,
          payload.location || null,
          payload.hiringManager || payload.hiring_manager || null
        ]
      );
      return mapCAOffer(rows[0]);
    }

    const { rows } = await db.query(
      `INSERT INTO public.ca_offers (
        created_by_company_id, candidate_id, candidate_name, role, status, ctc, joining_bonus, joining_date, sent_on, deadline, req_id, document_name, document_url, location, hiring_manager
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [
        companyId,
        candidateId,
        candidateName,
        payload.role || null,
        payload.status || 'Pending Acceptance',
        payload.ctc || '₹96,000/mo',
        payload.joiningBonus || '₹1,20,000',
        payload.joiningDate || null,
        payload.sentOn || todayStr,
        payload.deadline || null,
        payload.reqId || payload.req_id || null,
        docName,
        payload.documentUrl || null,
        payload.location || null,
        payload.hiringManager || payload.hiring_manager || null
      ]
    );

    const createdOffer = rows[0];
    if (!createdOffer.document_url && createdOffer.id) {
      const defaultUrl = `/api/ca-offers/${createdOffer.id}/pdf`;
      await db.query(`UPDATE public.ca_offers SET document_url = $1 WHERE id = $2`, [defaultUrl, createdOffer.id]);
      createdOffer.document_url = defaultUrl;
    }
    return mapCAOffer(createdOffer);
  },

  async findById(id, companyId) {
    await ensureTable();
    const query = `
      SELECT 
        o.*,
        COALESCE(c.name, o.candidate_name) AS candidate,
        COALESCE(c.role, o.role) AS role,
        c.email,
        c.phone,
        COALESCE(o.location, c.location, jr.location) AS location,
        COALESCE(o.hiring_manager, jr.hiring_manager) AS hiring_manager,
        c.experience,
        c.skills,
        COALESCE(NULLIF(o.documents, '[]'::jsonb), c.documents, '[]'::jsonb) AS documents,
        COALESCE(o.req_id, jr.req_id) AS req_id,
        jr.job_id
      FROM public.ca_offers o
      LEFT JOIN public.ca_candidates c ON o.candidate_id = c.id
      LEFT JOIN LATERAL (
        SELECT jr.req_id, jr.id AS job_id, jr.location, jr.hiring_manager
        FROM public.ca_job_requisitions jr
        WHERE jr.created_by_company_id = o.created_by_company_id
          AND LOWER(TRIM(jr.position)) = LOWER(TRIM(COALESCE(c.role, o.role)))
        ORDER BY jr.id DESC
        LIMIT 1
      ) jr ON true
      WHERE o.id = $1 AND o.created_by_company_id = $2
      LIMIT 1
    `;
    const { rows } = await db.query(query, [id, companyId]);
    return rows[0] ? mapCAOffer(rows[0]) : null;
  },

  async findCompanyById(companyId) {
    const { rows } = await db.query(
      `SELECT id, legal_name, trade_name, email, street, city, state, pin, contact_name, mobile, logo_url 
       FROM public.companies WHERE id = $1 LIMIT 1`,
      [companyId]
    );
    return rows[0] || null;
  },

  async updateStatus(id, companyId, status) {
    await ensureTable();
    let numId = Number(id);
    let isCandidateId = false;

    if (typeof id === 'string' && id.startsWith('cand_offer_')) {
      numId = Number(id.replace('cand_offer_', ''));
      isCandidateId = true;
    }

    if (!isCandidateId && !isNaN(numId) && numId > 0) {
      // 1. Match ONLY by exact offer ID
      const { rows } = await db.query(
        `UPDATE public.ca_offers SET status = $3, updated_at = NOW() 
         WHERE id = $1 AND created_by_company_id = $2 
         RETURNING *`,
        [numId, companyId, status]
      );
      if (rows[0]) return mapCAOffer(rows[0]);
    }

    // 2. If it's a candidate ID or not found by offer ID
    if (!isNaN(numId) && numId > 0) {
      const candOffer = await db.query(
        `UPDATE public.ca_offers SET status = $3, updated_at = NOW() 
         WHERE candidate_id = $1 AND created_by_company_id = $2 
         RETURNING *`,
        [numId, companyId, status]
      );
      if (candOffer.rows[0]) return mapCAOffer(candOffer.rows[0]);

      // Check if candidate exists in ca_candidates
      const candRes = await db.query(
        `SELECT * FROM public.ca_candidates WHERE id = $1 AND created_by_company_id = $2 LIMIT 1`,
        [numId, companyId]
      );
      if (candRes.rows[0]) {
        const c = candRes.rows[0];
        const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const insRes = await db.query(
          `INSERT INTO public.ca_offers (created_by_company_id, candidate_id, candidate_name, role, status, ctc, joining_bonus, joining_date, sent_on, location, hiring_manager)
           VALUES ($1, $2, $3, $4, $5, '₹96,000/mo', '₹1,20,000', TO_CHAR(NOW() + INTERVAL '15 days', 'DD Mon YYYY'), $6, COALESCE($7, 'Chennai, India'), 'Rajesh Kumar') RETURNING *`,
          [companyId, c.id, c.name, c.role || 'Software Engineer', status, todayStr, c.location]
        );
        return mapCAOffer(insRes.rows[0]);
      }
    }
    return null;
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
           document_name = COALESCE($9, document_name),
           document_url = COALESCE($10, document_url),
           location = COALESCE($11, location),
           hiring_manager = COALESCE($12, hiring_manager),
           approval_status = COALESCE($13, approval_status),
           updated_at = NOW()
       WHERE id = $1 AND created_by_company_id = $2 RETURNING *`,
      [
        id, 
        companyId, 
        payload.ctc, 
        payload.joiningBonus, 
        payload.joiningDate, 
        payload.deadline, 
        payload.status, 
        payload.reqId || payload.req_id || null,
        payload.documentName,
        payload.documentUrl,
        payload.location || null,
        payload.hiringManager || payload.hiring_manager || null,
        payload.approvalStatus || payload.approval_status || null
      ]
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
  },

  async getDocuments(id, companyId) {
    await ensureTable();
    let numId = Number(id);
    let isCandidateId = false;
    if (typeof id === 'string' && id.startsWith('cand_offer_')) {
      numId = Number(id.replace('cand_offer_', ''));
      isCandidateId = true;
    }

    if (!isCandidateId && !isNaN(numId) && numId > 0) {
      const { rows } = await db.query(
        `SELECT documents, candidate_id FROM public.ca_offers WHERE id = $1 AND created_by_company_id = $2 LIMIT 1`,
        [numId, companyId]
      );
      if (rows[0]) {
        let docs = rows[0].documents;
        if (typeof docs === 'string') {
          try { docs = JSON.parse(docs); } catch { docs = []; }
        }
        if (Array.isArray(docs) && docs.length > 0) return docs;
        if (rows[0].candidate_id) {
          const candRes = await db.query(
            `SELECT documents FROM public.ca_candidates WHERE id = $1 AND created_by_company_id = $2 LIMIT 1`,
            [rows[0].candidate_id, companyId]
          );
          if (candRes.rows[0]?.documents) {
            let cDocs = candRes.rows[0].documents;
            if (typeof cDocs === 'string') {
              try { cDocs = JSON.parse(cDocs); } catch { cDocs = []; }
            }
            return Array.isArray(cDocs) ? cDocs : [];
          }
        }
        return Array.isArray(docs) ? docs : [];
      }
    }

    if (!isNaN(numId) && numId > 0) {
      const candRes = await db.query(
        `SELECT documents FROM public.ca_candidates WHERE id = $1 AND created_by_company_id = $2 LIMIT 1`,
        [numId, companyId]
      );
      if (candRes.rows[0]?.documents) {
        let cDocs = candRes.rows[0].documents;
        if (typeof cDocs === 'string') {
          try { cDocs = JSON.parse(cDocs); } catch { cDocs = []; }
        }
        return Array.isArray(cDocs) ? cDocs : [];
      }
    }
    return [];
  },

  async updateDocuments(id, companyId, documents) {
    await ensureTable();
    const docJson = JSON.stringify(Array.isArray(documents) ? documents : []);
    let numId = Number(id);
    let isCandidateId = false;

    if (typeof id === 'string' && id.startsWith('cand_offer_')) {
      numId = Number(id.replace('cand_offer_', ''));
      isCandidateId = true;
    }

    if (!isCandidateId && !isNaN(numId) && numId > 0) {
      const { rows } = await db.query(
        `UPDATE public.ca_offers 
         SET documents = $3::jsonb, updated_at = NOW() 
         WHERE id = $1 AND created_by_company_id = $2 
         RETURNING *`,
        [numId, companyId, docJson]
      );
      if (rows[0]) {
        if (rows[0].candidate_id) {
          await db.query(
            `UPDATE public.ca_candidates SET documents = $2::jsonb, updated_at = NOW() WHERE id = $1 AND created_by_company_id = $3`,
            [rows[0].candidate_id, docJson, companyId]
          );
        }
        return mapCAOffer(rows[0]);
      }
    }

    if (!isNaN(numId) && numId > 0) {
      const candRes = await db.query(
        `SELECT * FROM public.ca_candidates WHERE id = $1 AND created_by_company_id = $2 LIMIT 1`,
        [numId, companyId]
      );
      if (candRes.rows[0]) {
        const c = candRes.rows[0];
        await db.query(
          `UPDATE public.ca_candidates SET documents = $2::jsonb, updated_at = NOW() WHERE id = $1 AND created_by_company_id = $3`,
          [c.id, docJson, companyId]
        );

        const offRes = await db.query(
          `SELECT id FROM public.ca_offers WHERE candidate_id = $1 AND created_by_company_id = $2 LIMIT 1`,
          [c.id, companyId]
        );
        if (offRes.rows[0]) {
          const { rows } = await db.query(
            `UPDATE public.ca_offers SET documents = $3::jsonb, updated_at = NOW() WHERE id = $1 RETURNING *`,
            [offRes.rows[0].id, companyId, docJson]
          );
          return mapCAOffer(rows[0]);
        } else {
          const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          const insRes = await db.query(
            `INSERT INTO public.ca_offers (
              created_by_company_id, candidate_id, candidate_name, role, status, ctc, joining_bonus, joining_date, sent_on, documents
            ) VALUES ($1, $2, $3, $4, 'Document Collection', '₹96,000/mo', '₹1,20,000', TO_CHAR(NOW() + INTERVAL '15 days', 'DD Mon YYYY'), $5, $6::jsonb)
            RETURNING *`,
            [companyId, c.id, c.name, c.role || 'Software Engineer', todayStr, docJson]
          );
          return mapCAOffer(insRes.rows[0]);
        }
      }
    }
    return null;
  }
};
