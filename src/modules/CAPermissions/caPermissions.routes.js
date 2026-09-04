import { Router } from "express";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { caPermissionsController } from "./caPermissions.controller.js";
import { requireNavPermission } from "./caPermissions.middleware.js";

export const caPermissionsRouter = Router();

caPermissionsRouter.get("/me", authenticateToken, requireCompanyAdmin, caPermissionsController.mine);
caPermissionsRouter.get("/", authenticateToken, requireCompanyAdmin, requireNavPermission("permission", { read: true }), caPermissionsController.list);
caPermissionsRouter.put("/", authenticateToken, requireCompanyAdmin, requireNavPermission("permission"), caPermissionsController.save);
