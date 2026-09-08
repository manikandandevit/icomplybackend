import { carryForwardDays, carryPolicyOf, joinYearOf, prorateDays } from "../../core/leave/entitlement.js";
import { caEmployeesRepository } from "../CAEmployees/caEmployees.repository.js";
import { caHrMasterRepository } from "../CAHrMaster/caHrMaster.repository.js";
import { caLeaveRequestsRepository } from "../CALeaveRequests/caLeaveRequests.repository.js";
import { caLeaveYearBalancesRepository } from "./caLeaveYearBalances.repository.js";

const currentYear = () => new Date().getFullYear();

const liveAnnual = (leaveType, employee, year) =>
  prorateDays(leaveType?.values?.days, employee?.joinDate, year);

const withLiveAnnual = (row, leaveType, employee, year) => {
  if (!row) return null;
  const annual = liveAnnual(leaveType, employee, year);
  return { ...row, annualDays: annual, entitledDays: annual + (Number(row.carriedDays) || 0) };
};

export const caLeaveYearBalancesService = {
  async ensureEmployeeYear(companyId, employee, leaveType, year, depth = 0) {
    const y = Number(year) || currentYear();
    if (!employee?.id || !leaveType?.id || depth > 20) return null;

    const existing = await caLeaveYearBalancesRepository.find(companyId, employee.id, leaveType.id, y);
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
      const prev = await caLeaveYearBalancesRepository.find(companyId, employee.id, leaveType.id, y - 1);
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
        const createdPrev = await this.ensureEmployeeYear(companyId, employee, leaveType, y - 1, depth + 1);
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
    return inserted
      ? { ...inserted, annualDays: annual, entitledDays: annual + inserted.carriedDays }
      : { employeeId: String(employee.id), leaveTypeId: String(leaveType.id), year: y, annualDays: annual, carriedDays: carried, entitledDays: annual + carried };
  },

  async ensureCompanyYear(companyId, year = currentYear()) {
    const y = Number(year) || currentYear();
    const [employees, leaveTypes] = await Promise.all([
      caEmployeesRepository.list(companyId),
      caHrMasterRepository.list(companyId, "leave-types"),
    ]);
    const active = employees.filter((item) => String(item.status || "").toLowerCase() !== "inactive");
    const balances = [];
    for (const employee of active) {
      for (const leaveType of leaveTypes) {
        const row = await this.ensureEmployeeYear(companyId, employee, leaveType, y);
        if (row) balances.push(row);
      }
    }
    return balances;
  },

  async entitledFor(companyId, employee, leaveType, year) {
    const row = await this.ensureEmployeeYear(companyId, employee, leaveType, year);
    return row ? Number(row.entitledDays) || 0 : liveAnnual(leaveType, employee, year);
  },

  async listYear(companyId, year = currentYear(), actor = {}) {
    const y = Number(year) || currentYear();
    const selfOnly = Boolean(actor?.employeeId && !actor?.isOwner && !actor?.isCaUser);

    if (selfOnly) {
      const [employee, leaveTypes] = await Promise.all([
        caEmployeesRepository.findById(actor.employeeId, companyId),
        caHrMasterRepository.list(companyId, "leave-types"),
      ]);
      if (!employee) return [];
      const balances = [];
      for (const leaveType of leaveTypes) {
        const row = await this.ensureEmployeeYear(companyId, employee, leaveType, y);
        if (row) balances.push(row);
      }
      return balances;
    }

    await this.ensureCompanyYear(companyId, y);
    const [employees, leaveTypes, rows] = await Promise.all([
      caEmployeesRepository.list(companyId),
      caHrMasterRepository.list(companyId, "leave-types"),
      caLeaveYearBalancesRepository.listByYear(companyId, y),
    ]);
    const employeeById = new Map(employees.map((item) => [String(item.id), item]));
    const typeById = new Map(leaveTypes.map((item) => [String(item.id), item]));
    return rows.map((row) => {
      const employee = employeeById.get(String(row.employeeId));
      const leaveType = typeById.get(String(row.leaveTypeId));
      return withLiveAnnual(row, leaveType, employee, y) || row;
    });
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
