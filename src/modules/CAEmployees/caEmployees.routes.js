import { Router } from "express";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { caEmployeesController } from "./caEmployees.controller.js";

export const caEmployeesRouter = Router();

caEmployeesRouter.get("/", authenticateToken, requireCompanyAdmin, caEmployeesController.list);
caEmployeesRouter.get("/:id", authenticateToken, requireCompanyAdmin, caEmployeesController.get);
caEmployeesRouter.post("/", authenticateToken, requireCompanyAdmin, caEmployeesController.create);
caEmployeesRouter.delete("/:id", authenticateToken, requireCompanyAdmin, caEmployeesController.delete);
