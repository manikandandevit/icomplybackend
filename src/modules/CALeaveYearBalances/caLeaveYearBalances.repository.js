import { db } from "../../core/db/pool.js";
import {
  caLeaveYearBalancesIndexSql,
  caLeaveYearBalancesTableSql,
  mapLeaveYearBalance,
} from "./caLeaveYearBalances.constants.js";

let ready = null;

const parseRowId = (id) => {
  const n = Number.parseInt(String(id ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caLeaveYearBalancesTableSql);
      for (const statement of caLeaveYearBalancesIndexSql
        .split(";")
        .map((sql) => sql.trim())
        .filter(Boolean)) {
        await db.query(statement);
      }
    })();
  }
  return ready;
};

export const caLeaveYearBalancesRepository = {
  async listCompanyIds() {
    await ensureTable();
    try {
      const { rows } = await db.query(
        `
        SELECT DISTINCT created_by_company_id AS id
        FROM public.ca_hr_masters
        WHERE master_type = 'leave-types'
        `,
      );
      return rows.map((row) => String(row.id)).filter(Boolean);
    } catch {
      return [];
    }
  },

  async find(companyId, employeeId, leaveTypeId, year) {
    await ensureTable();
    const cid = parseRowId(companyId);
    const empId = parseRowId(employeeId);
    const typeId = parseRowId(leaveTypeId);
    const y = Number(year);
    if (!cid || !empId || !typeId || !Number.isInteger(y) || y <= 0) return null;
    const { rows } = await db.query(
      `
      SELECT id, created_by_company_id, employee_id, leave_type_id, year,
             annual_days, carried_days, entitled_days
      FROM public.ca_leave_year_balances
      WHERE created_by_company_id = $1
        AND employee_id = $2
        AND leave_type_id = $3
        AND year = $4
      LIMIT 1
      `,
      [cid, empId, typeId, y],
    );
    return rows[0] ? mapLeaveYearBalance(rows[0]) : null;
  },

  async listByYear(companyId, year) {
    await ensureTable();
    const cid = parseRowId(companyId);
    const y = Number(year);
    if (!cid || !Number.isInteger(y) || y <= 0) return [];
    const { rows } = await db.query(
      `
      SELECT id, created_by_company_id, employee_id, leave_type_id, year,
             annual_days, carried_days, entitled_days
      FROM public.ca_leave_year_balances
      WHERE created_by_company_id = $1 AND year = $2
      `,
      [cid, y],
    );
    return rows.map((row) => mapLeaveYearBalance(row));
  },

  async insert(companyId, payload) {
    await ensureTable();
    const cid = parseRowId(companyId);
    const empId = parseRowId(payload.employeeId);
    const typeId = parseRowId(payload.leaveTypeId);
    const y = Number(payload.year);
    if (!cid || !empId || !typeId || !Number.isInteger(y) || y <= 0) return null;
    const annual = Number(payload.annualDays) || 0;
    const carried = Number(payload.carriedDays) || 0;
    const { rows } = await db.query(
      `
      INSERT INTO public.ca_leave_year_balances (
        created_by_company_id, employee_id, leave_type_id, year,
        annual_days, carried_days, entitled_days
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (created_by_company_id, employee_id, leave_type_id, year)
      DO NOTHING
      RETURNING id, created_by_company_id, employee_id, leave_type_id, year,
                annual_days, carried_days, entitled_days
      `,
      [cid, empId, typeId, y, annual, carried, annual + carried],
    );
    if (rows[0]) return mapLeaveYearBalance(rows[0]);
    return this.find(companyId, empId, typeId, y);
  },
};
