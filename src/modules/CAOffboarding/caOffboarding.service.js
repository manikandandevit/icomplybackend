import { caOffboardingRepository } from "./caOffboarding.repository.js";
import { caEmployeesRepository } from "../CAEmployees/caEmployees.repository.js";

export const caOffboardingService = {
  async listExits(companyId) {
    return caOffboardingRepository.list(companyId);
  },

  async initiate(companyId, payload) {
    const { employeeId, reason, lastWorkingDay, sections } = payload;

    const employee = await caEmployeesRepository.findById(employeeId, companyId);
    if (!employee) {
      const err = new Error("Employee not found");
      err.statusCode = 404;
      throw err;
    }

    // 1. Create Exit record in ca_offboarding_exits
    const exit = await caOffboardingRepository.create(companyId, {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      employeeName: employee.name,
      role: employee.designationName || "Employee",
      department: employee.departmentName || "",
      countryCode: employee.details?.countryId === "2" ? "SG" : "IN",
      countryName: employee.details?.countryId === "2" ? "Singapore" : "India",
      resignationDate: new Date().toISOString().split("T")[0],
      lastWorkingDay: lastWorkingDay || new Date().toISOString().split("T")[0],
      reason: reason || "",
      sections: sections || [],
      isUrgent: false,
    });

    // 2. Set employee status to Inactive in ca_employees
    await caEmployeesRepository.updateStatus(employee.id, companyId, "Inactive");

    return exit;
  },

  async updateSections(id, companyId, sections) {
    return caOffboardingRepository.updateSections(id, companyId, sections);
  },

  async completeExit(id, companyId) {
    const completed = await caOffboardingRepository.completeExit(id, companyId);
    if (!completed) {
      const err = new Error("Exit record not found or already completed");
      err.statusCode = 404;
      throw err;
    }

    // Update employee status in ca_employees to Inactive
    if (completed.employee_id) {
      await caEmployeesRepository.updateStatus(completed.employee_id, companyId, "Inactive");
    }

    return completed;
  },

  async getTemplates(companyId) {
    return caOffboardingRepository.getTemplates(companyId);
  },

  async saveTemplates(companyId, payload) {
    return caOffboardingRepository.saveTemplates(companyId, payload);
  },
};
