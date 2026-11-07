export const caSeparationTableSql = `
CREATE TABLE IF NOT EXISTS public.ca_separation_requests (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  employee_code TEXT,
  employee_name TEXT NOT NULL,
  department TEXT,
  designation TEXT,
  establishment_id INTEGER,
  establishment_name TEXT,
  reporting_manager_id INTEGER,
  reporting_manager_name TEXT,
  current_reviewer_id INTEGER,
  current_reviewer_name TEXT,
  current_reviewer_dept TEXT,
  reason_category TEXT NOT NULL DEFAULT '',
  primary_reason TEXT NOT NULL DEFAULT '',
  proposed_last_working_day DATE,
  confirmed_last_working_day DATE,
  status TEXT NOT NULL DEFAULT 'Pending Review',
  review_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const caSeparationIndexSql = `
CREATE INDEX IF NOT EXISTS idx_ca_sep_company ON public.ca_separation_requests (company_id);
CREATE INDEX IF NOT EXISTS idx_ca_sep_employee ON public.ca_separation_requests (company_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_ca_sep_reviewer ON public.ca_separation_requests (company_id, current_reviewer_id);
`;

