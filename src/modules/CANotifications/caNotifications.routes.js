import { Router } from "express";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { caNotificationsController } from "./caNotifications.controller.js";
import { caFcmController } from "./caFcm.controller.js";

export const caNotificationsRouter = Router();

caNotificationsRouter.use(authenticateToken, requireCompanyAdmin);

// FCM Push Notification Tokens & Alerts
caNotificationsRouter.post("/fcm-token", caFcmController.saveFcmToken);
caNotificationsRouter.delete("/fcm-token", caFcmController.deleteFcmToken);
caNotificationsRouter.get("/unread-alerts", caFcmController.getUnreadAlerts);
caNotificationsRouter.put("/unread-alerts/:id/read", caFcmController.markAlertRead);

caNotificationsRouter.get("/settings", caNotificationsController.getSettings);
caNotificationsRouter.put("/settings", caNotificationsController.updateSettings);
caNotificationsRouter.post("/settings/reset", caNotificationsController.resetSettings);
caNotificationsRouter.put("/settings/templates/:key", caNotificationsController.updateTemplate);
