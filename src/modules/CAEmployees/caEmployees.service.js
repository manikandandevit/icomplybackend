import { AppError } from "../../core/errors/AppError.js";
import { caEmployeesRepository } from "./caEmployees.repository.js";

export const caEmployeesService = {
  list: (companyId) => caEmployeesRepository.list(companyId),

  async get(id, companyId) {
    const employee = await caEmployeesRepository.findById(id, companyId);
    if (!employee) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }
    return employee;
  },

  async create(companyId, payload) {
    const duplicate = await caEmployeesRepository.findByCode(companyId, payload.employeeCode);
    if (duplicate) {
      throw new AppError("Employee code already exists", 409, "EMPLOYEE_CODE_DUPLICATE");
    }

    const employee = await caEmployeesRepository.create(companyId, payload);
    if (!employee) {
      throw new AppError("Unable to create employee", 500, "EMPLOYEE_CREATE_FAILED");
    }
    return employee;
  },

  async delete(id, companyId) {
    const existing = await caEmployeesRepository.findById(id, companyId);
    if (!existing) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }
    const deleted = await caEmployeesRepository.delete(id, companyId);
    if (!deleted) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }
  },
};
