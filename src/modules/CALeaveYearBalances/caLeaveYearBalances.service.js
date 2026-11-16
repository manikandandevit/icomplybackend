import { carryForwardDays, carryPolicyOf, joinYearOf, prorateDays } from "../../core/leave/entitlement.js";
import { caEmployeesRepository } from "../CAEmployees/caEmployees.repository.js";
import { caHrMasterRepository } from "../CAHrMaster/caHrMaster.repository.js";
import { caLeaveRequestsRepository } from "../CALeaveRequests/caLeaveRequests.repository.js";
import { caLeaveYearBalancesRepository } from "./caLeaveYearBalances.repository.js";

const currentYear = () => new Date().getFullYear();

const liveAnnual = (leaveType, employee, year) => {
  const policy = leaveType?.values?.prorate || leaveType?.prorate || "yes";
  return prorateDays(leaveType?.values?.days, employee?.joinDate, year, policy);
};

const withLiveAnnual = (row, leaveType, employee, year) => {
  if (!row) return null;
  const annual = liveAnnual(leaveType, employee, year);
  return { ...row, annualDays: annual, entitledDays: annual + (Number(row.carriedDays) || 0) };
};

/**
 * Per-request cache of balance rows, loaded one whole year at a time.
 * Replaces one `find` query per employee × leave type (N+1) with a single
 * `listByYear` query per company-year.
 */
const createBalanceCache = (companyId) => ({ companyId, years: new Map() });

const balanceKey = (employeeId, leaveTypeId) => `${String(employeeId)}:${String(leaveTypeId)}`;

const loadCachedYear = (cache, year) => {
  if (!cache.years.has(year)) {
    cache.years.set(
      year,
      caLeaveYearBalancesRepository
        .listByYear(cache.companyId, year)
        .then((rows) => new Map(rows.map((row) => [balanceKey(row.employeeId, row.leaveTypeId), row]))),
    );
  }
  return cache.years.get(year);
};

const findBalance = async (cache, companyId, employeeId, leaveTypeId, year) => {
  if (!cache) return caLeaveYearBalancesRepository.find(companyId, employeeId, leaveTypeId, year);
  const byKey = await loadCachedYear(cache, year);
  return byKey.get(balanceKey(employeeId, leaveTypeId)) || null;
};

const rememberBalance = async (cache, year, row) => {
  if (!cache || !row) return;
  const byKey = await loadCachedYear(cache, year);
  byKey.set(balanceKey(row.employeeId, row.leaveTypeId), row);
};

export const caLeaveYearBalancesService = {
  async ensureEmployeeYear(companyId, employee, leaveType, year, depth = 0, cache = null) {
    const y = Number(year) || currentYear();
    if (!employee?.id || !leaveType?.id || depth > 20) return null;

    const existing = await findBalance(cache, companyId, employee.id, leaveType.id, y);
    const annual = liveAnnual(leaveType, employee, y);
    if (existing) {
      return {
        ...existing,
        annualDays: annual,
        entitledDays: annual + existing.carriedDays,
      };
    }

    const joined = joinYearOf(employee.joinDate);
    const policy = carryPolicyOf(leaveType);
    let carried = 0;

    if (joined && y > joined) {
      const prev = await findBalance(cache, companyId, employee.id, leaveType.id, y - 1);
      if (prev) {
        const usedPrev = await caLeaveRequestsRepository.usedDays(
          companyId,
          employee.id,
          leaveType.id,
          y - 1,
          ["Approved"],
        );
        carried = carryForwardDays(Math.max(prev.entitledDays - usedPrev, 0), policy);
      } else if (y !== currentYear()) {
        const createdPrev = await this.ensureEmployeeYear(companyId, employee, leaveType, y - 1, depth + 1, cache);
        if (createdPrev) {
          const usedPrev = await caLeaveRequestsRepository.usedDays(
            companyId,
            employee.id,
            leaveType.id,
            y - 1,
            ["Approved"],
          );
          carried = carryForwardDays(Math.max(createdPrev.entitledDays - usedPrev, 0), policy);
        }
      }
    }

    const inserted = await caLeaveYearBalancesRepository.insert(companyId, {
      employeeId: employee.id,
      leaveTypeId: leaveType.id,
      year: y,
      annualDays: annual,
      carriedDays: carried,
    });
    await rememberBalance(cache, y, inserted);
    return inserted
      ? { ...inserted, annualDays: annual, entitledDays: annual + inserted.carriedDays }
      : { employeeId: String(employee.id), leaveTypeId: String(leaveType.id), year: y, annualDays: annual, carriedDays: carried, entitledDays: annual + carried };
  },

  async ensureCompanyYear(companyId, year = currentYear()) {
    const { balances } = await this.ensureCompanyYearDetailed(companyId, year);
    return balances;
  },

  /** Creates any missing balance rows for the year and returns the data it loaded,
   *  so callers don't have to query employees / leave types / balances again. */
  async ensureCompanyYearDetailed(companyId, year = currentYear(), cache = createBalanceCache(companyId)) {
    const y = Number(year) || currentYear();
    const [employees, leaveTypes] = await Promise.all([
      caEmployeesRepository.list(companyId),
      caHrMasterRepository.list(companyId, "leave-types"),
    ]);
    const active = employees.filter((item) => String(item.status || "").toLowerCase() !== "inactive");
    const balances = [];
    for (const employee of active) {
      for (const leaveType of leaveTypes) {
        const row = await this.ensureEmployeeYear(companyId, employee, leaveType, y, 0, cache);
        if (row) balances.push(row);
      }
    }
    const yearRows = [...(await loadCachedYear(cache, y)).values()];
    return { employees, leaveTypes, balances, yearRows };
  },

  async entitledFor(companyId, employee, leaveType, year) {
    const row = await this.ensureEmployeeYear(companyId, employee, leaveType, year);
    return row ? Number(row.entitledDays) || 0 : liveAnnual(leaveType, employee, year);
  },

  async listYear(companyId, year = currentYear(), actor = {}, companyAccess = "All Companies") {
    const y = Number(year) || currentYear();
    const selfOnly = Boolean(actor?.employeeId && !actor?.isOwner && !actor?.isCaUser);

    if (selfOnly) {
      const [employee, leaveTypes] = await Promise.all([
        caEmployeesRepository.findById(actor.employeeId, companyId),
        caHrMasterRepository.list(companyId, "leave-types"),
      ]);
      if (!employee) return [];
      const cache = createBalanceCache(companyId);
      const balances = [];
      for (const leaveType of leaveTypes) {
        const row = await this.ensureEmployeeYear(companyId, employee, leaveType, y, 0, cache);
        if (row) balances.push(row);
      }
      return balances;
    }

    const { employees, leaveTypes, yearRows: rows } = await this.ensureCompanyYearDetailed(companyId, y);
    const { isAllCompanyAccess, matchesCompanyAccess } = await import("../../core/access/companyAccess.js");

    const employeeById = new Map();
    const activeEmployees = [];
    
    for (const item of employees) {
      if (isAllCompanyAccess(companyAccess) || matchesCompanyAccess(companyAccess, item.companyName, item.establishmentName)) {
        employeeById.set(String(item.id), item);
        activeEmployees.push(item);
      }
    }

    const typeById = new Map(leaveTypes.map((item) => [String(item.id), item]));
    const result = [];
    
    for (const row of rows) {
      const employee = employeeById.get(String(row.employeeId));
      if (!employee) continue; // Filter out balances for employees not in scope
      
      const leaveType = typeById.get(String(row.leaveTypeId));
      result.push(withLiveAnnual(row, leaveType, employee, y) || row);
    }
    return result;
  },

  async rollForwardAll(year = currentYear()) {
    try {
      await caHrMasterRepository.list("0", "leave-types");
      const ids = await caLeaveYearBalancesRepository.listCompanyIds();
      for (const companyId of ids) {
        await this.ensureCompanyYear(companyId, year);
      }
      return ids.length;
    } catch (error) {
      console.error("Leave year balance roll-forward failed", error);
      return 0;
    }
  },
};
