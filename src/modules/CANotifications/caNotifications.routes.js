import { Router } from "express";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { caNotificationsController } from "./caNotifications.controller.js";

export const caNotificationsRouter = Router();

caNotificationsRouter.use(authenticateToken, requireCompanyAdmin);

caNotificationsRouter.get("/settings", caNotificationsController.getSettings);
caNotificationsRouter.put("/settings", caNotificationsController.updateSettings);
caNotificationsRouter.post("/settings/reset", caNotificationsController.resetSettings);
caNotificationsRouter.put("/settings/templates/:key", caNotificationsController.updateTemplate);
