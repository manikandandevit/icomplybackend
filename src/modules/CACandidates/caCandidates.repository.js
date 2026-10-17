import { db } from "../../core/db/pool.js";
import { caCandidatesTableSql, mapCACandidate } from "./caCandidates.constants.js";
import { caOffersRepository } from "../CAOffers/caOffers.repository.js";

let ready = null;
const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caCandidatesTableSql);
      await db.query(`ALTER TABLE public.ca_candidates ADD COLUMN IF NOT EXISTS assessment_count INTEGER DEFAULT 0;`);
      await db.query(`ALTER TABLE public.ca_candidates ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '[]'::jsonb;`);
      await db.query(`ALTER TABLE public.ca_candidates ADD COLUMN IF NOT EXISTS email VARCHAR(255);`);
      await db.query(`ALTER TABLE public.ca_candidates ADD COLUMN IF NOT EXISTS phone VARCHAR(50);`);
      await db.query(`ALTER TABLE public.ca_candidates ADD COLUMN IF NOT EXISTS experience VARCHAR(50);`);
      await db.query(`ALTER TABLE public.ca_candidates ADD COLUMN IF NOT EXISTS location VARCHAR(255);`);
      await db.query(`ALTER TABLE public.ca_candidates ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb;`);
    })();
  }
  return ready;
};

export const caCandidatesRepository = {
  async list(companyId, filter = {}) {
    await ensureTable();
    let query = `SELECT * FROM public.ca_candidates WHERE 1=1`;
    const params = [];
    if (companyId) {
      params.push(companyId);
      query += ` AND created_by_company_id = $${params.length}`;
    }
    if (filter.role && filter.role.trim()) {
      params.push(`%${filter.role.trim()}%`);
      query += ` AND role ILIKE $${params.length}`;
    }
    if (filter.stage && filter.stage.trim()) {
      params.push(filter.stage.trim());
      query += ` AND stage = $${params.length}`;
    }
    query += ` ORDER BY id DESC`;
    const { rows } = await db.query(query, params);
    const standardCandidates = rows.map(mapCACandidate);

    // Also include candidates from HirePilot applications table
    try {
      let hpQuery = `
        SELECT 
          (a.id + 100000) AS id,
          a.full_name AS name,
          COALESCE(
            NULLIF(CONCAT(SUBSTRING(SPLIT_PART(a.full_name, ' ', 1), 1, 1), SUBSTRING(SPLIT_PART(a.full_name, ' ', 2), 1, 1)), ''),
            SUBSTRING(a.full_name, 1, 2)
          ) AS initials,
          CONCAT(COALESCE(NULLIF(a.experience, ''), '0 yrs'), ' · ', COALESCE(NULLIF(a.location, ''), 'Remote')) AS details,
          o.role_name AS role,
          COALESCE(a.ats_score, 75) AS match,
          CASE 
            WHEN LOWER(a.status) = 'accepted' THEN 'Shortlisted'
            WHEN LOWER(a.status) = 'interview' OR LOWER(a.status) = 'moved' THEN 'Interview'
            WHEN LOWER(a.status) = 'rejected' THEN 'Rejected'
            ELSE 'Applied'
          END AS stage,
          'HirePilot' AS source,
          TO_CHAR(COALESCE(a.created_at, NOW()), 'DD Mon YYYY') AS applied,
          '[]'::jsonb AS notes,
          0 AS assessment_count,
          a.email,
          a.phone,
          a.experience,
          a.location,
          '[]'::jsonb AS skills,
          COALESCE(a.company_id, o.created_by_company_id, 1) AS created_by_company_id
        FROM public.hirepilot_applications a
        JOIN public.hirepilot_openings o ON o.id = a.opening_id
        WHERE 1=1
      `;
      const hpParams = [];
      if (companyId) {
        hpParams.push(companyId);
        hpQuery += ` AND (a.company_id = $${hpParams.length} OR o.created_by_company_id = $${hpParams.length} OR a.company_id IS NULL)`;
      }
      if (filter.role && filter.role.trim()) {
        hpParams.push(`%${filter.role.trim()}%`);
        hpQuery += ` AND o.role_name ILIKE $${hpParams.length}`;
      }
      if (filter.stage && filter.stage.trim()) {
        hpParams.push(filter.stage.trim());
        hpQuery += ` AND (
          CASE 
            WHEN LOWER(a.status) = 'accepted' THEN 'Shortlisted'
            WHEN LOWER(a.status) = 'interview' OR LOWER(a.status) = 'moved' THEN 'Interview'
            WHEN LOWER(a.status) = 'rejected' THEN 'Rejected'
            ELSE 'Applied'
          END = $${hpParams.length}
        )`;
      }
      hpQuery += ` ORDER BY a.id DESC`;

      const { rows: hpRows } = await db.query(hpQuery, hpParams);
      const hpCandidates = hpRows.map(mapCACandidate);

      // Avoid duplicate names if any
      const existingNames = new Set(standardCandidates.map(c => c.name?.trim().toLowerCase()));
      const uniqueHp = hpCandidates.filter(c => !existingNames.has(c.name?.trim().toLowerCase()));

      return [...standardCandidates, ...uniqueHp];
    } catch (hpErr) {
      console.warn("Could not merge hirepilot applications into candidates:", hpErr?.message);
      return standardCandidates;
    }
  },

  async create(companyId, payload) {
    await ensureTable();
    const { rows } = await db.query(
      `INSERT INTO public.ca_candidates (
        name, initials, details, role, match, stage, source, applied, assessment_count, email, phone, experience, location, skills, created_by_company_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [
        payload.name, payload.initials, payload.details, payload.role, payload.match, payload.stage, 
        payload.source, payload.applied, payload.assessmentCount || 0, 
        payload.email || null, payload.phone || null, payload.experience || null, payload.location || null,
        payload.skills ? JSON.stringify(payload.skills) : '[]', companyId
      ]
    );
    const candidate = mapCACandidate(rows[0]);
    if (candidate && candidate.stage === 'Offer') {
      try {
        await caOffersRepository.ensureOfferForCandidate(companyId, candidate);
      } catch (err) {
        console.error("Failed to auto-create offer on candidate create:", err);
      }
    }
    return candidate;
  },

  async updateStage(id, companyId, stage, assessmentCount) {
    await ensureTable();
    
    let candidate = null;
    if (assessmentCount !== undefined) {
      const { rows } = await db.query(
        `UPDATE public.ca_candidates SET stage = $3, assessment_count = $4, updated_at = NOW() WHERE id = $1 AND created_by_company_id = $2 RETURNING *`,
        [id, companyId, stage, assessmentCount]
      );
      candidate = rows[0] ? mapCACandidate(rows[0]) : null;
    } else {
      const { rows } = await db.query(
        `UPDATE public.ca_candidates SET stage = $3, updated_at = NOW() WHERE id = $1 AND created_by_company_id = $2 RETURNING *`,
        [id, companyId, stage]
      );
      candidate = rows[0] ? mapCACandidate(rows[0]) : null;
    }

    if (candidate) {
      if (stage === 'Interview') {
        try {
          const existingInt = await db.query(
            `SELECT id FROM public.ca_interviews WHERE candidate_id = $1 AND created_by_company_id = $2 LIMIT 1`,
            [id, companyId]
          );
          if (!existingInt.rows[0]) {
            const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            await db.query(
              `INSERT INTO public.ca_interviews (
                created_by_company_id, candidate_id, role, interviewer, type, datetime, mode, status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                companyId,
                id,
                candidate.role || 'Software Engineer',
                'Assigned Interviewer',
                'Round 1 - Technical',
                `${todayStr} · 10:00 AM`,
                'Video',
                'Scheduled'
              ]
            );
          }
        } catch (err) {
          console.error("Failed to auto-create interview entry on stage change to Interview:", err);
        }
      }

      if (stage === 'Offer') {
        try {
          await caOffersRepository.ensureOfferForCandidate(companyId, candidate);
        } catch (err) {
          console.error("Failed to auto-create offer on updateStage:", err);
        }
      } else if (stage === 'Hired') {
        try {
          await db.query(
            `UPDATE public.ca_offers SET status = 'Accepted', updated_at = NOW() 
             WHERE (candidate_id = $1 OR (candidate_name IS NOT NULL AND LOWER(TRIM(candidate_name)) = LOWER(TRIM($2)))) 
               AND created_by_company_id = $3`,
            [id, candidate.name, companyId]
          );
        } catch (err) {
          console.error("Failed to sync offer status to Accepted on updateStage:", err);
        }
      } else {
        // Candidate moved to a stage other than Offer or Hired (e.g., Assessment, Interview, Screening, etc.)
        // Remove any offers for this candidate from ca_offers so they don't appear in the Offers list!
        try {
          await db.query(
            `DELETE FROM public.ca_offers 
             WHERE (candidate_id = $1 OR (candidate_name IS NOT NULL AND LOWER(TRIM(candidate_name)) = LOWER(TRIM($2)))) 
               AND created_by_company_id = $3`,
            [id, candidate.name, companyId]
          );
        } catch (err) {
          console.error("Failed to remove offer on moving away from Offer stage:", err);
        }
      }
    }

    return candidate;
  },

  async addNote(id, companyId, noteText) {
    await ensureTable();
    const note = {
      text: noteText,
      createdAt: new Date().toISOString()
    };
    const { rows } = await db.query(
      `UPDATE public.ca_candidates SET notes = notes || $3::jsonb, updated_at = NOW() WHERE id = $1 AND created_by_company_id = $2 RETURNING *`,
      [id, companyId, JSON.stringify([note])]
    );
    return rows[0] ? mapCACandidate(rows[0]) : null;
  },

  async delete(id, companyId) {
    await ensureTable();
    await db.query(`DELETE FROM public.ca_offers WHERE candidate_id = $1 AND created_by_company_id = $2`, [id, companyId]);
    await db.query(`DELETE FROM public.ca_interviews WHERE candidate_id = $1 AND created_by_company_id = $2`, [id, companyId]);
    const { rows } = await db.query(
      `DELETE FROM public.ca_candidates WHERE id = $1 AND created_by_company_id = $2 RETURNING id`,
      [id, companyId]
    );
    return rows.length > 0;
  }
};
