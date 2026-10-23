import { db } from "../../core/db/pool.js";

export const caOffboardingTableSql = `
CREATE TABLE IF NOT EXISTS public.ca_offboarding_exits (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  employee_code TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  role TEXT,
  department TEXT,
  country_code TEXT DEFAULT 'IN',
  country_name TEXT DEFAULT 'India',
  resignation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  last_working_day DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'In Progress',
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_urgent BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_company_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const caOffboardingIndexSql = `
CREATE INDEX IF NOT EXISTS idx_ca_offboarding_company
  ON public.ca_offboarding_exits (created_by_company_id);

CREATE INDEX IF NOT EXISTS idx_ca_offboarding_employee
  ON public.ca_offboarding_exits (created_by_company_id, employee_id);
`;

export const caOffboardingTemplateTableSql = `
CREATE TABLE IF NOT EXISTS public.ca_offboarding_templates (
  id SERIAL PRIMARY KEY,
  company_id VARCHAR(100) NOT NULL,
  template_key VARCHAR(100) NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_offboarding_company_template_key UNIQUE (company_id, template_key)
);
`;
