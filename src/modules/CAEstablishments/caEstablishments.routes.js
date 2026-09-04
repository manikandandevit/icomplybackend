import { Router } from "express";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { requireNavPermission } from "../CAPermissions/caPermissions.middleware.js";
import { caEstablishmentsController } from "./caEstablishments.controller.js";

export const caEstablishmentsRouter = Router();

caEstablishmentsRouter.get("/", authenticateToken, requireCompanyAdmin, caEstablishmentsController.list);
caEstablishmentsRouter.get("/:id", authenticateToken, requireCompanyAdmin, caEstablishmentsController.get);
caEstablishmentsRouter.patch("/:id/status", authenticateToken, requireCompanyAdmin, requireNavPermission("establishments"), caEstablishmentsController.updateStatus);
caEstablishmentsRouter.put("/:id", authenticateToken, requireCompanyAdmin, requireNavPermission("establishments"), caEstablishmentsController.update);
caEstablishmentsRouter.post("/", authenticateToken, requireCompanyAdmin, requireNavPermission("establishments"), caEstablishmentsController.create);
