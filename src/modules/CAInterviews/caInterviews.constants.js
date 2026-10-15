export const caInterviewsTableSql = `
  CREATE TABLE IF NOT EXISTS public.ca_interviews (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_company_id INTEGER NOT NULL,
    candidate_id INTEGER NOT NULL,
    role VARCHAR(255),
    interviewer VARCHAR(255),
    type VARCHAR(50),
    datetime VARCHAR(100),
    mode VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Scheduled'
  );
`;

export const mapCAInterview = (row) => ({
  id: row.id,
  candidateId: row.candidate_id,
  role: row.role,
  interviewer: row.interviewer,
  type: row.type,
  datetime: row.datetime,
  mode: row.mode,
  status: row.status,
  createdAt: row.created_at,
  companyId: row.created_by_company_id,
});
