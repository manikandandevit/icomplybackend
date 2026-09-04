import { Router } from "express";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { requireNavPermission } from "../CAPermissions/caPermissions.middleware.js";
import { caEmployeesController } from "./caEmployees.controller.js";

export const caEmployeesRouter = Router();

caEmployeesRouter.get("/", authenticateToken, requireCompanyAdmin, caEmployeesController.list);
caEmployeesRouter.get("/:id", authenticateToken, requireCompanyAdmin, caEmployeesController.get);
caEmployeesRouter.post("/", authenticateToken, requireCompanyAdmin, requireNavPermission("employee-master"), caEmployeesController.create);
caEmployeesRouter.put("/:id", authenticateToken, requireCompanyAdmin, requireNavPermission("employee-master"), caEmployeesController.update);
caEmployeesRouter.patch("/:id/status", authenticateToken, requireCompanyAdmin, requireNavPermission("employee-master"), caEmployeesController.updateStatus);
caEmployeesRouter.delete("/:id", authenticateToken, requireCompanyAdmin, requireNavPermission("employee-master"), caEmployeesController.delete);
