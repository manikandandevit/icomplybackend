export const caStatutoryConfigTableSql = `
  CREATE TABLE IF NOT EXISTS public.ca_statutory_configs (
    id SERIAL PRIMARY KEY,
    created_by_company_id INT NOT NULL,
    country_id INT,
    establishment_id INT,
    statutory_name TEXT NOT NULL,
    base_component_id TEXT,
    eps_percentage NUMERIC,
    epf_percentage NUMERIC,
    rules JSONB,
    pt_deduction_type TEXT,
    pt_specific_month TEXT,
    lwf_specific_month TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  ALTER TABLE public.ca_statutory_configs ADD COLUMN IF NOT EXISTS pt_deduction_type TEXT;
  ALTER TABLE public.ca_statutory_configs ADD COLUMN IF NOT EXISTS pt_specific_month TEXT;
  ALTER TABLE public.ca_statutory_configs ADD COLUMN IF NOT EXISTS lwf_specific_month TEXT;
`;

export const caStatutoryConfigIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_ca_statutory_configs_company ON public.ca_statutory_configs (created_by_company_id);
`;

export const mapStatutoryConfig = (row) => {
  return {
    id: String(row.id),
    countryId: row.country_id ? String(row.country_id) : null,
    establishmentId: row.establishment_id ? String(row.establishment_id) : null,
    statutoryName: row.statutory_name,
    baseComponentId: row.base_component_id,
    epsPercentage: row.eps_percentage ? Number(row.eps_percentage) : 0,
    epfPercentage: row.epf_percentage ? Number(row.epf_percentage) : 0,
    ptDeductionType: row.pt_deduction_type || null,
    ptSpecificMonth: row.pt_specific_month || null,
    lwfSpecificMonth: row.lwf_specific_month || null,
    rules: row.rules ? row.rules : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};
