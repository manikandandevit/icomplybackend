import { Router } from "express";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { caOnboardingController } from "./caOnboarding.controller.js";

export const caOnboardingRouter = Router();

caOnboardingRouter.use(authenticateToken, requireCompanyAdmin);

// Specific routes (defined before /:id parameterized routes)
caOnboardingRouter.post("/notify-task", caOnboardingController.notifyTask);
caOnboardingRouter.post("/notify-batch", caOnboardingController.notifyBatch);
caOnboardingRouter.get("/templates", caOnboardingController.getTemplates);
caOnboardingRouter.post("/templates", caOnboardingController.saveTemplates);
caOnboardingRouter.get("/progress", caOnboardingController.getProgress);
caOnboardingRouter.post("/progress", caOnboardingController.saveProgress);

// Resource routes
caOnboardingRouter.get("/", caOnboardingController.list);
caOnboardingRouter.get("/:id", caOnboardingController.getById);
caOnboardingRouter.patch("/:id/status", caOnboardingController.updateStatus);
