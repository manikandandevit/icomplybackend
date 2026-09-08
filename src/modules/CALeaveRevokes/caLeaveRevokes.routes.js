import { Router } from "express";
import multer from "multer";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { caPermissionsService } from "../CAPermissions/caPermissions.service.js";
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MIME_TYPES } from "../../core/storage/leaveAttachments.js";
import { caLeaveRequestsController } from "../CALeaveRequests/caLeaveRequests.controller.js";
import { caLeaveRevokesController } from "./caLeaveRevokes.controller.js";

const requireRevokeApply = async (req, _res, next) => {
  try {
    await caPermissionsService.assertAccess(
      req.companyId,
      { isOwner: Boolean(req.isCompanyOwner), designationId: req.designationId, designationName: req.designationName },
      "revoke-apply",
      "access",
    );
    return next();
  } catch (error) {
    return next(error);
  }
};

const requireRevokeReview = async (req, _res, next) => {
  try {
    await caPermissionsService.assertAccess(
      req.companyId,
      { isOwner: Boolean(req.isCompanyOwner), designationId: req.designationId, designationName: req.designationName },
      "revoke-requests",
      "access",
    );
    return next();
  } catch (error) {
    return next(error);
  }
};

export const caLeaveRevokesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: ATTACHMENT_MAX_BYTES },
  fileFilter: (_req, file, callback) => {
    callback(null, ATTACHMENT_MIME_TYPES.includes(file.mimetype));
  },
});

caLeaveRevokesRouter.get("/", authenticateToken, requireCompanyAdmin, caLeaveRevokesController.list);
caLeaveRevokesRouter.post(
  "/attachment",
  authenticateToken,
  requireCompanyAdmin,
  requireRevokeApply,
  upload.single("file"),
  caLeaveRequestsController.uploadAttachment,
);
caLeaveRevokesRouter.post(
  "/",
  authenticateToken,
  requireCompanyAdmin,
  requireRevokeApply,
  caLeaveRevokesController.create,
);
caLeaveRevokesRouter.patch(
  "/:id/approve",
  authenticateToken,
  requireCompanyAdmin,
  requireRevokeReview,
  caLeaveRevokesController.approve,
);
caLeaveRevokesRouter.patch(
  "/:id/reject",
  authenticateToken,
  requireCompanyAdmin,
  requireRevokeReview,
  caLeaveRevokesController.reject,
);
caLeaveRevokesRouter.delete(
  "/:id",
  authenticateToken,
  requireCompanyAdmin,
  requireRevokeApply,
  caLeaveRevokesController.cancel,
);
