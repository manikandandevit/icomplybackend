import { isAllCompanyAccess, matchesCompanyAccess } from "../../core/access/companyAccess.js";
import { caEmployeesService } from "../CAEmployees/caEmployees.service.js";
import { caDashboardRepository } from "./caDashboard.repository.js";

const inScope = (companyAccess, row) =>
  isAllCompanyAccess(companyAccess) || matchesCompanyAccess(companyAccess, row.company_name, row.establishment_name);

const initialsOf = (name) =>
  String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

/** "On file" marker: dashboards only check whether an ID exists, never its value. */
const onFile = (value) => (value ? "on-file" : "");

export const caDashboardService = {
  /**
   * Employee dashboard: the signed-in employee's own record (full) plus a slim
   * list of active colleagues (name, establishment, date of birth) for the
   * birthdays card. Replaces downloading every employee's full profile.
   */
  async employeeSummary(companyId, companyAccess, requester = {}) {
    const [employee, rows] = await Promise.all([
      requester.employeeId
        ? caEmployeesService.get(requester.employeeId, companyId, companyAccess, requester).catch(() => null)
        : Promise.resolve(null),
      caDashboardRepository.listActiveColleagues(companyId),
    ]);

    const colleagues = rows
      .filter((row) => inScope(companyAccess, row))
      .map((row) => ({
        id: String(row.id),
        name: row.name || "",
        email: row.email || "",
        status: "Active",
        initials: initialsOf(row.name),
        establishmentId: row.establishment_id != null ? String(row.establishment_id) : "",
        details: { dateOfBirth: row.date_of_birth || "" },
      }));

    let reportingManagerName = "";
    const managerId = employee?.details?.reportingToId;
    if (managerId) {
      reportingManagerName = colleagues.find((c) => c.id === String(managerId))?.name || "";
    }
    if (!reportingManagerName) {
      reportingManagerName = employee?.details?.reportingToName || "";
    }

    return { employee, reportingManagerName, colleagues };
  },

  /**
   * Company-admin dashboard: same employees and permissions as GET /ca-employees,
   * but only the fields the dashboard cards use. Statutory IDs and bank details
   * are reduced to "on file" flags.
   */
  async adminEmployees(companyId, companyAccess, requester = {}) {
    const employees = await caEmployeesService.list(companyId, companyAccess, requester);
    return employees.map((emp) => {
      const d = emp.details || {};
      return {
        id: emp.id,
        name: emp.name,
        status: emp.status,
        joinDate: emp.joinDate,
        createdAt: emp.createdAt || null,
        establishmentId: emp.establishmentId,
        establishmentName: emp.establishmentName,
        ctc: emp.ctc,
        statutoryApplicable: emp.statutoryApplicable,
        bankDetails: Array.isArray(emp.bankDetails) && emp.bankDetails.length > 0 ? [{ onFile: true }] : [],
        details: {
          countryId: d.countryId || "",
          confirmationDate: d.confirmationDate || "",
          dateOfJoining: d.dateOfJoining || "",
          employmentStatus: d.employmentStatus || "",
          lastWorkingDay: d.lastWorkingDay || "",
          resignationDate: d.resignationDate || "",
          panNumber: onFile(d.panNumber),
          uanNumber: onFile(d.uanNumber),
          nricNumber: onFile(d.nricNumber),
          icNumber: onFile(d.icNumber),
          finNumber: onFile(d.finNumber),
        },
      };
    });
  },
};
