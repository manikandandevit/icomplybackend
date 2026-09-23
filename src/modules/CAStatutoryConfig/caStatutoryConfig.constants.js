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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
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
    rules: row.rules ? row.rules : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};
