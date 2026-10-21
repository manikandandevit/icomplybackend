import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { success } from "../../core/utils/response.js";
import { caRecruitmentDashboardRepository } from "./caRecruitmentDashboard.repository.js";

export const caRecruitmentDashboardController = {
  getStats: asyncHandler(async (req, res) => {
    const dashboardData = await caRecruitmentDashboardRepository.getDashboardStats(req.companyId);
    return success(res, { message: "Dashboard data loaded", data: dashboardData });
  }),
};

