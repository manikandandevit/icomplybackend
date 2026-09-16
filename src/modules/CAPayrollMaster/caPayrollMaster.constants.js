export const caPayrollMasterTableSql = `
CREATE TABLE IF NOT EXISTS public.ca_payroll_components (
  id                    SERIAL PRIMARY KEY,
  name                  TEXT NOT NULL,
  type                  TEXT NOT NULL DEFAULT 'Earning',
  ctc_impact            TEXT NOT NULL DEFAULT 'Add',
  percentage            NUMERIC(6,2) NOT NULL DEFAULT 0,
  country_id            TEXT,
  country_name          TEXT,
  calculation_type      TEXT NOT NULL DEFAULT 'Percentage',
  fixed_amount          NUMERIC NOT NULL DEFAULT 0,
  condition_max_salary  NUMERIC NOT NULL DEFAULT 0,
  max_cap_amount        NUMERIC NOT NULL DEFAULT 0,
  establishment_id      INTEGER,
  establishment_name    TEXT,
  created_by_company_id INTEGER NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const caPayrollMasterIndexSql = `
CREATE INDEX IF NOT EXISTS idx_ca_payroll_components_company
  ON public.ca_payroll_components (created_by_company_id);
CREATE INDEX IF NOT EXISTS idx_ca_payroll_components_establishment
  ON public.ca_payroll_components (establishment_id);
`;

export const mapPayrollComponent = (row) => ({
  id: String(row.id),
  name: row.name ?? "",
  type: row.type ?? "Earning",
  ctcImpact: row.ctc_impact ?? "Add",
  percentage: Number(row.percentage ?? 0),
  countryId: row.country_id ?? null,
  countryName: row.country_name ?? null,
  calculationType: row.calculation_type ?? "Percentage",
  fixedAmount: Number(row.fixed_amount ?? 0),
  conditionMaxSalary: Number(row.condition_max_salary ?? 0),
  maxCapAmount: Number(row.max_cap_amount ?? 0),
  establishmentId: row.establishment_id ? String(row.establishment_id) : null,
  establishmentName: row.establishment_name ?? null,
  createdAt: row.created_at,
});
