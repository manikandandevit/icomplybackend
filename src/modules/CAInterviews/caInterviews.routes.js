import { Router } from "express";
import { caInterviewsController } from "./caInterviews.controller.js";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";

const router = Router();

router.use(authenticateToken, requireCompanyAdmin);

router.get("/", caInterviewsController.list);
router.post("/", caInterviewsController.create);

export { router as caInterviewsRouter };
