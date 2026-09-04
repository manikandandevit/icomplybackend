import { AppError } from "../../core/errors/AppError.js";
import bcrypt from "bcryptjs";
import { isAllCompanyAccess, matchesCompanyAccess } from "../../core/access/companyAccess.js";
import { caEstablishmentsRepository } from "../CAEstablishments/caEstablishments.repository.js";
import { caEmployeesRepository } from "./caEmployees.repository.js";

export const DEFAULT_EMPLOYEE_PASSWORD = "Employee@123";

const inEmployeeScope = (companyAccess, employee) =>
  isAllCompanyAccess(companyAccess) || matchesCompanyAccess(companyAccess, employee.companyName);

export const caEmployeesService = {
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
    const updated = await caEmployeesRepository.updateStatus(id, companyId, next);
    if (!updated) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }
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
