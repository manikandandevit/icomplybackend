import { Router } from "express";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { requireNavPermission } from "../CAPermissions/caPermissions.middleware.js";
import { caUsersController } from "./caUsers.controller.js";

export const caUsersRouter = Router();

caUsersRouter.get("/", authenticateToken, requireCompanyAdmin, caUsersController.list);
caUsersRouter.get("/:id", authenticateToken, requireCompanyAdmin, caUsersController.get);
caUsersRouter.patch("/:id/status", authenticateToken, requireCompanyAdmin, requireNavPermission("users-roles"), caUsersController.updateStatus);
caUsersRouter.put("/:id", authenticateToken, requireCompanyAdmin, requireNavPermission("users-roles"), caUsersController.update);
caUsersRouter.post("/", authenticateToken, requireCompanyAdmin, requireNavPermission("users-roles"), caUsersController.create);
caUsersRouter.delete("/:id", authenticateToken, requireCompanyAdmin, requireNavPermission("users-roles"), caUsersController.delete);
