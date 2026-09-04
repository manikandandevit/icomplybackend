import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { AppError } from "../../core/errors/AppError.js";
import { createToast } from "../../core/toast/index.js";
import { fail, success } from "../../core/utils/response.js";
import { caPermissionsService } from "./caPermissions.service.js";

const sendAppError = (res, error) => {
  if (error instanceof AppError) {
    return fail(res, {
      status: error.statusCode,
      message: error.message,
      code: error.code,
    });
  }
  throw error;
};

export const caPermissionsController = {
  list: asyncHandler(async (req, res) => {
    const permissions = await caPermissionsService.list(req.companyId);
    return success(res, {
      message: "Permissions loaded",
      data: { permissions },
    });
  }),

  mine: asyncHandler(async (req, res) => {
    const result = await caPermissionsService.mine(req.companyId, {
      isOwner: Boolean(req.isCompanyOwner),
      designationId: req.designationId,
      designationName: req.designationName,
    });

    return success(res, {
      message: "Access loaded",
      data: {
        ...result,
        companyAccess: req.companyAccess || "All Companies",
      },
    });
  }),

  save: asyncHandler(async (req, res) => {
    try {
      const permissions = await caPermissionsService.save(req.companyId, req.body?.permissions);
      const message = "Permissions saved";
      return success(res, {
        message,
        data: { permissions },
        toast: createToast({ type: "success", message }),
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),
};
