import { db } from "../../core/db/pool.js";
import { caCandidatesTableSql, mapCACandidate } from "./caCandidates.constants.js";

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
  async list(companyId) {
    await ensureTable();
    const { rows } = await db.query(
      `SELECT * FROM public.ca_candidates WHERE created_by_company_id = $1 ORDER BY id DESC`,
      [companyId]
    );
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
    return mapCACandidate(rows[0]);
  },

  async updateStage(id, companyId, stage, assessmentCount) {
    await ensureTable();
    
    if (assessmentCount !== undefined) {
      const { rows } = await db.query(
        `UPDATE public.ca_candidates SET stage = $3, assessment_count = $4, updated_at = NOW() WHERE id = $1 AND created_by_company_id = $2 RETURNING *`,
        [id, companyId, stage, assessmentCount]
      );
      return rows[0] ? mapCACandidate(rows[0]) : null;
    } else {
      const { rows } = await db.query(
        `UPDATE public.ca_candidates SET stage = $3, updated_at = NOW() WHERE id = $1 AND created_by_company_id = $2 RETURNING *`,
        [id, companyId, stage]
      );
      return rows[0] ? mapCACandidate(rows[0]) : null;
    }
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
    const { rows } = await db.query(
      `DELETE FROM public.ca_candidates WHERE id = $1 AND created_by_company_id = $2 RETURNING id`,
      [id, companyId]
    );
    return rows.length > 0;
  }
};
