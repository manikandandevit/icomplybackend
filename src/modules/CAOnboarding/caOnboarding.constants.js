export const caOnboardingTemplateTableSql = `
CREATE TABLE IF NOT EXISTS public.ca_onboarding_templates (
  id SERIAL PRIMARY KEY,
  company_id VARCHAR(100) NOT NULL,
  template_key VARCHAR(100) NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_company_template_key UNIQUE (company_id, template_key)
);
`;

export const caOnboardingJoinerProgressTableSql = `
CREATE TABLE IF NOT EXISTS public.ca_onboarding_joiner_progress (
  id SERIAL PRIMARY KEY,
  company_id VARCHAR(100) NOT NULL,
  candidate_id VARCHAR(100) NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  candidate_data JSONB DEFAULT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_company_candidate_progress UNIQUE (company_id, candidate_id)
);
ALTER TABLE public.ca_onboarding_joiner_progress 
ADD COLUMN IF NOT EXISTS candidate_data JSONB DEFAULT NULL;
`;
