import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { success } from "../../core/utils/response.js";
import { employeeActorFromReq } from "../CAEmployees/caEmployees.controller.js";
import { caDashboardService } from "./caDashboard.service.js";

export const caDashboardController = {
  employeeSummary: asyncHandler(async (req, res) => {
    const data = await caDashboardService.employeeSummary(req.companyId, req.companyAccess, employeeActorFromReq(req));
    return success(res, { message: "Dashboard summary loaded", data });
  }),

  adminEmployees: asyncHandler(async (req, res) => {
    const employees = await caDashboardService.adminEmployees(req.companyId, req.companyAccess, employeeActorFromReq(req));
    return success(res, { message: "Dashboard employees loaded", data: { employees } });
  }),
};
