import { Router } from "express";
import { caPayrollRunsController } from "./caPayrollRuns.controller.js";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";

const router = Router();

router.use(authenticateToken, requireCompanyAdmin);

router.get("/prechecks", caPayrollRunsController.getPreChecks);
router.get("/preview", caPayrollRunsController.getPreview);
router.post("/run", caPayrollRunsController.runPayroll);
router.get("/history", caPayrollRunsController.getRunHistory);

export { router as caPayrollRunsRouter };
