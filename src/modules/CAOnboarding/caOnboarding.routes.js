import { Router } from "express";
import { caOnboardingController } from "./caOnboarding.controller.js";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";

export const caOnboardingRouter = Router();

caOnboardingRouter.use(authenticateToken, requireCompanyAdmin);

// Onboarding CRUD
caOnboardingRouter.get("/", caOnboardingController.list);
caOnboardingRouter.get("/:id", caOnboardingController.getById);
caOnboardingRouter.patch("/:id/status", caOnboardingController.updateStatus);

// Task notifications
caOnboardingRouter.post("/notify-task", caOnboardingController.notifyTask);
caOnboardingRouter.post("/notify-batch", caOnboardingController.notifyBatch);

// Templates
caOnboardingRouter.get("/templates", caOnboardingController.getTemplates);
caOnboardingRouter.post("/templates", caOnboardingController.saveTemplates);

// Progress
caOnboardingRouter.get("/progress", caOnboardingController.getProgress);
caOnboardingRouter.post("/progress", caOnboardingController.saveProgress);
