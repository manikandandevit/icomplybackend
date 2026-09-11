import { AppError } from "../../core/errors/AppError.js";
import bcrypt from "bcryptjs";
import { isAllCompanyAccess, matchesCompanyAccess } from "../../core/access/companyAccess.js";
import { caEstablishmentsRepository } from "../CAEstablishments/caEstablishments.repository.js";
import { companiesRepository } from "../Companies/companies.repository.js";
import { caEmployeesRepository } from "./caEmployees.repository.js";

export const DEFAULT_EMPLOYEE_PASSWORD = "Employee@123";

const inEmployeeScope = (companyAccess, employee) =>
  isAllCompanyAccess(companyAccess) ||
  matchesCompanyAccess(companyAccess, employee.companyName, employee.establishmentName);

/** Checks whether the company has available licensed user seats for the establishment's country. */
const checkCountryQuota = async (companyId, establishmentId, excludeEmployeeId = null) => {
  const company = await companiesRepository.findById(companyId);
  if (!company || company.plan !== "Standard") {
    return;
  }

  const countryUsersMap = company.countryUsers || {};
  if (!countryUsersMap || Object.keys(countryUsersMap).length === 0) {
    return;
  }

  const establishment = await caEstablishmentsRepository.findById(establishmentId);
  if (!establishment || !establishment.countryId) {
    return;
  }

  const countryKey = String(establishment.countryId);
  const countryName = establishment.countryName || "this country";
  const licensedQuota = Number(countryUsersMap[countryKey]);

  if (isNaN(licensedQuota) || licensedQuota <= 0) {
    throw new AppError(
      `No user licenses allocated for ${countryName}. Please contact SuperAdmin to purchase licenses for ${countryName}.`,
      403,
      "COUNTRY_QUOTA_EMPTY"
    );
  }

  const activeCount = await caEmployeesRepository.countActiveByCountry(
    companyId,
    establishment.countryId,
    excludeEmployeeId
  );

  if (activeCount >= licensedQuota) {
    throw new AppError(
      `Employee limit reached for ${countryName} (${activeCount}/${licensedQuota} active seats used). Please contact SuperAdmin to purchase additional licenses to add more employees.`,
      403,
      "COUNTRY_USER_QUOTA_EXCEEDED"
    );
  }
};

export const caEmployeesService = {
  /** Direct count from employee master — source of truth for headcount. */
  async counts(companyId) {
    const counts = await caEmployeesRepository.countsByCompany(companyId);
    const byCountry = await caEmployeesRepository.activeCountsByCountry(companyId);
    const company = await companiesRepository.findById(companyId);
    return {
      ...counts,
      byCountry,
      plan: company?.plan || "Free Trial",
      countryUsers: company?.countryUsers || {},
    };
  },

  async list(companyId, companyAccess) {
    const rows = await caEmployeesRepository.list(companyId);
    return rows.filter((row) => inEmployeeScope(companyAccess, row));
  },

  async get(id, companyId, companyAccess) {
    const employee = await caEmployeesRepository.findById(id, companyId);
    if (!employee) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }
    if (!inEmployeeScope(companyAccess, employee)) {
      throw new AppError("You can only access your assigned company data", 403, "FORBIDDEN");
    }
    return employee;
  },

  async create(companyId, payload, companyAccess) {
    if (!inEmployeeScope(companyAccess, payload)) {
      throw new AppError("You can only access your assigned company data", 403, "FORBIDDEN");
    }

    const duplicate = await caEmployeesRepository.findByCode(companyId, payload.employeeCode);
    if (duplicate) {
      throw new AppError("Employee code already exists", 409, "EMPLOYEE_CODE_DUPLICATE");
    }

    if (payload.status !== "Inactive") {
      await checkCountryQuota(companyId, payload.establishmentId);
    }

    try {
      const passwordHash = await bcrypt.hash(DEFAULT_EMPLOYEE_PASSWORD, 10);
      const employee = await caEmployeesRepository.create(companyId, {
        ...payload,
        passwordHash,
        mustResetPassword: true,
      });
      if (!employee) {
        throw new AppError("Unable to create employee", 500, "EMPLOYEE_CREATE_FAILED");
      }
      await caEstablishmentsRepository.syncEmployeeCount(employee.establishmentId);
      return employee;
    } catch (error) {
      if (error instanceof AppError) throw error;
      const message = error?.message || "Unable to create employee";
      throw new AppError(message, 500, "EMPLOYEE_CREATE_FAILED");
    }
  },

  async updateStatus(id, companyId, status, companyAccess) {
    const existing = await caEmployeesRepository.findById(id, companyId);
    if (!existing) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }
    if (!inEmployeeScope(companyAccess, existing)) {
      throw new AppError("You can only access your assigned company data", 403, "FORBIDDEN");
    }
    const next = status === "Inactive" ? "Inactive" : "Active";

    if (next === "Active" && existing.status !== "Active") {
      await checkCountryQuota(companyId, existing.establishmentId, id);
    }

    const updated = await caEmployeesRepository.updateStatus(id, companyId, next);
    if (!updated) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }
    await caEstablishmentsRepository.syncEmployeeCount(updated.establishmentId);
    return updated;
  },

  async update(id, companyId, payload, companyAccess) {
    const existing = await caEmployeesRepository.findById(id, companyId);
    if (!existing) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }
    if (!inEmployeeScope(companyAccess, existing) || !inEmployeeScope(companyAccess, payload)) {
      throw new AppError("You can only access your assigned company data", 403, "FORBIDDEN");
    }

    const duplicate = await caEmployeesRepository.findByCode(companyId, payload.employeeCode, id);
    if (duplicate) {
      throw new AppError("Employee code already exists", 409, "EMPLOYEE_CODE_DUPLICATE");
    }

    if (
      payload.status !== "Inactive" &&
      (existing.status === "Inactive" || String(existing.establishmentId) !== String(payload.establishmentId))
    ) {
      await checkCountryQuota(companyId, payload.establishmentId, id);
    }

    try {
      const employee = await caEmployeesRepository.update(id, companyId, payload);
      if (!employee) {
        throw new AppError("Unable to update employee", 500, "EMPLOYEE_UPDATE_FAILED");
      }

      const oldEst = String(existing.establishmentId || "");
      const newEst = String(employee.establishmentId || "");
      await caEstablishmentsRepository.syncEmployeeCount(oldEst);
      if (newEst && newEst !== oldEst) {
        await caEstablishmentsRepository.syncEmployeeCount(newEst);
      }
      return employee;
    } catch (error) {
      if (error instanceof AppError) throw error;
      const message = error?.message || "Unable to update employee";
      throw new AppError(message, 500, "EMPLOYEE_UPDATE_FAILED");
    }
  },

  async delete(id, companyId, companyAccess) {
    const existing = await caEmployeesRepository.findById(id, companyId);
    if (!existing) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }
    if (!inEmployeeScope(companyAccess, existing)) {
      throw new AppError("You can only access your assigned company data", 403, "FORBIDDEN");
    }
    const deleted = await caEmployeesRepository.delete(id, companyId);
    if (!deleted) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }
    await caEstablishmentsRepository.syncEmployeeCount(existing.establishmentId);
  },
};
