import express from "express";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { caOffboardingController } from "./caOffboarding.controller.js";

export const caOffboardingRouter = express.Router();

// GET /api/ca-offboarding/exits
caOffboardingRouter.get(
  "/exits",
  authenticateToken,
  requireCompanyAdmin,
  caOffboardingController.listExits
);

// POST /api/ca-offboarding/initiate
caOffboardingRouter.post(
  "/initiate",
  authenticateToken,
  requireCompanyAdmin,
  caOffboardingController.initiate
);

// PUT /api/ca-offboarding/exits/:id/sections
caOffboardingRouter.put(
  "/exits/:id/sections",
  authenticateToken,
  requireCompanyAdmin,
  caOffboardingController.updateSections
);

// POST /api/ca-offboarding/exits/:id/complete
caOffboardingRouter.post(
  "/exits/:id/complete",
  authenticateToken,
  requireCompanyAdmin,
  caOffboardingController.completeExit
);

// POST /api/ca-offboarding/exits/:id/withdraw
caOffboardingRouter.post(
  "/exits/:id/withdraw",
  authenticateToken,
  requireCompanyAdmin,
  caOffboardingController.withdrawExit
);

// GET /api/ca-offboarding/templates
caOffboardingRouter.get(
  "/templates",
  authenticateToken,
  requireCompanyAdmin,
  caOffboardingController.getTemplates
);

// POST /api/ca-offboarding/templates
caOffboardingRouter.post(
  "/templates",
  authenticateToken,
  requireCompanyAdmin,
  caOffboardingController.saveTemplates
);

// POST /api/ca-offboarding/notify-task
caOffboardingRouter.post(
  "/notify-task",
  authenticateToken,
  requireCompanyAdmin,
  caOffboardingController.notifyTask
);

// POST /api/ca-offboarding/notify-batch
caOffboardingRouter.post(
  "/notify-batch",
  authenticateToken,
  requireCompanyAdmin,
  caOffboardingController.notifyBatch
);
