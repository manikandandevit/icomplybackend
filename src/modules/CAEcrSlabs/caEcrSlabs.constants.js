export const caEcrSlabsTableSql = `
  CREATE TABLE IF NOT EXISTS public.ca_ecr_slabs (
    id SERIAL PRIMARY KEY,
    created_by_company_id INT NOT NULL,
    wage_type TEXT NOT NULL,
    min_amount NUMERIC,
    max_amount NUMERIC,
    calculation_type TEXT NOT NULL DEFAULT 'Actual',
    fixed_value NUMERIC,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

export const caEcrSlabsIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_ca_ecr_slabs_company ON public.ca_ecr_slabs (created_by_company_id);
`;

export const mapCaEcrSlab = (row) => ({
  id: String(row.id),
  wageType: row.wage_type,
  minAmount: row.min_amount ? Number(row.min_amount) : null,
  maxAmount: row.max_amount ? Number(row.max_amount) : null,
  calculationType: row.calculation_type,
  fixedValue: row.fixed_value ? Number(row.fixed_value) : null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
