export const caPayrollRunsTableSql = `
  CREATE TABLE IF NOT EXISTS public.ca_payroll_runs (
    id BIGSERIAL PRIMARY KEY,
    establishment_id BIGINT NOT NULL,
    establishment_name TEXT,
    run_month TEXT NOT NULL,
    run_year TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Processed',
    created_by_company_id BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
`;

export const caPayslipsTableSql = `
  CREATE TABLE IF NOT EXISTS public.ca_payslips (
    id BIGSERIAL PRIMARY KEY,
    run_id BIGINT NOT NULL,
    employee_id BIGINT NOT NULL,
    employee_name TEXT,
    gross_pay NUMERIC NOT NULL DEFAULT 0,
    net_pay NUMERIC NOT NULL DEFAULT 0,
    deductions NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Generated',
    created_by_company_id BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
`;

export const mapPayrollRun = (row) => ({
  id: String(row.id),
  establishmentId: row.establishment_id ? String(row.establishment_id) : null,
  establishmentName: row.establishment_name,
  month: row.run_month,
  year: row.run_year,
  status: row.status,
  createdAt: row.created_at,
});

export const mapPayslip = (row) => ({
  id: String(row.id),
  runId: String(row.run_id),
  employeeId: String(row.employee_id),
  employeeName: row.employee_name,
  grossPay: Number(row.gross_pay) || 0,
  netPay: Number(row.net_pay) || 0,
  deductions: Number(row.deductions) || 0,
  status: row.status,
  createdAt: row.created_at,
});
