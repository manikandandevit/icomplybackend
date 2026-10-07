import { Router } from "express";
import { caPayrollRunsController } from "./caPayrollRuns.controller.js";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";

const router = Router();

router.use(authenticateToken, requireCompanyAdmin);

router.get("/prechecks", caPayrollRunsController.getPreChecks);
router.get("/preview", caPayrollRunsController.getPreview);
router.post("/run", caPayrollRunsController.runPayroll);
router.post("/save", caPayrollRunsController.saveRun);
router.post("/send-payslip", caPayrollRunsController.sendPayslip);
router.get("/history", caPayrollRunsController.getRunHistory);
router.get("/history-by-year", caPayrollRunsController.getRunsByYear);

import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

router.post("/upload-challan", upload.single("challan"), caPayrollRunsController.uploadChallan);

export { router as caPayrollRunsRouter };
