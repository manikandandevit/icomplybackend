import { Router } from "express";
import { caOnboardingController } from "./caOnboarding.controller.js";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";

export const caOnboardingRouter = Router();

caOnboardingRouter.use(authenticateToken, requireCompanyAdmin);

caOnboardingRouter.get("/", caOnboardingController.list);
caOnboardingRouter.get("/:id", caOnboardingController.getById);
caOnboardingRouter.patch("/:id/status", caOnboardingController.updateStatus);
