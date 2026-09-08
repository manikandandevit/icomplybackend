import { Router } from "express";
import multer from "multer";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { caPermissionsService } from "../CAPermissions/caPermissions.service.js";
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MIME_TYPES } from "../../core/storage/leaveAttachments.js";
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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: ATTACHMENT_MAX_BYTES },
  fileFilter: (_req, file, callback) => {
    callback(null, ATTACHMENT_MIME_TYPES.includes(file.mimetype));
  },
});

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
caLeaveRequestsRouter.get("/balances", authenticateToken, requireCompanyAdmin, caLeaveRequestsController.balances);
caLeaveRequestsRouter.post(
  "/attachment",
  authenticateToken,
  requireCompanyAdmin,
  requireLeaveApply,
  upload.single("file"),
  caLeaveRequestsController.uploadAttachment,
);
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
caLeaveRequestsRouter.delete(
  "/:id",
  authenticateToken,
  requireCompanyAdmin,
  requireLeaveApply,
  caLeaveRequestsController.cancel,
);
