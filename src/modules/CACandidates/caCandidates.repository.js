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
    let query = `SELECT * FROM public.ca_candidates WHERE created_by_company_id = $1`;
    const params = [companyId];
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
    return rows.map(mapCACandidate);
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
