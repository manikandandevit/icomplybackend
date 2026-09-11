import { Router } from "express";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { caOtRequestsController } from "./caOtRequests.controller.js";

export const caOtRequestsRouter = Router();

caOtRequestsRouter.get("/", authenticateToken, requireCompanyAdmin, caOtRequestsController.list);
caOtRequestsRouter.post("/", authenticateToken, requireCompanyAdmin, caOtRequestsController.create);
caOtRequestsRouter.get("/:id", authenticateToken, requireCompanyAdmin, caOtRequestsController.getById);
caOtRequestsRouter.put("/:id/approve", authenticateToken, requireCompanyAdmin, caOtRequestsController.approve);
caOtRequestsRouter.put("/:id/reject", authenticateToken, requireCompanyAdmin, caOtRequestsController.reject);
