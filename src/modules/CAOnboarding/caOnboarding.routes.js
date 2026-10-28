import { Router } from "express";
import { caOnboardingController } from "./caOnboarding.controller.js";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";

export const caOnboardingRouter = Router();

caOnboardingRouter.use(authenticateToken, requireCompanyAdmin);

// Templates (must be before /:id)
caOnboardingRouter.get("/templates", caOnboardingController.getTemplates);
caOnboardingRouter.post("/templates", caOnboardingController.saveTemplates);

// Progress (must be before /:id)
caOnboardingRouter.get("/progress", caOnboardingController.getProgress);
caOnboardingRouter.post("/progress", caOnboardingController.saveProgress);

// Task notifications
caOnboardingRouter.post("/notify-task", caOnboardingController.notifyTask);
caOnboardingRouter.post("/notify-batch", caOnboardingController.notifyBatch);

// Onboarding CRUD
caOnboardingRouter.get("/", caOnboardingController.list);
caOnboardingRouter.get("/:id", caOnboardingController.getById);
caOnboardingRouter.patch("/:id/status", caOnboardingController.updateStatus);
