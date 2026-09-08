import { Router } from "express";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { caPermissionsService } from "../CAPermissions/caPermissions.service.js";
import { caLeaveRequestsController } from "./caLeaveRequests.controller.js";

const requireLeaveApply = async (req, _res, next) => {
  try {
    await caPermissionsService.assertAccess(
      req.companyId,
      { isOwner: Boolean(req.isCompanyOwner), designationId: req.designationId, designationName: req.designationName },
      "leave-apply",
      "access",
    );
    return next();
  } catch (error) {
    return next(error);
  }
};

export const caLeaveRequestsRouter = Router();

const requireLeaveReview = async (req, _res, next) => {
  try {
    await caPermissionsService.assertAccess(
      req.companyId,
      { isOwner: Boolean(req.isCompanyOwner), designationId: req.designationId, designationName: req.designationName },
      "leave-requests",
      "access",
    );
    return next();
  } catch (error) {
    return next(error);
  }
};

caLeaveRequestsRouter.get("/", authenticateToken, requireCompanyAdmin, caLeaveRequestsController.list);
caLeaveRequestsRouter.post(
  "/",
  authenticateToken,
  requireCompanyAdmin,
  requireLeaveApply,
  caLeaveRequestsController.create,
);
caLeaveRequestsRouter.patch(
  "/:id/approve",
  authenticateToken,
  requireCompanyAdmin,
  requireLeaveReview,
  caLeaveRequestsController.approve,
);
caLeaveRequestsRouter.patch(
  "/:id/reject",
  authenticateToken,
  requireCompanyAdmin,
  requireLeaveReview,
  caLeaveRequestsController.reject,
);
