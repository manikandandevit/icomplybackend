import { Router } from "express";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { caDashboardController } from "./caDashboard.controller.js";

export const caDashboardRouter = Router();

caDashboardRouter.get("/employee-summary", authenticateToken, requireCompanyAdmin, caDashboardController.employeeSummary);
caDashboardRouter.get("/admin-employees", authenticateToken, requireCompanyAdmin, caDashboardController.adminEmployees);
