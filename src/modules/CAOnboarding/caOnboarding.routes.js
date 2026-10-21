import express from "express";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { caOnboardingController } from "./caOnboarding.controller.js";

export const caOnboardingRouter = express.Router();

// POST /api/ca-onboarding/notify-task
caOnboardingRouter.post(
  "/notify-task",
  authenticateToken,
  requireCompanyAdmin,
  caOnboardingController.notifyTask
);

// POST /api/ca-onboarding/notify-batch
caOnboardingRouter.post(
  "/notify-batch",
  authenticateToken,
  requireCompanyAdmin,
  caOnboardingController.notifyBatch
);

// GET /api/ca-onboarding/templates
caOnboardingRouter.get(
  "/templates",
  authenticateToken,
  requireCompanyAdmin,
  caOnboardingController.getTemplates
);

// POST /api/ca-onboarding/templates
caOnboardingRouter.post(
  "/templates",
  authenticateToken,
  requireCompanyAdmin,
  caOnboardingController.saveTemplates
);

// GET /api/ca-onboarding/progress
caOnboardingRouter.get(
  "/progress",
  authenticateToken,
  requireCompanyAdmin,
  caOnboardingController.getProgress
);

// POST /api/ca-onboarding/progress
caOnboardingRouter.post(
  "/progress",
  authenticateToken,
  requireCompanyAdmin,
  caOnboardingController.saveProgress
);
