import { Router } from "express";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { caHrMasterController } from "./caHrMaster.controller.js";

export const caHrMasterRouter = Router();

caHrMasterRouter.get("/:type", authenticateToken, requireCompanyAdmin, caHrMasterController.list);
caHrMasterRouter.post("/:type", authenticateToken, requireCompanyAdmin, caHrMasterController.create);
caHrMasterRouter.put("/:type/:id", authenticateToken, requireCompanyAdmin, caHrMasterController.update);
caHrMasterRouter.delete("/:type/:id", authenticateToken, requireCompanyAdmin, caHrMasterController.delete);
