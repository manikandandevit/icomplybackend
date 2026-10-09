import { db } from "../../core/db/pool.js";
import { caInterviewsTableSql, mapCAInterview } from "./caInterviews.constants.js";

let ready = null;
const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caInterviewsTableSql);
    })();
  }
  return ready;
};

export const caInterviewsRepository = {
  async list(companyId) {
    await ensureTable();
    const { rows } = await db.query(
      `SELECT i.*, c.name as candidate_name FROM public.ca_interviews i LEFT JOIN public.ca_candidates c ON i.candidate_id = c.id WHERE i.created_by_company_id = $1 ORDER BY i.id DESC`,
      [companyId]
    );
    return rows.map(r => ({ ...mapCAInterview(r), candidate: r.candidate_name }));
  },

  async create(companyId, payload) {
    await ensureTable();
    const { rows } = await db.query(
      `INSERT INTO public.ca_interviews (
        created_by_company_id, candidate_id, role, interviewer, type, datetime, mode, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        companyId, payload.candidateId, payload.role, payload.interviewer, payload.type, payload.datetime, payload.mode, payload.status || 'Scheduled'
      ]
    );
    return mapCAInterview(rows[0]);
  }
};
