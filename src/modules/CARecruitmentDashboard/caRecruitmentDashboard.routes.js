import { Router } from "express";
import { caRecruitmentDashboardController } from "./caRecruitmentDashboard.controller.js";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";

export const caRecruitmentDashboardRoutes = Router();

caRecruitmentDashboardRoutes.use(authenticateToken, requireCompanyAdmin);
caRecruitmentDashboardRoutes.get("/stats", caRecruitmentDashboardController.getStats);
