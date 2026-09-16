import { db } from "../../core/db/pool.js";
import { caPayrollRunsTableSql, caPayslipsTableSql, mapPayrollRun, mapPayslip } from "./caPayrollRuns.constants.js";

let ready = null;

const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caPayrollRunsTableSql);
      await db.query(caPayslipsTableSql);
    })();
  }
  return ready;
};

export const caPayrollRunsRepository = {
  async getRun(companyId, establishmentId, month, year) {
    await ensureTable();
    const { rows } = await db.query(
      `SELECT * FROM public.ca_payroll_runs
       WHERE created_by_company_id = $1 AND establishment_id = $2 AND run_month = $3 AND run_year = $4 LIMIT 1`,
      [companyId, establishmentId, month, year]
    );
    return rows[0] ? mapPayrollRun(rows[0]) : null;
  },

  async createRun(companyId, establishmentId, establishmentName, month, year) {
    await ensureTable();
    const { rows } = await db.query(
      `INSERT INTO public.ca_payroll_runs (establishment_id, establishment_name, run_month, run_year, created_by_company_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [establishmentId, establishmentName, month, year, companyId]
    );
    return mapPayrollRun(rows[0]);
  },

  async createPayslip(companyId, runId, employeeId, employeeName, grossPay, netPay, deductions) {
    await ensureTable();
    const { rows } = await db.query(
      `INSERT INTO public.ca_payslips (run_id, employee_id, employee_name, gross_pay, net_pay, deductions, created_by_company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [runId, employeeId, employeeName, grossPay, netPay, deductions, companyId]
    );
    return mapPayslip(rows[0]);
  },

  async getPayslipsByRun(companyId, runId) {
    await ensureTable();
    const { rows } = await db.query(
      `SELECT * FROM public.ca_payslips
       WHERE created_by_company_id = $1 AND run_id = $2 ORDER BY id DESC`,
      [companyId, runId]
    );
    return rows.map(mapPayslip);
  },

  async getPendingLeaves(companyId, establishmentId, month, year) {
    // This expects month as 'January', 'February' etc.
    const monthNum = new Date(Date.parse(month + " 1, " + year)).getMonth() + 1;
    const startStr = `${year}-${monthNum.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, monthNum, 0).getDate();
    const endStr = `${year}-${monthNum.toString().padStart(2, '0')}-${lastDay}`;

    const { rows } = await db.query(
      `SELECT COUNT(*) as pending_count FROM public.ca_leave_requests
       WHERE created_by_company_id = $1 AND establishment_id = $2
         AND status = 'Pending'
         AND (
           (start_date >= $3 AND start_date <= $4) OR
           (end_date >= $3 AND end_date <= $4) OR
           (start_date <= $3 AND end_date >= $4)
         )`,
      [companyId, establishmentId, startStr, endStr]
    );
    return Number(rows[0]?.pending_count) || 0;
  },

  async getPendingOT(companyId, establishmentId, month, year) {
    const monthNum = new Date(Date.parse(month + " 1, " + year)).getMonth() + 1;
    const startStr = `${year}-${monthNum.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, monthNum, 0).getDate();
    const endStr = `${year}-${monthNum.toString().padStart(2, '0')}-${lastDay}`;

    const { rows } = await db.query(
      `SELECT COUNT(*) as pending_count FROM public.ca_ot_requests
       WHERE created_by_company_id = $1 AND establishment_id = $2
         AND status = 'Pending'
         AND date >= $3 AND date <= $4`,
      [companyId, establishmentId, startStr, endStr]
    );
    return Number(rows[0]?.pending_count) || 0;
  },

  async getEmployeesForPayroll(companyId, establishmentId) {
    const { rows } = await db.query(
      `SELECT id, name as first_name, '' as last_name, employment_type_name as employee_type, join_date as joined_date, ctc as base_salary, status
       FROM public.ca_employees
       WHERE created_by_company_id = $1 AND establishment_id = $2 AND status = 'Active'`,
      [companyId, establishmentId]
    );
    return rows;
  }
};
