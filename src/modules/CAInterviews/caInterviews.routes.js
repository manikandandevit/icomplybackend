import { Router } from "express";
import { caInterviewsController } from "./caInterviews.controller.js";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";

const router = Router();

router.use(authenticateToken, requireCompanyAdmin);

router.get("/", caInterviewsController.list);
router.post("/", caInterviewsController.create);
router.put("/:id", caInterviewsController.update);
router.patch("/:id/status", caInterviewsController.updateStatus);
router.post("/:id/send-invite", caInterviewsController.sendInvite);
router.post("/:id/feedback", caInterviewsController.submitFeedback);
router.delete("/:id", caInterviewsController.delete);

export { router as caInterviewsRouter };
