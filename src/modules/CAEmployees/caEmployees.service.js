import { AppError } from "../../core/errors/AppError.js";
import bcrypt from "bcryptjs";
import { isAllCompanyAccess, matchesCompanyAccess } from "../../core/access/companyAccess.js";
import { caEstablishmentsRepository } from "../CAEstablishments/caEstablishments.repository.js";
import { companiesRepository } from "../Companies/companies.repository.js";
import { caPermissionsService } from "../CAPermissions/caPermissions.service.js";
import { caEmployeesRepository } from "./caEmployees.repository.js";
import { offloadEmployeeDocuments } from "../../core/storage/employeeDocuments.js";
import { formatDateToIST } from "../../core/utils/date.js";

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

/** Today's date in IST as { y, m, d }. */
const todayIST = () => {
  const [y, m, d] = formatDateToIST(new Date()).split("-").map(Number);
  return { y, m, d };
};

/** Reads month and day from a stored date of birth (YYYY-MM-DD or a Date-parsable value). */
const monthDayOf = (raw) => {
  const text = String(raw || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  const iso = match ? text.slice(0, 10) : formatDateToIST(text);
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!parts) return null;
  const m = Number(parts[2]);
  const d = Number(parts[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { m, d };
};

const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const pad2 = (n) => String(n).padStart(2, "0");

/** Next birthday on or after today. Feb 29 falls on Feb 28 in non-leap years. */
const nextBirthday = ({ m, d }, today) => {
  const build = (y) => ({ y, m, d: m === 2 && d === 29 && !isLeap(y) ? 28 : d });
  let next = build(today.y);
  if (next.m < today.m || (next.m === today.m && next.d < today.d)) next = build(today.y + 1);
  return next;
};

export const caEmployeesService = {
  /** Upcoming birthdays (today first), name and date only, for one establishment. */
  async upcomingBirthdays(companyId, establishmentId, limit = 10) {
    const rows = await caEmployeesRepository.listBirthdays(companyId, establishmentId);
    const today = todayIST();
    const todayKey = Date.UTC(today.y, today.m - 1, today.d);
    const max = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), 50);

    return rows
      .map((row) => {
        const md = monthDayOf(row.date_of_birth);
        if (!md) return null;
        const next = nextBirthday(md, today);
        const nextKey = Date.UTC(next.y, next.m - 1, next.d);
        return {
          id: String(row.id),
          name: row.name || "",
          designationName: row.designation_name || "",
          birthDay: `${pad2(md.m)}-${pad2(md.d)}`,
          nextDate: `${next.y}-${pad2(next.m)}-${pad2(next.d)}`,
          daysAway: Math.round((nextKey - todayKey) / 86400000),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.daysAway - b.daysAway || a.name.localeCompare(b.name))
      .slice(0, max);
  },

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

  async list(companyId, companyAccess, requester = {}) {
    const rows = await caEmployeesRepository.list(companyId);
    const filtered = rows.filter((row) => inEmployeeScope(companyAccess, row));

    const canViewCompensation =
      requester.isOwner ||
      requester.allowedModules?.includes("all") ||
      requester.allowedModules?.includes("payroll") ||
      (await caPermissionsService.can(companyId, requester, "payroll", "view")) ||
      (await caPermissionsService.can(companyId, requester, "employee-master", "edit"));

    if (canViewCompensation) {
      return filtered;
    }

    return filtered.map((emp) => {
      const isSelf = requester.employeeId && String(emp.id) === String(requester.employeeId);
      if (isSelf) return emp;
      return {
        ...emp,
        ctc: "",
        bankDetails: [],
        details: {
          ...emp.details,
          uanNumber: "",
        },
      };
    });
  },

  async get(id, companyId, companyAccess, requester = {}) {
    const employee = await caEmployeesRepository.findById(id, companyId);
    if (!employee) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }
    const requesterEmployeeId = requester?.employeeId || (typeof requester === "string" ? requester : null);
    const isSelf = requesterEmployeeId && String(requesterEmployeeId) === String(id);
    if (!isSelf && !inEmployeeScope(companyAccess, employee)) {
      throw new AppError("You can only access your assigned company data", 403, "FORBIDDEN");
    }

    const canViewCompensation =
      isSelf ||
      requester?.isOwner ||
      requester?.allowedModules?.includes("all") ||
      requester?.allowedModules?.includes("payroll") ||
      (await caPermissionsService.can(companyId, requester, "payroll", "view")) ||
      (await caPermissionsService.can(companyId, requester, "employee-master", "edit"));

    if (canViewCompensation) {
      return employee;
    }

    return {
      ...employee,
      ctc: "",
      bankDetails: [],
      details: {
        ...employee.details,
        uanNumber: "",
      },
    };
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
      // Move base64 documents to S3 so only URLs are stored in the database.
      const details = await offloadEmployeeDocuments(payload.details);
      const employee = await caEmployeesRepository.create(companyId, {
        ...payload,
        details,
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

  async updateStatus(id, companyId, status, companyAccess, options = {}) {
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

  async update(id, companyId, payload, companyAccess, requesterEmployeeId = null) {
    const existing = await caEmployeesRepository.findById(id, companyId);
    if (!existing) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }
    const isSelf = requesterEmployeeId && String(requesterEmployeeId) === String(id);
    if (!isSelf && (!inEmployeeScope(companyAccess, existing) || !inEmployeeScope(companyAccess, payload))) {
      throw new AppError("You can only access your assigned company data", 403, "FORBIDDEN");
    }

    if (isSelf) {
      // Employees are strictly NOT allowed to modify Admin-only fields (Resignation Details & Referral Details)
      const existingDetails = (existing.details && typeof existing.details === "object") ? existing.details : {};
      const payloadDetails = (payload.details && typeof payload.details === "object") ? payload.details : {};

      payload.details = {
        ...payloadDetails,
        resignationDate: existingDetails.resignationDate || null,
        resignationReason: existingDetails.resignationReason || null,
        lastWorkingDay: existingDetails.lastWorkingDay || null,
        referralName: existingDetails.referralName || null,
        referralEmail: existingDetails.referralEmail || null,
        referralPhone: existingDetails.referralPhone || null,
        referralCompany: existingDetails.referralCompany || null,
        referralDesignation: existingDetails.referralDesignation || null,
        referralDetails: existingDetails.referralDetails || null,
      };
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
      // Move base64 documents to S3 so only URLs are stored in the database.
      payload.details = await offloadEmployeeDocuments(payload.details);
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
