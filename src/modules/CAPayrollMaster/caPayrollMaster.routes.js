import { Router } from "express";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { caPayrollMasterController } from "./caPayrollMaster.controller.js";

export const caPayrollMasterRouter = Router();

caPayrollMasterRouter.get("/", authenticateToken, requireCompanyAdmin, caPayrollMasterController.list);
caPayrollMasterRouter.post("/", authenticateToken, requireCompanyAdmin, caPayrollMasterController.create);
caPayrollMasterRouter.put("/:id", authenticateToken, requireCompanyAdmin, caPayrollMasterController.update);
caPayrollMasterRouter.delete("/:id", authenticateToken, requireCompanyAdmin, caPayrollMasterController.delete);
