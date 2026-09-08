export const caLeaveYearBalancesTableSql = `
CREATE TABLE IF NOT EXISTS public.ca_leave_year_balances (
  id SERIAL PRIMARY KEY,
  created_by_company_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  leave_type_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  annual_days NUMERIC(8,2) NOT NULL DEFAULT 0,
  carried_days NUMERIC(8,2) NOT NULL DEFAULT 0,
  entitled_days NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (created_by_company_id, employee_id, leave_type_id, year)
);
`;

export const caLeaveYearBalancesIndexSql = `
CREATE UNIQUE INDEX IF NOT EXISTS uq_ca_leave_year_balances_emp_type_year
  ON public.ca_leave_year_balances (created_by_company_id, employee_id, leave_type_id, year);

CREATE INDEX IF NOT EXISTS idx_ca_leave_year_balances_company_year
  ON public.ca_leave_year_balances (created_by_company_id, year);
`;

export const mapLeaveYearBalance = (row, liveAnnual = null) => {
  const carried = Number(row.carried_days) || 0;
  const annual = liveAnnual == null ? Number(row.annual_days) || 0 : Number(liveAnnual) || 0;
  return {
    id: String(row.id),
    employeeId: String(row.employee_id),
    leaveTypeId: String(row.leave_type_id),
    year: Number(row.year),
    annualDays: annual,
    carriedDays: carried,
    entitledDays: annual + carried,
  };
};
