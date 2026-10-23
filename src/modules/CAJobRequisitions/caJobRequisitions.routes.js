import { Router } from "express";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { caJobRequisitionsController } from "./caJobRequisitions.controller.js";

export const caJobRequisitionsRouter = Router();

// Public routes for 1-click email approvals (no admin session required)
caJobRequisitionsRouter.get("/public-approve", caJobRequisitionsController.publicApprove);
caJobRequisitionsRouter.get("/public-reject", caJobRequisitionsController.publicReject);

// Protected routes (require authenticated Company Admin)
caJobRequisitionsRouter.use(authenticateToken, requireCompanyAdmin);

caJobRequisitionsRouter.get("/", caJobRequisitionsController.list);
caJobRequisitionsRouter.post("/", caJobRequisitionsController.create);
caJobRequisitionsRouter.put("/:id", caJobRequisitionsController.update);
caJobRequisitionsRouter.post("/:id/send-approval-request", caJobRequisitionsController.sendApprovalRequest);
caJobRequisitionsRouter.patch("/:id/approve", caJobRequisitionsController.approve);
caJobRequisitionsRouter.delete("/:id", caJobRequisitionsController.remove);
